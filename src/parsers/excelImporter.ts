import { CsvImportResult } from '../types';
import type { Database } from 'sql.js';

export async function parseZerodhaExcel(
  file: File,
  db: Database
): Promise<CsvImportResult> {
  // Dynamically import xlsx only when an Excel file is actually uploaded
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Zerodha Console workbooks have tabs like "Tradebook", "Trades", or "Holdings"
  const sheetName =
    workbook.SheetNames.find((name) =>
      /tradebook|trades|trade|holdings/i.test(name)
    ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Could not find a valid trade/holdings sheet in ${file.name}`);
  }

  // Convert to 2D array to bypass Zerodha's metadata header block
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Locate the header row containing "Symbol" or "ISIN"
  const headerIdx = rawRows.findIndex((row) =>
    row.some((cell) => /symbol|isin|scrip/i.test(String(cell || '')))
  );

  if (headerIdx === -1) {
    throw new Error('Could not identify table headers in Zerodha Excel sheet.');
  }

  const rawHeaders = rawRows[headerIdx].map((h) =>
    String(h || '').trim().toLowerCase()
  );

  const symIdx = rawHeaders.findIndex((h) => h.includes('symbol') || h.includes('scrip'));
  const isinIdx = rawHeaders.findIndex((h) => h.includes('isin'));
  const typeIdx = rawHeaders.findIndex((h) => h.includes('trade type') || h.includes('type'));
  const qtyIdx = rawHeaders.findIndex((h) => h.includes('quantity') || h.includes('qty'));
  const priceIdx = rawHeaders.findIndex((h) => h.includes('price'));
  const dateIdx = rawHeaders.findIndex((h) => h.includes('date'));

  const dataRows = rawRows.slice(headerIdx + 1);

  let newTxns = 0;
  let duplicates = 0;
  const errors: string[] = [];

  db.run('BEGIN TRANSACTION');

  try {
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const symbol = String(row[symIdx] || '').trim().toUpperCase();
      if (!symbol) continue;

      const isin = isinIdx !== -1 ? String(row[isinIdx] || '').trim() : '';
      const rawType = typeIdx !== -1 ? String(row[typeIdx] || '').trim().toUpperCase() : 'BUY';
      const action = rawType.includes('SELL') ? 'SELL' : 'BUY';
      const quantity = Math.abs(parseFloat(String(row[qtyIdx] || '0')));
      const price = parseFloat(String(row[priceIdx] || '0'));
      const tradeDate = dateIdx !== -1 ? String(row[dateIdx] || '').slice(0, 10) : new Date().toISOString().slice(0, 10);

      if (isNaN(quantity) || quantity <= 0 || isNaN(price)) {
        continue;
      }

      // Check duplicate
      const checkStmt = db.prepare(
        `SELECT id FROM transactions 
         WHERE broker = 'Zerodha' AND symbol = ? AND trade_date = ? AND action = ? AND quantity = ? AND price = ?`
      );
      checkStmt.bind([symbol, tradeDate, action, quantity, price]);
      const exists = checkStmt.step();
      checkStmt.free();

      if (exists) {
        duplicates++;
        continue;
      }

      // Insert transaction
      db.run(
        `INSERT INTO transactions (broker, category, symbol, name, isin, currency, action, quantity, price, trade_date)
         VALUES ('Zerodha', 'EQUITY', ?, ?, ?, 'INR', ?, ?, ?, ?)`,
        [symbol, symbol, isin, action, quantity, price, tradeDate]
      );
      newTxns++;
    }

    // Recalculate Zerodha equity holdings from ledger transactions
    db.run(`DELETE FROM holdings WHERE broker = 'Zerodha' AND category = 'EQUITY'`);

    const holdingsStmt = db.prepare(`
      SELECT 
        symbol,
        name,
        isin,
        currency,
        SUM(CASE WHEN action = 'BUY' THEN quantity ELSE -quantity END) as net_qty,
        SUM(CASE WHEN action = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
        SUM(CASE WHEN action = 'BUY' THEN quantity ELSE 0 END) as buy_qty
      FROM transactions
      WHERE broker = 'Zerodha' AND category = 'EQUITY'
      GROUP BY symbol
    `);

    let updatedHoldingsCount = 0;

    while (holdingsStmt.step()) {
      const h = holdingsStmt.getAsObject() as any;
      if (h.net_qty > 0) {
        const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, isin, currency, quantity, avg_price, market_price)
           VALUES ('Zerodha', 'EQUITY', ?, ?, ?, 'INR', ?, ?, ?)`,
          [h.symbol, h.name || h.symbol, h.isin || '', h.net_qty, avgPrice, avgPrice]
        );
        updatedHoldingsCount++;
      }
    }
    holdingsStmt.free();

    db.run('COMMIT');

    return {
      broker: 'Zerodha',
      newTransactionsAdded: newTxns,
      duplicatesSkipped: duplicates,
      holdingsUpdated: updatedHoldingsCount,
      errors,
    };
  } catch (err: any) {
    db.run('ROLLBACK');
    throw new Error(`Failed to parse Zerodha Excel: ${err?.message || err}`);
  }
}