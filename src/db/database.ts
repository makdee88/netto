import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  CurrencyCode,
  HoldingRow,
  PropertyRow,
  LiabilityRow,
  TransactionRow,
  SnapshotRow,
  SectorWeight,
  GicsSector,
} from '../types';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broker TEXT NOT NULL,
    category TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    avg_price REAL DEFAULT 0,
    market_price REAL DEFAULT 0,
    principal REAL DEFAULT 0,
    interest_rate REAL DEFAULT 0,
    compounding_freq INTEGER DEFAULT 4,
    start_date TEXT DEFAULT '',
    maturity_date TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(broker, symbol)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT UNIQUE NOT NULL,
    broker TEXT NOT NULL,
    account TEXT DEFAULT '',
    tx_date TEXT NOT NULL,
    tx_type TEXT NOT NULL, -- 'BUY', 'SELL', 'SPLIT'
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    property_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    buy_price REAL NOT NULL,
    buy_month INTEGER NOT NULL,
    buy_year INTEGER NOT NULL,
    current_price REAL NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS liabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    liability_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    total_loan REAL NOT NULL,
    remaining_balance REAL NOT NULL,
    interest_rate REAL NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS networth_snapshots (
    snapshot_date TEXT PRIMARY KEY,
    total_assets_sek REAL NOT NULL,
    total_liabilities_sek REAL NOT NULL,
    net_worth_sek REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holding_sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  sector TEXT NOT NULL,
  weight_pct REAL NOT NULL, -- e.g. 25.5 for 25.5%
  UNIQUE(symbol, sector)
  );
`;

export async function initDatabase(savedBytes?: Uint8Array): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  const db = savedBytes ? new SQL.Database(savedBytes) : new SQL.Database();
  db.run(SCHEMA);

  const res = db.exec("SELECT value FROM app_config WHERE key = 'vault_id'");
  if (res.length === 0) {
    db.run("INSERT INTO app_config (key, value) VALUES ('vault_id', ?)", [crypto.randomUUID()]);
    db.run("INSERT INTO app_config (key, value) VALUES ('base_currency', 'SEK')");
  }

  // Refresh FD valuations to reflect accrued interest up to today
  refreshFdHoldingsValuations(db);

  return db;
}

export function recalculateHoldingsFromTransactions(db: Database, brokerName: string): number {
  const stmt = db.prepare(
    `SELECT * FROM transactions WHERE broker = ? ORDER BY tx_date ASC, id ASC`,
    [brokerName]
  );

  interface Acc {
    symbol: string;
    name: string;
    currency: string;
    totalQty: number;
    totalCost: number;
    latestTxPrice: number;
  }

  const map = new Map<string, Acc>();

  while (stmt.step()) {
    const tx = stmt.getAsObject() as unknown as TransactionRow;
    let entry = map.get(tx.symbol);
    if (!entry) {
      entry = {
        symbol: tx.symbol,
        name: tx.name,
        currency: tx.currency,
        totalQty: 0,
        totalCost: 0,
        latestTxPrice: tx.price || 0,
      };
      map.set(tx.symbol, entry);
    }

    if (tx.name && tx.name !== tx.symbol) {
      entry.name = tx.name;
    }

    if (tx.tx_type === 'BUY') {
      const absQty = Math.abs(tx.quantity);
      const costAdded = tx.amount > 0 ? tx.amount : absQty * tx.price;
      entry.totalQty += absQty;
      entry.totalCost += costAdded;
    } else if (tx.tx_type === 'SELL') {
      const sellQty = Math.abs(tx.quantity);
      const currentAvg = entry.totalQty > 0 ? entry.totalCost / entry.totalQty : 0;
      entry.totalQty = Math.max(0, entry.totalQty - sellQty);
      entry.totalCost = Math.max(0, entry.totalQty * currentAvg);
    } else if (tx.tx_type === 'SPLIT') {
      entry.totalQty += tx.quantity;
    }

    if (tx.price > 0) {
      entry.latestTxPrice = tx.price;
    }
  }
  stmt.free();

  let activeHoldingsCount = 0;
  const upsertSql = `
    INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price, updated_at)
    VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(broker, symbol) DO UPDATE SET
      name = excluded.name,
      currency = excluded.currency,
      quantity = excluded.quantity,
      avg_price = excluded.avg_price,
      market_price = CASE
        WHEN holdings.market_price > 0 AND holdings.market_price != holdings.avg_price THEN holdings.market_price
        ELSE excluded.market_price
      END,
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const [_, h] of map) {
    if (h.totalQty > 0.0001) {
      const cleanQty = Number(h.totalQty.toFixed(4));
      const avgPrice = cleanQty > 0 ? h.totalCost / cleanQty : 0;
      const defaultMarketPrice = h.latestTxPrice > 0 ? h.latestTxPrice : avgPrice;
      db.run(upsertSql, [
        brokerName,
        h.symbol,
        h.name,
        h.currency,
        cleanQty,
        avgPrice,
        defaultMarketPrice,
      ]);
      activeHoldingsCount++;
    } else {
      db.run(`DELETE FROM holdings WHERE broker = ? AND symbol = ? AND category = 'EQUITY'`, [
        brokerName,
        h.symbol,
      ]);
    }
  }

  return activeHoldingsCount;
}

