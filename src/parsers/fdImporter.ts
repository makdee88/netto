import type { Database } from 'sql.js';
import { CsvImportResult } from '../types';

function parseCsvLines(text: string, delimiter = ','): string[][] {
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

export async function parseFixedDepositsCsv(
  file: File,
  db: Database,
  onComplete: (summary: CsvImportResult) => void
): Promise<CsvImportResult> {
  const text = await file.text();
  const delimiter = text.includes(';') ? ';' : ',';
  const rows = parseCsvLines(text, delimiter);
  if (rows.length < 2) throw new Error('FD CSV is empty or invalid.');

  const headers = rows[0].map((h) => h.toLowerCase());
  const instIdx = headers.findIndex((h) => h.includes('institution') || h.includes('broker') || h.includes('bank'));
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('deposit') || h.includes('description'));
  const currIdx = headers.findIndex((h) => h.includes('currency'));
  const prinIdx = headers.findIndex((h) => h.includes('principal') || h.includes('amount'));
  const rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('interest'));
  const freqIdx = headers.findIndex((h) => h.includes('compounding') || h.includes('freq'));
  const startIdx = headers.findIndex((h) => h.includes('start'));
  const matIdx = headers.findIndex((h) => h.includes('maturity') || h.includes('end'));

  let count = 0;
  db.run('BEGIN TRANSACTION');

  try {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 4) continue;

      const broker = (r[instIdx] || 'Bank').trim();
      const name = (r[nameIdx] || 'Fixed Deposit').trim();
      const currency = (r[currIdx] || 'SEK').toUpperCase().trim();
      const principal = normalizeNumber(r[prinIdx]);
      const interestRate = normalizeNumber(r[rateIdx]);
      const compoundingFreq = parseInt(r[freqIdx] || '4', 10) || 4;
      const startDate = (r[startIdx] || new Date().toISOString().slice(0, 10)).trim();
      const maturityDate = (r[matIdx] || '').trim();
      const symbol = `FD_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${Date.now()}`;

      if (principal <= 0) continue;

      db.run(
        `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date, quantity, avg_price, market_price)
         VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [broker, symbol, name, currency, principal, interestRate, compoundingFreq, startDate, maturityDate, principal, principal]
      );
      count++;
    }

    db.run('COMMIT');

    const result: CsvImportResult = {
      broker: 'Fixed Deposits Bulk',
      importType: 'TRADEBOOK',
      newTransactionsAdded: 0,
      duplicatesSkipped: 0,
      holdingsUpdated: count,
    };
    onComplete(result);
    return result;
  } catch (err: any) {
    db.run('ROLLBACK');
    throw new Error(`Failed to parse FD CSV: ${err?.message || err}`);
  }
}