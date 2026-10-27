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

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parses varied bank date formats (e.g. "01 Jun 2028", "28/12/2023", "2025-03-27")
 * and converts them to standardized ISO format YYYY-MM-DD.
 */
function normalizeDate(str: string): string {
  if (!str) return '';
  const clean = str.trim();

  // 1. Standard ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // 2. Text month format: "01 Jun 2028" or "1-Jun-2028"
  const textMonthMatch = clean.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{4})$/);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const monthKey = textMonthMatch[2].slice(0, 3).toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = textMonthMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // 3. Delimited numeric: DD/MM/YYYY or YYYY/MM/DD
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // 4. Fallback to JS Date parser
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return clean;
}

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

    if (i === 0 && /(bank|institution|principal|amount|rate|deposit)/i.test(line)) {
      continue;
    }

    if (cols.length < 3) continue;

    const broker = cols[0]?.trim() || 'Bank';
    const name = cols[1]?.trim() || 'Fixed Deposit';
    const principal = normalizeNumber(cols[2]);
    const interestRate = cols[3] ? normalizeNumber(cols[3]) : 3.5;

    let currency: CurrencyCode = 'SEK';
    let rawDate1 = '';
    let rawDate2 = '';

    const col4 = cols[4]?.trim().toUpperCase();
    if (col4 && ['SEK', 'INR', 'USD', 'EUR', 'GBP'].includes(col4)) {
      currency = col4 as CurrencyCode;
      rawDate1 = cols[5]?.trim() || '';
      rawDate2 = cols[6]?.trim() || '';
    } else {
      rawDate1 = cols[4]?.trim() || '';
      rawDate2 = cols[5]?.trim() || '';
    }

    const isoDate1 = normalizeDate(rawDate1);
    const isoDate2 = normalizeDate(rawDate2);

    let startDate = today;
    let maturityDate = '';

    // True chronological comparison using timestamps
    const time1 = isoDate1 ? new Date(isoDate1).getTime() : NaN;
    const time2 = isoDate2 ? new Date(isoDate2).getTime() : NaN;

    if (!isNaN(time1) && !isNaN(time2)) {
      if (time1 <= time2) {
        startDate = isoDate1;
        maturityDate = isoDate2;
      } else {
        startDate = isoDate2;
        maturityDate = isoDate1;
      }
    } else if (!isNaN(time1)) {
      if (isoDate1 > today) {
        maturityDate = isoDate1;
        startDate = today;
      } else {
        startDate = isoDate1;
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