export interface HistoricalTimelinePoint {
  date: string;          // YYYY-MM
  label: string;         // e.g. "Oct '26"
  investedCost: number;  // Total cumulative cost basis in baseCurrency
  portfolioValue: number;// Total market value in baseCurrency
  equitiesValue: number; // Equities/Funds portion
  fdAndPropValue: number;// Fixed Deposits + Real Estate portion
}

interface RunningPos {
  broker: string;
  symbol: string;
  currency: string;
  qty: number;
  cost: number;
  lastKnownPrice: number;
}

/**
 * Reconstructs historical portfolio growth from stored transactions,
 * Fixed Deposit start dates, and Real Estate acquisition dates.
 */
export function getHistoricalPortfolioTimeline(
  db: Database,
  holdings: HoldingRow[],
  properties: PropertyRow[],
  fxRates: Record<string, number>,
  baseCurrency: CurrencyCode,
  frequency: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
): HistoricalTimelinePoint[] {
  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const stmt = db.prepare(`SELECT * FROM transactions ORDER BY tx_date ASC, id ASC`);
  const txs: TransactionRow[] = [];
  while (stmt.step()) {
    txs.push(stmt.getAsObject() as unknown as TransactionRow);
  }
  stmt.free();

  const fds = holdings.filter((h) => h.category === 'FIXED_DEPOSIT' && h.start_date);

  const candidateDates: string[] = [];
  if (txs.length > 0 && txs[0].tx_date) candidateDates.push(txs[0].tx_date.slice(0, 10));
  for (const fd of fds) {
    if (fd.start_date) candidateDates.push(fd.start_date.slice(0, 10));
  }
  for (const p of properties) {
    if (p.buy_year && p.buy_month) {
      const m = String(p.buy_month).padStart(2, '0');
      candidateDates.push(`${p.buy_year}-${m}-01`);
    }
  }

  if (candidateDates.length === 0) return [];

  candidateDates.sort();
  const earliestStr = candidateDates[0];
  const startYear = parseInt(earliestStr.slice(0, 4), 10);
  const startMonth = parseInt(earliestStr.slice(5, 7), 10);

  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  const rawCheckpoints: Array<{ ym: string; endOfMonthDate: string; isCurrentMonth: boolean; year: number; month: number }> = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const mStr = String(m).padStart(2, '0');
    const isCurrent = y === endYear && m === endMonth;
    rawCheckpoints.push({
      ym: `${y}-${mStr}`,
      endOfMonthDate: `${y}-${mStr}-31`,
      isCurrentMonth: isCurrent,
      year: y,
      month: m,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const checkpoints = rawCheckpoints.filter((cp, idx) => {
    if (frequency === 'YEARLY') {
      const next = rawCheckpoints[idx + 1];
      const isLastOfYear = !next || next.year !== cp.year;
      return isLastOfYear || cp.isCurrentMonth;
    }
    return true;
  });

  const liveHoldingPrices = new Map<string, number>();
  for (const h of holdings) {
    if (h.category === 'EQUITY') {
      const p = h.market_price > 0 ? h.market_price : h.avg_price;
      liveHoldingPrices.set(`${h.broker}|${h.symbol}`, p);
    }
  }

  const runningPositions = new Map<string, RunningPos>();
  let txIndex = 0;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timeline: HistoricalTimelinePoint[] = [];

  for (const cp of checkpoints) {
    while (txIndex < txs.length && txs[txIndex].tx_date.slice(0, 10) <= cp.endOfMonthDate) {
      const tx = txs[txIndex];
      const key = `${tx.broker}|${tx.symbol}`;
      let pos = runningPositions.get(key);
      if (!pos) {
        pos = {
          broker: tx.broker,
          symbol: tx.symbol,
          currency: tx.currency,
          qty: 0,
          cost: 0,
          lastKnownPrice: tx.price || 0,
        };
        runningPositions.set(key, pos);
      }

      if (tx.tx_type === 'BUY') {
        const absQty = Math.abs(tx.quantity);
        const costAdded = tx.amount > 0 ? tx.amount : absQty * tx.price;
        pos.qty += absQty;
        pos.cost += costAdded;
      } else if (tx.tx_type === 'SELL') {
        const sellQty = Math.abs(tx.quantity);
        const avg = pos.qty > 0 ? pos.cost / pos.qty : 0;
        pos.qty = Math.max(0, pos.qty - sellQty);
        pos.cost = Math.max(0, pos.qty * avg);
      } else if (tx.tx_type === 'SPLIT') {
        pos.qty += tx.quantity;
      }

      if (tx.price > 0) {
        pos.lastKnownPrice = tx.price;
      }
      txIndex++;
    }

    let equitiesCostBase = 0;
    let equitiesMarketBase = 0;
    for (const [key, pos] of runningPositions) {
      if (pos.qty > 0.0001) {
        const priceToUse = cp.isCurrentMonth
          ? liveHoldingPrices.get(key) || pos.lastKnownPrice
          : pos.lastKnownPrice;
        equitiesCostBase += convertToBase(pos.cost, pos.currency);
        equitiesMarketBase += convertToBase(pos.qty * priceToUse, pos.currency);
      }
    }

    let fdCostBase = 0;
    let fdValBase = 0;
    const cpTimestamp = cp.isCurrentMonth
      ? Date.now()
      : new Date(`${cp.ym}-28T23:59:59Z`).getTime();

    for (const fd of fds) {
      const startTs = new Date(fd.start_date).getTime();
      if (startTs <= cpTimestamp) {
        fdCostBase += convertToBase(fd.principal, fd.currency);
        const matTs = fd.maturity_date ? new Date(fd.maturity_date).getTime() : cpTimestamp;
        const effectiveEnd = Math.min(cpTimestamp, matTs);
        const yearsElapsed = Math.max(0, (effectiveEnd - startTs) / (1000 * 60 * 60 * 24 * 365.25));
        const r = (fd.interest_rate || 0) / 100;
        const n = fd.compounding_freq || 4;
        const compounded = fd.principal * Math.pow(1 + r / n, n * yearsElapsed);
        fdValBase += convertToBase(compounded, fd.currency);
      }
    }

    let propCostBase = 0;
    let propValBase = 0;
    for (const p of properties) {
      const propYm = `${p.buy_year}-${String(p.buy_month).padStart(2, '0')}`;
      if (propYm <= cp.ym) {
        propCostBase += convertToBase(p.buy_price, p.currency);
        const startPropTs = new Date(`${propYm}-01T00:00:00Z`).getTime();
        const totalDuration = Math.max(1, Date.now() - startPropTs);
        const elapsed = Math.min(totalDuration, Math.max(0, cpTimestamp - startPropTs));
        const progress = cp.isCurrentMonth ? 1 : elapsed / totalDuration;
        const estimatedVal = p.buy_price + (p.current_price - p.buy_price) * progress;
        propValBase += convertToBase(estimatedVal, p.currency);
      }
    }

    const mIdx = cp.month - 1;
    const label = frequency === 'YEARLY' ? String(cp.year) : cp.isCurrentMonth ? 'Now' : `${monthNames[mIdx]} '${String(cp.year).slice(2)}`;

    timeline.push({
      date: cp.ym,
      label,
      investedCost: equitiesCostBase + fdCostBase + propCostBase,
      portfolioValue: equitiesMarketBase + fdValBase + propValBase,
      equitiesValue: equitiesMarketBase,
      fdAndPropValue: fdValBase + propValBase,
    });
  }

  return timeline;
}

export function recordSnapshot(db: Database, totalAssets: number, totalLiabilities: number) {
  const today = new Date().toISOString().slice(0, 10);
  const netWorth = totalAssets - totalLiabilities;
  db.run(
    `INSERT INTO networth_snapshots (snapshot_date, total_assets_sek, total_liabilities_sek, net_worth_sek) VALUES (?, ?, ?, ?)
     ON CONFLICT(snapshot_date) DO UPDATE SET total_assets_sek = excluded.total_assets_sek, total_liabilities_sek = excluded.total_liabilities_sek, net_worth_sek = excluded.net_worth_sek`,
    [today, totalAssets, totalLiabilities, netWorth]
  );
}

export function getSnapshots(db: Database): Array<{ date: string; assets: number; liabilities: number; netWorth: number }> {
  const stmt = db.prepare('SELECT snapshot_date, total_assets_sek, total_liabilities_sek, net_worth_sek FROM networth_snapshots ORDER BY snapshot_date ASC');
  const rows: Array<{ date: string; assets: number; liabilities: number; netWorth: number }> = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ date: r.snapshot_date as string, assets: r.total_assets_sek as number, liabilities: r.total_liabilities_sek as number, netWorth: r.net_worth_sek as number });
  }
  stmt.free();
  return rows;
}

