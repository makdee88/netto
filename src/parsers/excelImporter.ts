import { CsvImportResult } from '../types';
import type { Database } from 'sql.js';

export async function parseZerodhaExcel(
  file: File,
  db: Database
): Promise<CsvImportResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  let newTxns = 0;
  let duplicates = 0;
  let updatedHoldingsCount = 0;
  const errors: string[] = [];

  db.run('BEGIN TRANSACTION');

  try {
    // Clear existing Zerodha holdings
    db.run(`DELETE FROM holdings WHERE broker = 'Zerodha'`);

    const today = new Date().toISOString().slice(0, 10);

    // Prefer individual category sheets ('Equity', 'Mutual Funds') to avoid double counting from 'Combined'
    let targetSheets = workbook.SheetNames.filter((name) =>
      /equity|mutual funds/i.test(name)
    );
    if (targetSheets.length === 0) {
      targetSheets = workbook.SheetNames.filter((name) =>
        /tradebook|trades|holding|holdings/i.test(name)
      );
    }
    if (targetSheets.length === 0) {
      targetSheets = [workbook.SheetNames[0]];
    }

    for (const sheetName of targetSheets) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headerIdx = rawRows.findIndex((row) =>
        row.some((cell) => /symbol|scrip|instrument/i.test(String(cell || '')))
      );

      if (headerIdx === -1) continue;

      const rawHeaders = rawRows[headerIdx].map((h) =>
        String(h || '').trim().toLowerCase()
      );

      const symIdx = rawHeaders.findIndex((h) => h.includes('symbol') || h.includes('scrip') || h.includes('instrument'));
      const qtyIdx = rawHeaders.findIndex((h) => h.includes('quantity available') || h.includes('quantity') || h.includes('qty') || h.includes('net qty'));
      const avgPriceIdx = rawHeaders.findIndex((h) => h.includes('average price') || h.includes('avg. cost') || h.includes('buy price'));
      const ltpIdx = rawHeaders.findIndex((h) => h.includes('previous closing price') || h.includes('ltp') || h.includes('market price'));

      const isMutualFunds = /mutual funds/i.test(sheetName);
      const category = isMutualFunds ? 'MUTUAL_FUND' : 'EQUITY';

      const dataRows = rawRows.slice(headerIdx + 1);

      for (const row of dataRows) {
        if (!row || row.length === 0) continue;

        const symbol = String(row[symIdx] || '').trim().toUpperCase();
        if (!symbol || symbol === 'TOTAL' || symbol === 'GRAND TOTAL') continue;

        const name = symbol;
        const quantity = Math.abs(parseFloat(String(row[qtyIdx] || '0')));
        const avgPrice = parseFloat(String(row[avgPriceIdx] || '0'));
        const marketPrice = ltpIdx !== -1 ? parseFloat(String(row[ltpIdx] || '0')) : avgPrice;

        if (isNaN(quantity) || quantity <= 0) continue;

        // Insert into holdings table
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
           VALUES ('Zerodha', ?, ?, ?, 'INR', ?, ?, ?)`,
          [category, symbol, name, quantity, avgPrice, marketPrice > 0 ? marketPrice : avgPrice]
        );
        updatedHoldingsCount++;

        // Insert into transactions table (omitting isin since transactions table doesn't have it)
        const txHash = `ZERODHA_HOLDINGS_${sheetName}_${symbol}_${today}_${quantity}_${avgPrice}`;
        const amount = quantity * avgPrice;

        const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
        if (checkRes.length === 0 || checkRes[0].values.length === 0) {
          db.run(
            `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
             VALUES ('Zerodha', ?, ?, 'BUY', ?, ?, ?, ?, 'INR', ?)`,
            [symbol, name, today, quantity, avgPrice, amount, txHash]
          );
          newTxns++;
        }
      }
    }

    db.run('COMMIT');

    return {
      broker: 'Zerodha',
      importType: 'HOLDINGS_SNAPSHOT',
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