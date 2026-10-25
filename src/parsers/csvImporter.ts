import Papa from 'papaparse';
import { Database } from 'sql.js';
import { BrokerType } from '../types';
import { parseNumber } from '../db/database';

export function importBrokerCsv(
  file: File,
  broker: BrokerType,
  db: Database,
  onComplete: (importedCount: number) => void
) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      let count = 0;
      db.run('BEGIN TRANSACTION');
      const upsertSql = `
        INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price, updated_at)
        VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(broker, symbol) DO UPDATE SET
          quantity = excluded.quantity,
          avg_price = excluded.avg_price,
          market_price = excluded.market_price,
          updated_at = CURRENT_TIMESTAMP
      `;

      for (const row of results.data) {
        if (broker === 'AVANZA') {
          const symbol = row['Kortnamn'] || row['ISIN'] || row['Namn'] || row['Värdepapper'];
          const name = row['Värdepapper'] || row['Namn'] || symbol;
          const qty = parseNumber(row['Antal'] || row['Volym']);
          const avg = parseNumber(row['GAV'] || row['Inköpskurs']);
          const price = parseNumber(row['Kurs'] || row['Senast']) || avg;
          const curr = row['Valuta'] || 'SEK';
          if (symbol && qty > 0) {
            db.run(upsertSql, ['Avanza', symbol, name, curr, qty, avg, price]);
            count++;
          }
        } else if (broker === 'ZERODHA') {
          const symbol = row['Instrument'] || row['Symbol'];
          const qty = parseNumber(row['Qty.'] || row['Quantity']);
          const avg = parseNumber(row['Avg. cost'] || row['Average Price']);
          const price = parseNumber(row['LTP'] || row['Close Price']) || avg;
          if (symbol && qty > 0) {
            db.run(upsertSql, ['Zerodha', `${symbol}.NS`, symbol, 'INR', qty, avg, price]);
            count++;
          }
        } else if (broker === 'IBKR') {
          const symbol = row['Symbol'];
          const name = row['Description'] || symbol;
          const qty = parseNumber(row['Quantity'] || row['Position']);
          const avg = parseNumber(row['CostBasisPrice'] || row['Cost Basis Price']);
          const price = parseNumber(row['MarkPrice'] || row['Mark Price']) || avg;
          const curr = row['CurrencyPrimary'] || row['Currency'] || 'USD';
          if (symbol && qty > 0) {
            db.run(upsertSql, ['Interactive Brokers', symbol, name, curr, qty, avg, price]);
            count++;
          }
        }
      }
      db.run('COMMIT');
      onComplete(count);
    },
  });
}
