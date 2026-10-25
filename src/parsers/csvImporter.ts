import Papa from 'papaparse';
import type { Database } from 'sql.js';
import { BrokerType } from '../types';
import { parseNumber } from '../db/database';

export function importBrokerCsv(
  file: File,
  broker: BrokerType,
  db: Database,
  onComplete: (importedCount: number) => void
) {
  // European brokers (Avanza, Nordnet) use semicolons (;) as delimiters
  const isEuropean = broker === 'AVANZA' || broker === 'NORDNET';

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: isEuropean ? ';' : '', // Auto-detect or force semicolon for Nordic brokers
    transformHeader: (header) => header.trim().replace(/^\ufeff/, ''), // Remove BOM if present
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
        // Skip empty summary rows
        if (!row || Object.keys(row).length === 0) continue;

        if (broker === 'AVANZA') {
          const symbol = row['Kortnamn'] || row['ISIN'] || row['Namn'] || row['Värdepapper'];
          const name = row['Värdepapper'] || row['Namn'] || symbol;
          const qty = parseNumber(row['Antal'] || row['Volym'] || row['Antal aktier']);
          const avg = parseNumber(row['GAV'] || row['Inköpskurs'] || row['Genomsnittskurs']);
          const price = parseNumber(row['Kurs'] || row['Senast'] || row['Aktuellt pris']) || avg;
          const curr = row['Valuta'] || 'SEK';

          if (symbol && qty > 0) {
            db.run(upsertSql, ['Avanza', symbol.trim(), name.trim(), curr.trim(), qty, avg, price]);
            count++;
          }
        } else if (broker === 'NORDNET') {
          const symbol = row['Symbol'] || row['Instrument'] || row['Namn'] || row['Värdepapper'];
          const name = row['Namn'] || row['Instrument'] || symbol;
          const qty = parseNumber(row['Antal'] || row['Volume'] || row['Innehav']);
          const avg = parseNumber(row['GAV'] || row['G.A.V.'] || row['Inköpspris'] || row['Anskaffningsvärde']);
          const price = parseNumber(row['Senaste'] || row['Aktuell kurs'] || row['Market Price']) || avg;
          const curr = row['Valuta'] || 'SEK';

          if (symbol && qty > 0) {
            db.run(upsertSql, ['Nordnet', symbol.trim(), name.trim(), curr.trim(), qty, avg, price]);
            count++;
          }
        } else if (broker === 'ZERODHA') {
          const symbol = row['Instrument'] || row['Symbol'];
          const qty = parseNumber(row['Qty.'] || row['Quantity']);
          const avg = parseNumber(row['Avg. cost'] || row['Average Price']);
          const price = parseNumber(row['LTP'] || row['Close Price']) || avg;

          if (symbol && qty > 0) {
            const cleanSym = symbol.trim();
            const formattedSym = cleanSym.endsWith('.NS') || cleanSym.endsWith('.BO') ? cleanSym : `${cleanSym}.NS`;
            db.run(upsertSql, ['Zerodha', formattedSym, cleanSym, 'INR', qty, avg, price]);
            count++;
          }
        } else if (broker === 'UPSTOX') {
          const symbol = row['Symbol'] || row['Instrument'];
          const qty = parseNumber(row['Quantity'] || row['Qty']);
          const avg = parseNumber(row['Average Price'] || row['Avg. price']);
          const price = parseNumber(row['LTP'] || row['Last Traded Price']) || avg;

          if (symbol && qty > 0) {
            const cleanSym = symbol.trim();
            const formattedSym = cleanSym.endsWith('.NS') || cleanSym.endsWith('.BO') ? cleanSym : `${cleanSym}.NS`;
            db.run(upsertSql, ['Upstox', formattedSym, cleanSym, 'INR', qty, avg, price]);
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
            db.run(upsertSql, ['Interactive Brokers', symbol.trim(), name.trim(), curr.trim(), qty, avg, price]);
            count++;
          }
        }
      }
      db.run('COMMIT');
      onComplete(count);
    },
    error: (err) => {
      console.error('CSV Parse Error:', err);
      alert('Failed to parse CSV file. Please check format.');
    }
  });
}