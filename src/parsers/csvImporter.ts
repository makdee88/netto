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
): Promise<CsvImportResult> {
  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type.includes('spreadsheetml');

  if (isExcel) {
    const summary = await parseZerodhaExcel(file, broker, db);
    onComplete(summary);
    return summary;
  }

  const text = await file.text();
  let newTxns = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const safeBroker = broker.replace(/'/g, "''");

  db.run('BEGIN TRANSACTION');

  try {
    const lowerBroker = broker.toLowerCase();

    // 1. Avanza (Sweden)
    if (lowerBroker.includes('avanza')) {
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
        const txHash = `${broker}_${symbol}_${txDate}_${txType}_${quantity}_${price}`;

        if (quantity <= 0 && txType !== 'DIVIDEND') continue;

        const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
        if (checkRes.length > 0 && checkRes[0].values.length > 0) {
          duplicates++;
          continue;
        }

        db.run(
          `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [broker, symbol, name, txType, txDate, quantity, price, amount, currency, txHash]
        );
        newTxns++;
      }

      db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [broker]);

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
            [broker, h.symbol, h.name, h.currency, h.net_qty, avgPrice, avgPrice]
          );
          updatedCount++;
        }
      }
      hStmt.free();

      db.run('COMMIT');

      const result: CsvImportResult = {
        broker,
        importType: 'TRADEBOOK',
        newTransactionsAdded: newTxns,
        duplicatesSkipped: duplicates,
        holdingsUpdated: updatedCount,
        errors,
      };
      onComplete(result);
      return result;
    }

    // 2. Kuvera (India - Mutual Funds)
    if (lowerBroker.includes('kuvera')) {
      const rows = parseCsvLines(text, ',');
      if (rows.length < 2) throw new Error('Kuvera CSV is empty or invalid.');

      const headers = rows[0].map((h) => h.toLowerCase());
      const dateIdx = headers.findIndex((h) => h.includes('date'));
      const folioIdx = headers.findIndex((h) => h.includes('folio'));
      const nameIdx = headers.findIndex((h) => h.includes('fund') || h.includes('name'));
      const orderIdx = headers.findIndex((h) => h.includes('order') || h.includes('type'));
      const unitsIdx = headers.findIndex((h) => h.includes('unit') || h.includes('quantity'));
      const navIdx = headers.findIndex((h) => h.includes('nav') || h.includes('price'));
      const amtIdx = headers.findIndex((h) => h.includes('amount'));

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 4) continue;

        const rawOrder = (r[orderIdx] || 'buy').toLowerCase();
        let txType = rawOrder.includes('sell') ? 'SELL' : 'BUY';

        const txDate = (r[dateIdx] || new Date().toISOString().slice(0, 10)).trim().slice(0, 10);
        const name = (r[nameIdx] || 'Unknown Fund').trim();
        const symbol = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30);
        const quantity = Math.abs(normalizeNumber(r[unitsIdx]));
        const price = normalizeNumber(r[navIdx]);
        const amount = amtIdx !== -1 ? Math.abs(normalizeNumber(r[amtIdx])) : quantity * price;
        const folio = folioIdx !== -1 ? r[folioIdx] : '';
        const txHash = `${broker}_${symbol}_${txDate}_${txType}_${quantity}_${price}_${folio}`;

        if (quantity <= 0) continue;

        const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
        if (checkRes.length > 0 && checkRes[0].values.length > 0) {
          duplicates++;
          continue;
        }

        db.run(
          `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?)`,
          [broker, symbol, name, txType, txDate, quantity, price, amount, txHash]
        );
        newTxns++;
      }

      db.run(`DELETE FROM holdings WHERE broker = ?`, [broker]);

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
             VALUES (?, 'MUTUAL_FUND', ?, ?, ?, ?, ?, ?)`,
            [broker, h.symbol, h.name, h.currency || 'INR', h.net_qty, avgPrice, avgPrice]
          );
          updatedCount++;
        }
      }
      hStmt.free();

      db.run('COMMIT');

      const result: CsvImportResult = {
        broker,
        importType: 'TRADEBOOK',
        newTransactionsAdded: newTxns,
        duplicatesSkipped: duplicates,
        holdingsUpdated: updatedCount,
        errors,
      };
      onComplete(result);
      return result;
    }

    // 3. Interactive Brokers (IBKR Multi-section Activity Statement)
    if (lowerBroker.includes('interactivebrokers') || lowerBroker.includes('ibkr')) {
      const allRows = parseCsvLines(text, ',');
      if (allRows.length < 2) throw new Error('IBKR CSV is empty or invalid.');

      const headerRow = allRows.find(
        (r) => r[0]?.trim() === 'Transaction History' && r[1]?.trim() === 'Header'
      );

      if (!headerRow) {
        throw new Error('Could not find "Transaction History,Header" section in IBKR CSV.');
      }

      const sectionHeaders = headerRow.slice(2).map((h) => h.trim().toLowerCase());
      const dateIdx = sectionHeaders.findIndex((h) => h.includes('date'));
      const descIdx = sectionHeaders.findIndex((h) => h.includes('description'));
      const typeIdx = sectionHeaders.findIndex((h) => h.includes('transaction type') || h.includes('type'));
      const symIdx = sectionHeaders.findIndex((h) => h.includes('symbol'));
      const qtyIdx = sectionHeaders.findIndex((h) => h.includes('quantity') || h.includes('qty'));
      const priceIdx = sectionHeaders.findIndex((h) => h.includes('price') && !h.includes('currency'));
      const currIdx = sectionHeaders.findIndex((h) => h.includes('price currency') || h.includes('currency'));
      const amtIdx = sectionHeaders.findIndex((h) => h.includes('net amount') || h.includes('gross amount'));

      const dataRows = allRows.filter(
        (r) => r[0]?.trim() === 'Transaction History' && r[1]?.trim() === 'Data'
      );

      for (const rawRow of dataRows) {
        const r = rawRow.slice(2);
        if (!r || r.length < 5) continue;

        const rawType = (r[typeIdx] || 'Buy').trim().toUpperCase();
        let txType = 'BUY';
        if (rawType.includes('SELL')) txType = 'SELL';
        else if (rawType.includes('DIVIDEND')) txType = 'DIVIDEND';
        else if (!rawType.includes('BUY')) continue;

        const txDate = (r[dateIdx] || new Date().toISOString().slice(0, 10)).trim().slice(0, 10);
        const symbol = (r[symIdx] || '').trim().toUpperCase();
        const name = (r[descIdx] || symbol).trim();
        const quantity = Math.abs(normalizeNumber(r[qtyIdx]));
        const price = normalizeNumber(r[priceIdx]);
        const currency = (r[currIdx] || 'USD').trim().toUpperCase();
        const rawAmount = amtIdx !== -1 ? Math.abs(normalizeNumber(r[amtIdx])) : quantity * price;

        if (!symbol || (quantity <= 0 && txType !== 'DIVIDEND')) continue;

        const txHash = `${broker}_${symbol}_${txDate}_${txType}_${quantity}_${price}_${currency}`;

        const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
        if (checkRes.length > 0 && checkRes[0].values.length > 0) {
          duplicates++;
          continue;
        }

        db.run(
          `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [broker, symbol, name, txType, txDate, quantity, price, rawAmount, currency, txHash]
        );
        newTxns++;
      }

      db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [broker]);

      const hStmt = db.prepare(`
        SELECT 
          symbol, name, currency,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity WHEN tx_type = 'SELL' THEN -quantity ELSE 0 END) as net_qty,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
          SUM(CASE WHEN tx_type = 'BUY' THEN quantity ELSE 0 END) as buy_qty
        FROM transactions
        WHERE broker = '${safeBroker}'
        GROUP BY symbol, currency
      `);

      let updatedCount = 0;
      while (hStmt.step()) {
        const h = hStmt.getAsObject() as any;
        if (h.net_qty > 0) {
          const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
          db.run(
            `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
             VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?)`,
            [broker, h.symbol, h.name, h.currency || 'USD', h.net_qty, avgPrice, avgPrice]
          );
          updatedCount++;
        }
      }
      hStmt.free();

      db.run('COMMIT');

      const result: CsvImportResult = {
        broker,
        importType: 'TRADEBOOK',
        newTransactionsAdded: newTxns,
        duplicatesSkipped: duplicates,
        holdingsUpdated: updatedCount,
        errors,
      };
      onComplete(result);
      return result;
    }

    // 4. Standard Generic CSV Fallback
    const delimiter = text.includes(';') ? ';' : ',';
    const rows = parseCsvLines(text, delimiter);
    if (rows.length < 2) throw new Error('CSV is empty or invalid.');

    const headers = rows[0].map((h) => h.toLowerCase());
    const symIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('scrip') || h.includes('instrument'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('action'));
    const qtyIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('qty'));
    const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('avg. cost'));
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const currIdx = headers.findIndex((h) => h.includes('currency') || h.includes('valuta'));

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
      const currency = (currIdx !== -1 && r[currIdx] ? r[currIdx].trim().toUpperCase() : 'SEK');
      const txDate = (r[dateIdx] || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const txHash = `${broker}_${symbol}_${txDate}_${txType}_${quantity}_${price}_${currency}`;

      if (quantity <= 0) continue;

      const checkRes = db.exec(`SELECT id FROM transactions WHERE tx_hash = ?`, [txHash]);
      if (checkRes.length > 0 && checkRes[0].values.length > 0) {
        duplicates++;
        continue;
      }

      db.run(
        `INSERT INTO transactions (broker, symbol, name, tx_type, tx_date, quantity, price, amount, currency, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [broker, symbol, symbol, txType, txDate, quantity, price, amount, currency, txHash]
      );
      newTxns++;
    }

    db.run(`DELETE FROM holdings WHERE broker = ? AND category = 'EQUITY'`, [broker]);

    const hStmt = db.prepare(`
      SELECT 
        symbol, name, currency,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity WHEN tx_type = 'SELL' THEN -quantity ELSE 0 END) as net_qty,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity * price ELSE 0 END) as total_cost,
        SUM(CASE WHEN tx_type = 'BUY' THEN quantity ELSE 0 END) as buy_qty
      FROM transactions
      WHERE broker = '${safeBroker}'
      GROUP BY symbol, currency
    `);

    let updatedCount = 0;
    while (hStmt.step()) {
      const h = hStmt.getAsObject() as any;
      if (h.net_qty > 0) {
        const avgPrice = h.buy_qty > 0 ? h.total_cost / h.buy_qty : 0;
        db.run(
          `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price)
           VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?)`,
          [broker, h.symbol, h.name, h.currency || 'SEK', h.net_qty, avgPrice, avgPrice]
        );
        updatedCount++;
      }
    }
    hStmt.free();

    db.run('COMMIT');

    const result: CsvImportResult = {
      broker,
      importType: 'TRADEBOOK',
      newTransactionsAdded: newTxns,
      duplicatesSkipped: duplicates,
      holdingsUpdated: updatedCount,
      errors,
    };
    onComplete(result);
    return result;
  } catch (err: any) {
    db.run('ROLLBACK');
    throw new Error(`CSV Import failed: ${err?.message || err}`);
  }
}