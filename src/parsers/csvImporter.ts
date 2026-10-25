import Papa from 'papaparse';
import type { Database } from 'sql.js';
import { BrokerType } from '../types';
import { parseNumber } from '../db/database';

interface HoldingAccumulator {
  brokerName: string;
  symbol: string;
  name: string;
  currency: string;
  totalQty: number;
  totalCost: number;
  marketPrice: number;
}

export function importBrokerCsv(
  file: File,
  broker: BrokerType,
  db: Database,
  onComplete: (importedCount: number) => void
) {
  const isEuropean = broker === 'AVANZA' || broker === 'NORDNET';

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: isEuropean ? ';' : '',
    transformHeader: (header) => header.trim().replace(/^\ufeff/, ''),
    complete: (results) => {
      const holdingsMap = new Map<string, HoldingAccumulator>();

      for (const row of results.data) {
        if (!row || Object.keys(row).length === 0) continue;

        if (broker === 'AVANZA') {
          const type = (row['Typ av transaktion'] || row['Transaktionstyp'] || '').toLowerCase();
          const symbol = row['Kortnamn'] || row['ISIN'] || row['Värdepapper'];
          const name = row['Värdepapper'] || symbol;
          const qty = parseNumber(row['Antal']);
          const amount = parseNumber(row['Belopp']);
          const price = parseNumber(row['Kurs']) || 0;
          const curr = row['Valuta'] || 'SEK';

          if (!symbol) continue;

          let entry = holdingsMap.get(symbol);
          if (!entry) {
            entry = { brokerName: 'Avanza', symbol: symbol.trim(), name: name.trim(), currency: curr.trim(), totalQty: 0, totalCost: 0, marketPrice: price || 0 };
            holdingsMap.set(symbol, entry);
          }

          if (type.includes('köp') || type.includes('buy')) {
            entry.totalQty += qty;
            entry.totalCost += Math.abs(amount);
            if (price > 0) entry.marketPrice = price;
          } else if (type.includes('sälj') || type.includes('sell')) {
            entry.totalQty -= qty;
            entry.totalCost -= Math.abs(amount);
          }
          if (price > 0) entry.marketPrice = price;
        } else if (broker === 'NORDNET') {
          const type = (row['Transaktionstyp'] || row['Typ'] || '').toLowerCase();
          const symbol = row['Symbol'] || row['Instrument'] || row['Namn'];
          const name = row['Namn'] || symbol;
          const qty = parseNumber(row['Antal'] || row['Volume']);
          const amount = parseNumber(row['Belopp'] || row['Summa']);
          const price = parseNumber(row['Kurs'] || row['Pris']) || 0;
          const curr = row['Valuta'] || 'SEK';

          if (!symbol) continue;

          let entry = holdingsMap.get(symbol);
          if (!entry) {
            entry = { brokerName: 'Nordnet', symbol: symbol.trim(), name: name.trim(), currency: curr.trim(), totalQty: 0, totalCost: 0, marketPrice: price || 0 };
            holdingsMap.set(symbol, entry);
          }

          if (type.includes('köp') || type.includes('buy')) {
            entry.totalQty += qty;
            entry.totalCost += Math.abs(amount);
          } else if (type.includes('sälj') || type.includes('sell')) {
            entry.totalQty -= qty;
            entry.totalCost -= Math.abs(amount);
          }
          if (price > 0) entry.marketPrice = price;
        } else if (broker === 'ZERODHA' || broker === 'UPSTOX') {
          const symbol = row['Instrument'] || row['Symbol'];
          const qty = parseNumber(row['Qty.'] || row['Quantity'] || row['Qty']);
          const avg = parseNumber(row['Avg. cost'] || row['Average Price'] || row['Avg. price']);
          const price = parseNumber(row['LTP'] || row['Close Price'] || row['Last Traded Price']) || avg;

          if (symbol && qty > 0) {
            const cleanSym = symbol.trim();
            const formattedSym = cleanSym.endsWith('.NS') || cleanSym.endsWith('.BO') ? cleanSym : `${cleanSym}.NS`;
            holdingsMap.set(cleanSym, {
              brokerName: broker === 'ZERODHA' ? 'Zerodha' : 'Upstox',
              symbol: formattedSym,
              name: cleanSym,
              currency: 'INR',
              totalQty: qty,
              totalCost: qty * avg,
              marketPrice: price,
            });
          }
        } else if (broker === 'IBKR') {
          const symbol = row['Symbol'];
          const name = row['Description'] || symbol;
          const qty = parseNumber(row['Quantity'] || row['Position']);
          const avg = parseNumber(row['CostBasisPrice'] || row['Cost Basis Price']);
          const price = parseNumber(row['MarkPrice'] || row['Mark Price']) || avg;
          const curr = row['CurrencyPrimary'] || row['Currency'] || 'USD';

          if (symbol && qty > 0) {
            holdingsMap.set(symbol, {
              brokerName: 'Interactive Brokers',
              symbol: symbol.trim(),
              name: name.trim(),
              currency: curr.trim(),
              totalQty: qty,
              totalCost: qty * avg,
              marketPrice: price,
            });
          }
        }
      }

      // Write aggregated net holdings into database
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

      for (const [_, h] of holdingsMap) {
        if (h.totalQty > 0) {
          const avgPrice = h.totalQty > 0 ? h.totalCost / h.totalQty : h.marketPrice;
          db.run(upsertSql, [h.brokerName, h.symbol, h.name, h.currency, h.totalQty, avgPrice, h.marketPrice || avgPrice]);
          count++;
        }
      }
      db.run('COMMIT');
      onComplete(count);
    },
    error: (err) => {
      console.error('CSV Parse Error:', err);
      alert('Failed to parse CSV file.');
    },
  });
}