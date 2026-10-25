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

// Case-insensitive & encoding-safe column lookup
function getCol(row: Record<string, string>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const target = c.toLowerCase();
    // 1. Exact match (case-insensitive)
    const exact = keys.find((k) => k.toLowerCase().trim() === target);
    if (exact && row[exact] !== undefined && row[exact] !== '') {
      return row[exact].trim();
    }
    // 2. Partial match (handles "Värdepapper/beskrivning" or ISO-8859-1 garbled characters)
    const partial = keys.find((k) => k.toLowerCase().includes(target));
    if (partial && row[partial] !== undefined && row[partial] !== '') {
      return row[partial].trim();
    }
  }
  return '';
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

      // Avanza & Nordnet export newest transactions at the top (e.g., 2026-10-21 then 2026-10-20).
      // Reverse the array so we replay buys/sells chronologically from oldest to newest
      // and capture the most recent transaction's "Kurs" as the latest marketPrice.
      const rows = [...results.data].reverse();

      for (const row of rows) {
        if (!row || Object.keys(row).length === 0) continue;

        if (broker === 'AVANZA') {
          const type = getCol(row, ['Typ av transaktion', 'Transaktionstyp']).toLowerCase();
          const rawName = getCol(row, [
            'Värdepapper/beskrivning',
            'rdepapper/beskrivning',
            'Värdepapper',
            'rdepapper',
            'Namn',
            'Beskrivning',
          ]);
          const isin = getCol(row, ['ISIN', 'Kortnamn']);

          // Ignore cash deposits/withdrawals/taxes that have no security or ISIN
          if (!rawName && !isin) continue;

          const qty = parseNumber(getCol(row, ['Antal', 'Volym']));
          const amount = parseNumber(getCol(row, ['Belopp']));
          const price = parseNumber(getCol(row, ['Kurs', 'Inköpskurs', 'Senast'])) || 0;
          const curr =
            getCol(row, ['Instrumentvaluta', 'Transaktionsvaluta', 'Valuta']) || 'SEK';

          const isBuy =
            type.includes('köp') ||
            type.includes('kop') ||
            type.includes('buy') ||
            type.includes('teckning') ||
            type.includes('inbyte');
          const isSell =
            type.includes('sälj') ||
            type.includes('salj') ||
            type.includes('sell') ||
            type.includes('uttag');
          const isSplitOrTransfer =
            type.includes('delning') ||
            type.includes('split') ||
            type.includes('överföring') ||
            type.includes('inlägg');

          // Skip rows like pure dividends (Utdelning) that have 0 quantity
          if (!isBuy && !isSell && !isSplitOrTransfer && qty === 0) continue;

          const name = rawName || isin;
          const symbol = isin || name;
          const key = symbol;

          let entry = holdingsMap.get(key);
          if (!entry) {
            entry = {
              brokerName: 'Avanza',
              symbol,
              name,
              currency: curr,
              totalQty: 0,
              totalCost: 0,
              marketPrice: price || 0,
            };
            holdingsMap.set(key, entry);
          } else if (rawName) {
            entry.name = rawName;
          }

          if (isBuy && qty !== 0) {
            const absQty = Math.abs(qty);
            const costAdded = amount !== 0 ? Math.abs(amount) : absQty * price;
            entry.totalQty += absQty;
            entry.totalCost += costAdded;
          } else if (isSell && qty !== 0) {
            const sellQty = Math.abs(qty);
            const currentAvg = entry.totalQty > 0 ? entry.totalCost / entry.totalQty : 0;
            entry.totalQty = Math.max(0, entry.totalQty - sellQty);
            entry.totalCost = Math.max(0, entry.totalQty * currentAvg);
          } else if (isSplitOrTransfer && qty !== 0) {
            entry.totalQty += qty;
          }

          if (price > 0) {
            entry.marketPrice = price;
          }
        } else if (broker === 'NORDNET') {
          const type = getCol(row, ['Transaktionstyp', 'Typ']).toLowerCase();
          const rawName = getCol(row, ['Värdepapper', 'Namn', 'Instrument']);
          const isin = getCol(row, ['ISIN', 'Symbol', 'Kortnamn']);

          if (!rawName && !isin) continue;

          const name = rawName || isin;
          const symbol = isin || name;
          const qty = parseNumber(getCol(row, ['Antal', 'Volume', 'Innehav']));
          const amount = parseNumber(getCol(row, ['Belopp', 'Summa']));
          const price = parseNumber(getCol(row, ['Kurs', 'Pris', 'Senaste'])) || 0;
          const curr = getCol(row, ['Valuta', 'Instrumentvaluta']) || 'SEK';

          let entry = holdingsMap.get(symbol);
          if (!entry) {
            entry = {
              brokerName: 'Nordnet',
              symbol,
              name,
              currency: curr,
              totalQty: 0,
              totalCost: 0,
              marketPrice: price || 0,
            };
            holdingsMap.set(symbol, entry);
          } else if (rawName) {
            entry.name = rawName;
          }

          if (type.includes('köp') || type.includes('kop') || type.includes('buy')) {
            const absQty = Math.abs(qty);
            entry.totalQty += absQty;
            entry.totalCost += amount !== 0 ? Math.abs(amount) : absQty * price;
          } else if (type.includes('sälj') || type.includes('salj') || type.includes('sell')) {
            const sellQty = Math.abs(qty);
            const currentAvg = entry.totalQty > 0 ? entry.totalCost / entry.totalQty : 0;
            entry.totalQty = Math.max(0, entry.totalQty - sellQty);
            entry.totalCost = Math.max(0, entry.totalQty * currentAvg);
          } else if (!type && qty > 0) {
            // Direct holdings export
            entry.totalQty = qty;
            const gav = parseNumber(getCol(row, ['GAV', 'Inköpspris'])) || price;
            entry.totalCost = qty * gav;
          }

          if (price > 0) entry.marketPrice = price;
        } else if (broker === 'ZERODHA' || broker === 'UPSTOX') {
          const symbol = getCol(row, ['Instrument', 'Symbol']);
          const qty = parseNumber(getCol(row, ['Qty.', 'Quantity', 'Qty']));
          const avg = parseNumber(getCol(row, ['Avg. cost', 'Average Price', 'Avg. price']));
          const price =
            parseNumber(getCol(row, ['LTP', 'Close Price', 'Last Traded Price'])) || avg;

          if (symbol && qty > 0) {
            const formattedSym =
              symbol.endsWith('.NS') || symbol.endsWith('.BO') ? symbol : `${symbol}.NS`;
            holdingsMap.set(symbol, {
              brokerName: broker === 'ZERODHA' ? 'Zerodha' : 'Upstox',
              symbol: formattedSym,
              name: symbol,
              currency: 'INR',
              totalQty: qty,
              totalCost: qty * avg,
              marketPrice: price,
            });
          }
        } else if (broker === 'IBKR') {
          const symbol = getCol(row, ['Symbol']);
          const name = getCol(row, ['Description']) || symbol;
          const qty = parseNumber(getCol(row, ['Quantity', 'Position']));
          const avg = parseNumber(getCol(row, ['CostBasisPrice', 'Cost Basis Price']));
          const price = parseNumber(getCol(row, ['MarkPrice', 'Mark Price'])) || avg;
          const curr = getCol(row, ['CurrencyPrimary', 'Currency']) || 'USD';

          if (symbol && qty > 0) {
            holdingsMap.set(symbol, {
              brokerName: 'Interactive Brokers',
              symbol,
              name,
              currency: curr,
              totalQty: qty,
              totalCost: qty * avg,
              marketPrice: price,
            });
          }
        }
      }

      let count = 0;
      db.run('BEGIN TRANSACTION');
      const upsertSql = `
        INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price, updated_at)
        VALUES (?, 'EQUITY', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(broker, symbol) DO UPDATE SET
          name = excluded.name,
          currency = excluded.currency,
          quantity = excluded.quantity,
          avg_price = excluded.avg_price,
          market_price = CASE WHEN excluded.market_price > 0 THEN excluded.market_price ELSE holdings.market_price END,
          updated_at = CURRENT_TIMESTAMP
      `;

      for (const [_, h] of holdingsMap) {
        if (h.totalQty > 0.0001) {
          const cleanQty = Number(h.totalQty.toFixed(4));
          const avgPrice = cleanQty > 0 ? h.totalCost / cleanQty : 0;
          const marketPrice = h.marketPrice > 0 ? h.marketPrice : avgPrice;

          db.run(upsertSql, [
            h.brokerName,
            h.symbol,
            h.name,
            h.currency,
            cleanQty,
            avgPrice,
            marketPrice,
          ]);
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