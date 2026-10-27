import type { Database } from 'sql.js';
import { CurrencyCode, CsvImportResult } from '../types';

export interface ParsedFdItem {
  id: string;
  broker: string;
  name: string;
  currency: CurrencyCode;
  principal: number;
  interestRate: number;
  compoundingFreq: number;
  startDate: string;
  maturityDate: string;
}

function normalizeNumber(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses raw text from clipboard (tab-separated from Excel or comma-separated)
 */
export function parsePastedFdRows(rawText: string): ParsedFdItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedFdItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Split by tab (Excel/Sheets clipboard) or comma
    const cols = line.includes('\t') ? line.split('\t') : line.split(',');

    // Skip possible header rows
    if (i === 0 && /(bank|institution|principal|amount|rate)/i.test(line)) {
      continue;
    }

    if (cols.length < 3) continue;

    const broker = cols[0]?.trim() || 'Bank';
    const name = cols[1]?.trim() || 'Fixed Deposit';
    const principal = normalizeNumber(cols[2]);
    const interestRate = cols[3] ? normalizeNumber(cols[3]) : 3.5;
    const rawCurrency = (cols[4]?.trim().toUpperCase() || 'SEK') as CurrencyCode;
    const currency = ['SEK', 'INR', 'USD', 'EUR'].includes(rawCurrency) ? rawCurrency : 'SEK';
    const maturityDate = cols[5]?.trim() || '';
    const startDate = cols[6]?.trim() || new Date().toISOString().slice(0, 10);
    const compoundingFreq = parseInt(cols[7] || '4', 10) || 4;

    if (principal > 0) {
      parsed.push({
        id: `paste_${Date.now()}_${i}`,
        broker,
        name,
        currency,
        principal,
        interestRate,
        compoundingFreq,
        startDate,
        maturityDate,
      });
    }
  }

  return parsed;
}

/**
 * Inserts parsed FD items in bulk into the holdings table
 */
export function saveBulkFdsToDb(db: Database, items: ParsedFdItem[]): number {
  let count = 0;
  db.run('BEGIN TRANSACTION');

  try {
    for (const item of items) {
      const symbol = `FD_${item.broker.toUpperCase()}_${Date.now()}_${count}`;
      db.run(
        `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date, quantity, avg_price, market_price)
         VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          item.broker,
          symbol,
          item.name,
          item.currency,
          item.principal,
          item.interestRate,
          item.compoundingFreq,
          item.startDate,
          item.maturityDate,
          item.principal,
          item.principal,
        ]
      );
      count++;
    }
    db.run('COMMIT');
    return count;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}