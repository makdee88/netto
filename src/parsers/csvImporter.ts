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

  if (isExcel) {
    const summary = await parseZerodhaExcel(file, db);
    onComplete(summary);
    return;
  }

  const text = await file.text();
  let newTxns = 0;
  let duplicates = 0;
  const errors: string[] = [];

  db.run('BEGIN TRANSACTION');

  try {
    if (broker.toLowerCase() === 'avanza') {
      const rows = parseCsvLines(text, ';');
      if (rows.length < 2) throw new Error('Avanza CSV is empty or invalid.');

      const headers = rows[0].map((h) => h.toLowerCase());
      const dateIdx = headers.findIndex((h) => h.includes('datum'));
      const typeIdx = headers.findIndex((h) => h.includes('typ av transaktion'));
      const descIdx = headers.findIndex((h) => h.includes('värdepapper/beskrivning') || h.includes('beskrivning'));
      const qtyIdx = headers.findIndex((h) => h.includes('antal'));
      const priceIdx = headers.findIndex((h) => h.includes('kurs'));
      const amtIdx = headers.findIndex((h) => h.includes('belopp'));
      const currIdx = headers.findIndex((h) => h.includes('valuta'));

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 3) continue;

        const rawType = (r[typeIdx] || '').toLowerCase();
        let txType = '';
        if (rawType.includes('köp')) txType = 'BUY';
        else if (rawType.includes('sälj')) txType = 'SELL';
        else if (rawType.includes('utdelning')) txType = 'DIVIDEND';
        else continue;

        const txDate = r[dateIdx] || new Date().toISOString().slice(0, 10);
        const name = r[descIdx] || 'Unknown';
        const symbol = name.toUpperCase();
        const quantity = Math.abs(normalizeNumber(r[qtyIdx]));
        const price = normalizeNumber(r[priceIdx]);
        const amount = amtIdx !== -1 ? Math.abs(normalizeNumber(r[amtIdx])) : quantity * price;
        const currency = (r[currIdx] || 'SEK').toUpperCase();
        const txHash = `AVANZA_${symbol}_${txDate}_${txType}_${quantity}_${price}`;

        if (quantity <= 0 && txType !== 'DIVIDEND') continue;

        const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
        if (checkRes.length > 0 && checkRes[0].values.length > 0) {
          duplicates++;
          continue;
        }

        db.run(
          `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
           VALUES ('Avanza', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [symbol, name, txType, txDate, quantity, price, amount, currency, txHash]
        );
        newTxns++;
      }

      db.run(`DELETE FROM holdings WHERE broker = 'Avanza' AND category = 'EQUITY'`);

      const hStmt = db.prepare(`
        SELECT 
          symbol, name, currency,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity WHEN tx_type = 'SELL' THEN -quantity ELSE 0 END) as net_qty,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity ELSE 0 END) as buy_qty
        FROM transactions
        WHERE broker = 'Avanza'
        GROUP BY symbol
      `);

      let updatedCount = 0;
      while (hStmt.step()) {
        const h = hStmt.getAsObject() as any;
        if (h.net_qty > 0) {
          const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
          db.run(
            `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
             VALUES ('Avanza', 'EQUITY', ?, ?, ?, ?, ?, ?)`,
            [h.symbol, h.name, h.currency, h.net_qty, avgPrice, avgPrice]
          );
          updatedCount++;
        }
      }
      hStmt.free();

      db.run('COMMIT');

      onComplete({
        broker: 'Avanza',
        importType: 'TRADEBOOK',
        newTransactionsAdded: newTxns,
        duplicatesSkipped: duplicates,
        holdingsUpdated: updatedCount,
        errors,
      });
      return;
    }

    // Standard CSV fallback (Generic / Other Brokers)
    const delimiter = text.includes(';') ? ';' : ',';
    const rows = parseCsvLines(text, delimiter);
    if (rows.length < 2) throw new Error('CSV is empty or invalid.');

    const headers = rows[0].map((h) => h.toLowerCase());
    const symIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('scrip') || h.includes('instrument'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('action'));
    const qtyIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('qty'));
    const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('avg. cost'));
    const dateIdx = headers.findIndex((h) => h.includes('date'));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;

      const symbol = (r[symIdx] || '').toUpperCase().trim();
      if (!symbol) continue;

      const rawType = (r[typeIdx] || 'BUY').toUpperCase();
      const txType = rawType.includes('SELL') ? 'SELL' : 'BUY';
      const quantity = Math.abs(normalizeNumber(r[qtyIdx]));
      const price = normalizeNumber(r[priceIdx]);
      const amount = quantity * price;
      const txDate = (r[dateIdx] || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const txHash = `${broker}_${symbol}_${txDate}_${txType}_${quantity}_${price}`;

      if (quantity <= 0) continue;

      const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
      if (checkRes.length > 0 && checkRes[0].values.length > 0) {
        duplicates++;
        continue;
      }

      db.run(
        `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?)`,
        [broker, symbol, symbol, txType, txDate, quantity, price, amount, txHash]
      );
      newTxns++;
    }

    db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [broker]);

    const safeBroker = broker.replace(/'/g, "''");
    const hStmt = db.prepare(`
      SELECT 
        symbol, name, currency,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity WHEN tx_type = 'SELL' THEN -quantity ELSE 0 END) as net_qty,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity ELSE 0 END) as buy_qty
      FROM transactions
      WHERE broker = '${safeBroker}'
      GROUP BY symbol
    `);

    let updatedCount = 0;
    while (hStmt.step()) {
      const h = hStmt.getAsObject() as any;
      if (h.net_qty > 0) {
        const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
           VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?)`,
          [broker, h.symbol, h.name, h.currency || 'INR', h.net_qty, avgPrice, avgPrice]
        );
        updatedCount++;
      }
    }
    hStmt.free();

    db.run('COMMIT');

    onComplete({
      broker,
      importType: 'TRADEBOOK',
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