export function getHoldings(db: Database): HoldingRow[] {
  const stmt = db.prepare('SELECT * FROM holdings ORDER BY broker ASC, category ASC, name ASC');
  const rows: HoldingRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
  stmt.free();
  return rows;
}

export function deleteHolding(db: Database, id: number) {
  db.run(`DELETE FROM holdings WHERE id = ?`, [id]);
}

export function getProperties(db: Database): PropertyRow[] {
  const stmt = db.prepare('SELECT * FROM properties ORDER BY name');
  const rows: PropertyRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as PropertyRow);
  stmt.free();
  return rows;
}

export function addProperty(
  db: Database,
  p: {
    name: string;
    property_type: string;
    currency: CurrencyCode;
    buy_price: number;
    buy_month: number;
    buy_year: number;
    current_price: number;
  }
) {
  db.run(
    `INSERT INTO properties (name, property_type, currency, buy_price, buy_month, buy_year, current_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.property_type, p.currency, p.buy_price, p.buy_month, p.buy_year, p.current_price]
  );
}

export function deleteProperty(db: Database, id: number) {
  db.run(`DELETE FROM properties WHERE id = ?`, [id]);
}

export function getLiabilities(db: Database): LiabilityRow[] {
  const stmt = db.prepare('SELECT * FROM liabilities ORDER BY name');
  const rows: LiabilityRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as LiabilityRow);
  stmt.free();
  return rows;
}

export function addLiability(
  db: Database,
  l: {
    name: string;
    liability_type: string;
    currency: CurrencyCode;
    total_loan: number;
    remaining_balance: number;
    interest_rate: number;
  }
) {
  db.run(
    `INSERT INTO liabilities (name, liability_type, currency, total_loan, remaining_balance, interest_rate)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [l.name, l.liability_type, l.currency, l.total_loan, l.remaining_balance, l.interest_rate]
  );
}

