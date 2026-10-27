import type { Database } from 'sql.js';
import { CurrencyCode } from '../types';

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

function normalizeDate(str: string): string {
  if (!str) return '';
  const clean = str.trim();
  // If in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  // If DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

/**
 * Parses raw text from clipboard (tab-separated from Excel or comma/semicolon-separated).
 * Standard expected column order:
 * Bank | Deposit Name | Principal | Rate % | Currency | Start Date | Maturity Date | Compounding
 */
export function parsePastedFdRows(rawText: string): ParsedFdItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: ParsedFdItem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.includes('\t')
      ? line.split('\t')
      : line.includes(';')
      ? line.split(';')
      : line.split(',');

    // Skip potential header rows
    if (i === 0 && /(bank|institution|principal|amount|rate|deposit)/i.test(line)) {
      continue;
    }

    if (cols.length < 3) continue;

    const broker = cols[0]?.trim() || 'Bank';
    const name = cols[1]?.trim() || 'Fixed Deposit';
    const principal = normalizeNumber(cols[2]);
    const interestRate = cols[3] ? normalizeNumber(cols[3]) : 3.5;
    
    // Check if col 4 is currency (e.g. SEK, INR, USD, EUR) or if it looks like a date
    let currency: CurrencyCode = 'SEK';
    let date1 = '';
    let date2 = '';

    const col4 = cols[4]?.trim().toUpperCase();
    if (col4 && ['SEK', 'INR', 'USD', 'EUR', 'GBP'].includes(col4)) {
      currency = col4 as CurrencyCode;
      date1 = normalizeDate(cols[5]?.trim() || '');
      date2 = normalizeDate(cols[6]?.trim() || '');
    } else {
      // Currency might have been omitted or placed later
      date1 = normalizeDate(cols[4]?.trim() || '');
      date2 = normalizeDate(cols[5]?.trim() || '');
    }

    let startDate = today;
    let maturityDate = '';

    // Smart date assignment: if two dates are present, the earlier one is start date
    if (date1 && date2) {
      if (date1 <= date2) {
        startDate = date1;
        maturityDate = date2;
      } else {
        startDate = date2;
        maturityDate = date1;
      }
    } else if (date1) {
      // Single date provided: check if it's future (maturity) or past (start)
      if (date1 > today) {
        maturityDate = date1;
        startDate = today;
      } else {
        startDate = date1;
      }
    }

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
      const cleanSymbol = `FD_${item.broker.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${Date.now()}_${count}`;
      db.run(
        `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date, quantity, avg_price, market_price)
         VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(broker, symbol) DO UPDATE SET 
           principal = excluded.principal,
           market_price = excluded.market_price,
           updated_at = CURRENT_TIMESTAMP`,
        [
          item.broker,
          cleanSymbol,
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