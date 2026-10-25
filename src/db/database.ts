import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { HoldingRow } from '../types';

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

  CREATE TABLE IF NOT EXISTS networth_snapshots (
    snapshot_date TEXT PRIMARY KEY,
    total_value_sek REAL NOT NULL
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
  return db;
}

export function recordSnapshot(db: Database, totalValueSek: number) {
  const today = new Date().toISOString().slice(0, 10);
  db.run(
    `INSERT INTO networth_snapshots (snapshot_date, total_value_sek) VALUES (?, ?)
     ON CONFLICT(snapshot_date) DO UPDATE SET total_value_sek = excluded.total_value_sek`,
    [today, totalValueSek]
  );
}

export function getSnapshots(db: Database): Array<{ date: string; value: number }> {
  const stmt = db.prepare('SELECT snapshot_date, total_value_sek FROM networth_snapshots ORDER BY snapshot_date ASC');
  const rows: Array<{ date: string; value: number }> = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ date: r.snapshot_date, value: r.total_value_sek });
  }
  stmt.free();
  return rows;
}

export function calculateFDCurrentValue(h: HoldingRow): number {
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

export function parseNumber(val: string | number | undefined): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().trim().replace(/\s/g, '');
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned.replace(/,/g, '')) || 0;
}