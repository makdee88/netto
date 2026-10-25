import Papa from 'papaparse';
import type { Database } from 'sql.js';
import { BrokerType, CsvImportResult } from '../types';
import { parseNumber, recalculateHoldingsFromTransactions } from '../db/database';

function getCol(row: Record<string, string>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const target = c.toLowerCase();
    const exact = keys.find((k) => k.toLowerCase().trim() === target);
    if (exact && row[exact] !== undefined && row[exact] !== '') {
      return row[exact].trim();
    }
    const partial = keys.find((k) => k.toLowerCase().includes(target));
    if (partial && row[partial] !== undefined && row[partial] !== '') {
      return row[partial].trim();
    }
  }
  return '';
}

const BROKER_LABELS: Record<BrokerType, string> = {
  AVANZA: 'Avanza',
  NORDNET: 'Nordnet',
  ZERODHA: 'Zerodha',
  UPSTOX: 'Upstox',
  IBKR: 'Interactive Brokers',
};

export function importBrokerCsv(
  file: File,
  broker: BrokerType,
  db: Database,
  onComplete: (result: CsvImportResult) => void
) {
  const isEuropean = broker === 'AVANZA' || broker === 'NORDNET';
  const brokerName = BROKER_LABELS[broker];

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: isEuropean ? ';' : '',
    transformHeader: (header) => header.trim().replace(/^\ufeff/, ''),
    complete: (results) => {
      const rows = [...results.data].reverse(); // Oldest to newest
      let newTransactionsAdded = 0;
      let duplicateTransactionsSkipped = 0;
      let usedTransactionLedger = false;

      const fileOccurrenceCounter = new Map<string, number>();

      const insertTxSql = `
        INSERT OR IGNORE INTO transactions
          (tx_hash, broker, account, tx_date, tx_type, symbol, name, quantity, price, amount, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const snapshotUpsertSql = `
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

      let snapshotHoldingsCount = 0;

      db.run('BEGIN TRANSACTION');

      for (const row of rows) {
        if (!row || Object.keys(row).length === 0) continue;

        const txDate = getCol(row, ['Datum', 'Bokföringsdag', 'Affärsdag', 'Trade Date', 'Date']);
        const rawType = getCol(row, ['Typ av transaktion', 'Transaktionstyp', 'Typ', 'Trade Type', 'Type']).toLowerCase();

        if (txDate && rawType) {
          usedTransactionLedger = true;

          const rawName = getCol(row, [
            'Värdepapper/beskrivning',
            'Värdepapper',
            'Namn',
            'Instrument',
            'Description',
            'Symbol',
          ]);
          const isin = getCol(row, ['ISIN', 'Kortnamn', 'Symbol', 'Instrument']);

          if (!rawName && !isin) continue;

          const account = getCol(row, ['Konto', 'Account', 'Depå']) || 'Default';
          const qty = parseNumber(getCol(row, ['Antal', 'Volym', 'Quantity', 'Qty.', 'Qty']));
          const price = parseNumber(getCol(row, ['Kurs', 'Pris', 'Inköpskurs', 'Price'])) || 0;
          const amount = parseNumber(getCol(row, ['Belopp', 'Summa', 'Amount'])) || 0;
          const curr =
            getCol(row, ['Instrumentvaluta', 'Transaktionsvaluta', 'Valuta', 'Currency']) ||
            (broker === 'ZERODHA' || broker === 'UPSTOX' ? 'INR' : broker === 'IBKR' ? 'USD' : 'SEK');

          const isBuy =
            rawType.includes('köp') ||
            rawType.includes('kop') ||
            rawType.includes('buy') ||
            rawType.includes('teckning') ||
            rawType.includes('inbyte');
          const isSell =
            rawType.includes('sälj') ||
            rawType.includes('salj') ||
            rawType.includes('sålt') ||
            rawType.includes('salt') ||
            rawType.includes('sell') ||
            rawType.includes('uttag');
          const isSplit =
            rawType.includes('delning') ||
            rawType.includes('split') ||
            rawType.includes('överföring') ||
            rawType.includes('inlägg');

          if (!isBuy && !isSell && !isSplit) continue;
          if (qty === 0) continue;

          const normalizedType: 'BUY' | 'SELL' | 'SPLIT' = isBuy ? 'BUY' : isSell ? 'SELL' : 'SPLIT';
          const name = rawName || isin;
          // Use ISIN as the primary immutable symbol/key so all buys/sells group together
          let symbol = isin || name;

          if ((broker === 'ZERODHA' || broker === 'UPSTOX') && !symbol.endsWith('.NS') && !symbol.endsWith('.BO')) {
            symbol = `${symbol}.NS`;
          }

          const baseSig = `${brokerName}|${account}|${txDate}|${normalizedType}|${symbol}|${Math.abs(qty).toFixed(4)}|${price.toFixed(4)}|${Math.abs(amount).toFixed(2)}`;
          const occurrence = (fileOccurrenceCounter.get(baseSig) || 0) + 1;
          fileOccurrenceCounter.set(baseSig, occurrence);
          const txHash = `${baseSig}#${occurrence}`;

          const existing = db.exec(`SELECT 1 FROM transactions WHERE tx_hash = ?`, [txHash]);
          if (existing.length > 0 && existing[0].values.length > 0) {
            duplicateTransactionsSkipped++;
          } else {
            db.run(insertTxSql, [
              txHash,
              brokerName,
              account,
              txDate,
              normalizedType,
              symbol,
              name,
              Math.abs(qty),
              price,
              Math.abs(amount),
              curr,
            ]);
            newTransactionsAdded++;
          }
        } else {
          const rawName = getCol(row, [
            'Värdepapper/beskrivning',
            'Värdepapper',
            'Description',
            'Namn',
            'Instrument',
            'Symbol',
          ]);
          const isin = getCol(row, ['ISIN', 'Symbol', 'Instrument', 'Kortnamn']);
          const qty = parseNumber(getCol(row, ['Qty.', 'Quantity', 'Qty', 'Position', 'Antal']));
          const avg = parseNumber(getCol(row, ['Avg. cost', 'Average Price', 'Avg. price', 'CostBasisPrice', 'Cost Basis Price', 'GAV']));
          const price = parseNumber(getCol(row, ['LTP', 'Close Price', 'Last Traded Price', 'MarkPrice', 'Mark Price', 'Kurs', 'Senast'])) || avg;
          const curr =
            getCol(row, ['Instrumentvaluta', 'Valuta', 'CurrencyPrimary', 'Currency']) ||
            (broker === 'ZERODHA' || broker === 'UPSTOX' ? 'INR' : broker === 'IBKR' ? 'USD' : 'SEK');

          if ((rawName || isin) && qty > 0) {
            const name = rawName || isin;
            let symbol = isin || name;
            if ((broker === 'ZERODHA' || broker === 'UPSTOX') && !symbol.endsWith('.NS') && !symbol.endsWith('.BO')) {
              symbol = `${symbol}.NS`;
            }
            db.run(snapshotUpsertSql, [brokerName, symbol, name, curr, qty, avg, price || avg]);
            snapshotHoldingsCount++;
          }
        }
      }

      let holdingsUpdated = snapshotHoldingsCount;
      if (usedTransactionLedger) {
        holdingsUpdated = recalculateHoldingsFromTransactions(db, brokerName);
      }

      db.run('COMMIT');

      onComplete({
        broker: brokerName,
        mode: usedTransactionLedger ? 'TRANSACTIONS' : 'SNAPSHOT',
        totalRowsRead: results.data.length,
        newTransactionsAdded,
        duplicateTransactionsSkipped,
        holdingsUpdated,
      });
    },
    error: (err) => {
      console.error('CSV Parse Error:', err);
      alert('Failed to parse CSV file.');
    },
  });
}