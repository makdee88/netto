import type { Database } from 'sql.js';
import { CsvImportResult } from '../types';
import { parseZerodhaExcel } from './excelImporter';

function parseCsvLines(text: string, delimiter = ';'): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row: string[] = [];
    let insideQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        row.push(entry.trim().replace(/^"|"$/g, ''));
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim().replace(/^"|"$/g, ''));
    return row;
  });
}

function normalizeNumber(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export async function importBrokerCsv(
  file: File,
  broker: string,
  db: Database,
  onComplete: (summary: CsvImportResult) => void
) {
  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type.includes('spreadsheetml');

  // INDEPENDENT ISOLATION: Excel workbooks route to parseZerodhaExcel
  if (isExcel) {
    const summary = await parseZerodhaExcel(file, db);
    onComplete(summary);
    return;
  }

  // STANDARD CSV BRANCH: Avanza & Zerodha CSV parsers remain 100% intact
  const text = await file.text();
  let newTxns = 0;
  let duplicates = 0;
  const errors: string[] = [];

  db.run('BEGIN TRANSACTION');

  try {
    if (broker.toLowerCase() === 'avanza') {
      // Avanza uses semicolon delimiter and Swedish headers
      const rows = parseCsvLines(text, ';');
      if (rows.length < 2) throw new Error('Avanza CSV is empty or invalid.');

      const headers = rows[0].map((h) => h.toLowerCase());
      const dateIdx = headers.findIndex((h) => h.includes('datum'));
      const typeIdx = headers.findIndex((h) => h.includes('typ av transaktion'));
      const descIdx = headers.findIndex((h) => h.includes('värdepapper/beskrivning') || h.includes('beskrivning'));
      const qtyIdx = headers.findIndex((h) => h.includes('antal'));
      const priceIdx = headers.findIndex((h) => h.includes('kurs'));
      const currIdx = headers.findIndex((h) => h.includes('valuta'));
      const isinIdx = headers.findIndex((h) => h.includes('isin'));

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 3) continue;

        const rawType = (r[typeIdx] || '').toLowerCase();
        if (!rawType.includes('köp') && !rawType.includes('sälj')) continue;

        const action = rawType.includes('köp') ? 'BUY' : 'SELL';
        const tradeDate = r[dateIdx] || new Date().toISOString().slice(0, 10);
        const name = r[descIdx] || 'Unknown';
        const symbol = name.toUpperCase();
        const quantity = Math.abs(normalizeNumber(r[qtyIdx]));
        const price = normalizeNumber(r[priceIdx]);
        const currency = (r[currIdx] || 'SEK').toUpperCase();
        const isin = isinIdx !== -1 ? r[isinIdx] : '';

        if (quantity <= 0) continue;

        const checkStmt = db.prepare(
          `SELECT id FROM transactions 
           WHERE broker = 'Avanza' AND symbol = ? AND trade_date = ? AND action = ? AND quantity = ? AND price = ?`
        );
        checkStmt.bind([symbol, tradeDate, action, quantity, price]);
        const exists = checkStmt.step();
        checkStmt.free();

        if (exists) {
          duplicates++;
          continue;
        }

        db.run(
          `INSERT INTO transactions (broker, category, symbol, name, isin, currency, action, quantity, price, trade_date)
           VALUES ('Avanza', 'EQUITY', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [symbol, name, isin, currency, action, quantity, price, tradeDate]
        );
        newTxns++;
      }

      // Recompute Avanza holdings
      db.run(`DELETE FROM holdings WHERE broker = 'Avanza' AND category = 'EQUITY'`);

      const hStmt = db.prepare(`
        SELECT 
          symbol, name, isin, currency,
          SUM(CASE WHEN action = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
          SUM(CASE WHEN action = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
          SUM(CASE WHEN action = 'BUY' THEN quantity ELSE 0 END) as buy_qty
        FROM transactions
        WHERE broker = 'Avanza' AND category = 'EQUITY'
        GROUP BY symbol
      `);

      let updatedCount = 0;
      while (hStmt.step()) {
        const h = hStmt.getAsObject() as any;
        if (h.net_qty > 0) {
          const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
          db.run(
            `INSERT INTO holdings (broker, category, symbol, name, isin, currency, quantity, avg_price, market_price)
             VALUES ('Avanza', 'EQUITY', ?, ?, ?, ?, ?, ?, ?)`,
            [h.symbol, h.name, h.isin, h.currency, h.net_qty, avgPrice, avgPrice]
          );
          updatedCount++;
        }
      }
      hStmt.free();

      db.run('COMMIT');

      onComplete({
        broker: 'Avanza',
        newTransactionsAdded: newTxns,
        duplicatesSkipped: duplicates,
        holdingsUpdated: updatedCount,
        errors,
      });
      return;
    }

    // Fallback: Standard CSV comma-delimited parser (e.g. Zerodha Tradebook CSV)
    const delimiter = text.includes(';') ? ';' : ',';
    const rows = parseCsvLines(text, delimiter);
    if (rows.length < 2) throw new Error('CSV is empty or invalid.');

    const headers = rows[0].map((h) => h.toLowerCase());
    const symIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('scrip'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('action'));
    const qtyIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('qty'));
    const priceIdx = headers.findIndex((h) => h.includes('price'));
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const isinIdx = headers.findIndex((h) => h.includes('isin'));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;

      const symbol = (r[symIdx] || '').toUpperCase().trim();
      if (!symbol) continue;

      const rawType = (r[typeIdx] || 'BUY').toUpperCase();
      const action = rawType.includes('SELL') ? 'SELL' : 'BUY';
      const quantity = Math.abs(normalizeNumber(r[qtyIdx]));
      const price = normalizeNumber(r[priceIdx]);
      const tradeDate = (r[dateIdx] || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const isin = isinIdx !== -1 ? r[isinIdx] : '';

      if (quantity <= 0) continue;

      const checkStmt = db.prepare(
        `SELECT id FROM transactions 
         WHERE broker = ? AND symbol = ? AND trade_date = ? AND action = ? AND quantity = ? AND price = ?`
      );
      checkStmt.bind([broker, symbol, tradeDate, action, quantity, price]);
      const exists = checkStmt.step();
      checkStmt.free();

      if (exists) {
        duplicates++;
        continue;
      }

      db.run(
        `INSERT INTO transactions (broker, category, symbol, name, isin, currency, action, quantity, price, trade_date)
         VALUES (?, 'EQUITY', ?, ?, ?, 'INR', ?, ?, ?, ?)`,
        [broker, symbol, symbol, isin, action, quantity, price, tradeDate]
      );
      newTxns++;
    }

    // Recompute holdings for this broker
    db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [broker]);

    const hStmt = db.prepare(`
      SELECT 
        symbol, name, isin, currency,
        SUM(CASE WHEN action = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
        SUM(CASE WHEN action = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
        SUM(CASE WHEN action = 'BUY' THEN quantity ELSE 0 END) as buy_qty
      FROM transactions
      WHERE broker = ? AND category = 'EQUITY'
      GROUP BY symbol
    `);
    hStmt.bind([broker]);

    let updatedCount = 0;
    while (hStmt.step()) {
      const h = hStmt.getAsObject() as any;
      if (h.net_qty > 0) {
        const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, isin, currency, quantity, avg_price, market_price)
           VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?, ?)`,
          [broker, h.symbol, h.name, h.isin, h.currency || 'INR', h.net_qty, avgPrice, avgPrice]
        );
        updatedCount++;
      }
    }
    hStmt.free();

    db.run('COMMIT');

    onComplete({
      broker,
      newTransactionsAdded: newTxns,
      duplicatesSkipped: duplicates,
      holdingsUpdated: updatedCount,
      errors,
    });
  } catch (err: any) {
    db.run('ROLLBACK');
    throw new Error(`CSV Import failed: ${err?.message || err}`);
  }
}