export function deleteLiability(db: Database, id: number) {
  db.run(`DELETE FROM liabilities WHERE id = ?`, [id]);
}

export function addFixedDeposit(
  db: Database,
  fd: {
    broker: string;
    symbol: string;
    name: string;
    currency: CurrencyCode;
    principal: number;
    interest_rate: number;
    compounding_freq: number;
    start_date: string;
    maturity_date: string;
  }
) {
  db.run(
    `INSERT INTO holdings (
      broker, category, symbol, name, currency, quantity, avg_price, market_price,
      principal, interest_rate, compounding_freq, start_date, maturity_date
    ) VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fd.broker,
      fd.symbol,
      fd.name,
      fd.currency,
      fd.principal,
      fd.principal,
      fd.principal,
      fd.interest_rate,
      fd.compounding_freq,
      fd.start_date,
      fd.maturity_date,
    ]
  );
  refreshFdHoldingsValuations(db);
}

export function calculateFDCurrentValue(h: {
  principal?: number;
  interest_rate?: number;
  start_date?: string;
  maturity_date?: string;
  compounding_freq?: number;
}): number {
  if (!h.principal || !h.interest_rate || !h.start_date) return h.principal || 0;
  const start = new Date(h.start_date).getTime();
  const now = Date.now();
  const maturity = h.maturity_date ? new Date(h.maturity_date).getTime() : now;
  const effectiveEnd = Math.min(now, maturity);

  const yearsElapsed = Math.max(0, (effectiveEnd - start) / (1000 * 60 * 60 * 24 * 365.25));
  const r = h.interest_rate / 100;
  const n = h.compounding_freq || 4;
  return h.principal * Math.pow(1 + r / n, n * yearsElapsed);
}

/**
 * Recalculates and updates the live market_price for all Fixed Deposit rows in the database.
 */
export function refreshFdHoldingsValuations(db: Database): number {
  const fds = db.exec(`
    SELECT id, principal, interest_rate, compounding_freq, start_date, maturity_date 
    FROM holdings 
    WHERE category = 'FIXED_DEPOSIT'
  `);

  if (fds.length === 0 || fds[0].values.length === 0) return 0;

  let count = 0;
  db.run('BEGIN TRANSACTION');
  try {
    for (const row of fds[0].values) {
      const [id, principal, rate, freq, start, mat] = row as [
        number,
        number,
        number,
        number,
        string,
        string
      ];
      const liveValue = calculateFDCurrentValue({
        principal,
        interest_rate: rate,
        compounding_freq: freq,
        start_date: start,
        maturity_date: mat,
      });

      db.run(
        `UPDATE holdings SET market_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(liveValue.toFixed(2)), id]
      );
      count++;
    }
    db.run('COMMIT');
    return count;
  } catch (err) {
    db.run('ROLLBACK');
    console.error('Failed to sync FD valuations:', err);
    return 0;
  }
}

