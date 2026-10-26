import { CsvImportResult } from '../types';
import type { Database } from 'sql.js';

export async function parseZerodhaExcel(
  file: File,
  db: Database
): Promise<CsvImportResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName =
    workbook.SheetNames.find((name) =>
      /tradebook|trades|trade|holdings|equity/i.test(name)
    ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Could not find a valid trade or holdings sheet in ${file.name}`);
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const headerIdx = rawRows.findIndex((row) =>
    row.some((cell) => /symbol|isin|scrip|instrument/i.test(String(cell || '')))
  );

  if (headerIdx === -1) {
    throw new Error('Could not identify table headers in Zerodha workbook.');
  }

  const rawHeaders = rawRows[headerIdx].map((h) =>
    String(h || '').trim().toLowerCase()
  );

  const symIdx = rawHeaders.findIndex((h) => h.includes('symbol') || h.includes('scrip') || h.includes('instrument'));
  const typeIdx = rawHeaders.findIndex((h) => h.includes('trade type') || h.includes('type') || h.includes('action'));
  const qtyIdx = rawHeaders.findIndex((h) => h.includes('quantity') || h.includes('qty') || h.includes('qty.'));
  const priceIdx = rawHeaders.findIndex((h) => h.includes('price') || h.includes('avg. cost') || h.includes('avg. price'));
  const dateIdx = rawHeaders.findIndex((h) => h.includes('date') || h.includes('trade_date'));

  const dataRows = rawRows.slice(headerIdx + 1);

  let newTxns = 0;
  let duplicates = 0;
  const errors: string[] = [];

  db.run('BEGIN TRANSACTION');

  try {
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const symbol = String(row[symIdx] || '').trim().toUpperCase();
      if (!symbol || symbol === 'TOTAL') continue;

      const rawType = typeIdx !== -1 ? String(row[typeIdx] || '').trim().toUpperCase() : 'BUY';
      const txType = rawType.includes('SELL') ? 'SELL' : 'BUY';
      const quantity = Math.abs(parseFloat(String(row[qtyIdx] || '0')));
      const price = parseFloat(String(row[priceIdx] || '0'));
      const amount = quantity * price;

      let txDate = new Date().toISOString().slice(0, 10);
      if (dateIdx !== -1 && row[dateIdx]) {
        const val = row[dateIdx];
        if (typeof val === 'number') {
          const parsedDate = new Date(Math.round((val - 25569) * 86400 * 1000));
          if (!isNaN(parsedDate.getTime())) {
            txDate = parsedDate.toISOString().slice(0, 10);
          }
        } else {
          txDate = String(val).trim().slice(0, 10);
        }
      }

      if (isNaN(quantity) || quantity <= 0 || isNaN(price)) {
        continue;
      }

      const checkRes = db.exec(
        `SELECT id FROM transactions 
         WHERE broker = 'Zerodha' AND symbol = ? AND tx_date = ? AND tx_type = ? AND quantity = ? AND price = ?`,
        [symbol, txDate, txType, quantity, price]
      );

      if (checkRes.length > 0 && checkRes[0].values.length > 0) {
        duplicates++;
        continue;
      }

      db.run(
        `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency)
         VALUES ('Zerodha', ?, ?, ?, ?, ?, ?, ?, 'INR')`,
        [symbol, symbol, txType, txDate, quantity, price, amount]
      );
      newTxns++;
    }

    db.run(`DELETE FROM holdings WHERE broker = 'Zerodha' AND category = 'EQUITY'`);

    const holdingsStmt = db.prepare(`
      SELECT 
        symbol,
        name,
        currency,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity WHEN tx_type = 'SELL' THEN -quantity ELSE 0 END) as net_qty,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity ELSE 0 END) as buy_qty
      FROM transactions
      WHERE broker = 'Zerodha'
      GROUP BY symbol
    `);

    let updatedHoldingsCount = 0;

    while (holdingsStmt.step()) {
      const h = holdingsStmt.getAsObject() as any;
      if (h.net_qty > 0) {
        const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
           VALUES ('Zerodha', 'EQUITY', ?, ?, 'INR', ?, ?, ?)`,
          [h.symbol, h.name || h.symbol, h.net_qty, avgPrice, avgPrice]
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