export function parseNumber(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().trim().replace(/\s/g, '');
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned.replace(/,/g, '')) || 0;
}

export function getAllTransactions(db: Database): TransactionRow[] {
  const stmt = db.prepare(`SELECT * FROM transactions ORDER BY tx_date ASC, id ASC`);
  const rows: TransactionRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as TransactionRow);
  stmt.free();
  return rows;
}

export function clearBrokerData(db: Database, brokerName: string) {
  db.run('BEGIN TRANSACTION');
  db.run('DELETE FROM transactions WHERE broker = ?', [brokerName]);
  db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [brokerName]);
  db.run('COMMIT');
}

export function updatePropertyValuation(db: Database, id: number, currentPrice: number) {
  db.run(
    `UPDATE properties SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [currentPrice, id]
  );
}

export function updateLiabilityBalance(db: Database, id: number, remainingBalance: number) {
  db.run(
    `UPDATE liabilities SET remaining_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [remainingBalance, id]
  );
}

export function updateHoldingValuation(db: Database, id: number, marketPrice: number) {
  db.run(
    `UPDATE holdings SET market_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [marketPrice, id]
  );
}

export const initSectorTable = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS holding_sectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      sector TEXT NOT NULL,
      weight_pct REAL NOT NULL,
      UNIQUE(symbol, sector)
    );
  `);
};

export const getAllHoldingSectors = (db: Database): Record<string, SectorWeight[]> => {
  try {
    const res = db.exec(`SELECT symbol, sector, weight_pct FROM holding_sectors`);
    if (!res || res.length === 0) return {};
    const map: Record<string, SectorWeight[]> = {};
    res[0].values.forEach((row) => {
      const sym = String(row[0]);
      if (!map[sym]) map[sym] = [];
      map[sym].push({
        sector: row[1] as GicsSector,
        weight_pct: Number(row[2]),
      });
    });
    return map;
  } catch {
    return {};
  }
};

export const getHoldingSectors = (db: Database, symbol: string): SectorWeight[] => {
  try {
    const res = db.exec(`SELECT sector, weight_pct FROM holding_sectors WHERE symbol = ?`, [symbol]);
    if (!res || res.length === 0) return [];
    return res[0].values.map((row) => ({
      sector: row[0] as GicsSector,
      weight_pct: Number(row[1]),
    }));
  } catch {
    return [];
  }
};

export const saveHoldingSectors = (db: Database, symbol: string, sectors: SectorWeight[]) => {
  db.run(`BEGIN TRANSACTION`);
  db.run(`DELETE FROM holding_sectors WHERE symbol = ?`, [symbol]);
  for (const s of sectors) {
    if (s.weight_pct > 0) {
      db.run(
        `INSERT INTO holding_sectors (symbol, sector, weight_pct) VALUES (?, ?, ?)`,
        [symbol, s.sector, s.weight_pct]
      );
    }
  }
  db.run(`COMMIT`);
};

import { matchHoldingToSectorWeights } from '../utils/sectorPresets';

export const autoClassifyAllHoldings = (db: Database): number => {
  const res = db.exec(`SELECT symbol, name FROM holdings WHERE category IN ('EQUITY', 'MUTUAL_FUND')`);
  if (!res || res.length === 0) return 0;

  db.run(`BEGIN TRANSACTION`);
  let updatedCount = 0;

  res[0].values.forEach((row) => {
    const symbol = String(row[0]);
    const name = String(row[1]);
    const weights = matchHoldingToSectorWeights(name, symbol);

    db.run(`DELETE FROM holding_sectors WHERE symbol = ?`, [symbol]);
    weights.forEach((w: SectorWeight) => {
      db.run(
        `INSERT INTO holding_sectors (symbol, sector, weight_pct) VALUES (?, ?, ?)`,
        [symbol, w.sector, w.weight_pct]
      );
    });
    updatedCount++;
  });

  db.run(`COMMIT`);
  return updatedCount;
};