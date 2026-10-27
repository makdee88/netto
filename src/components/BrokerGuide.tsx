import React from 'react';
import { BrokerType } from '../types';

interface BrokerGuideProps {
  broker: BrokerType;
  isDark: boolean;
}

export const BrokerGuide: React.FC<BrokerGuideProps> = ({ broker, isDark }) => {
  const guideMap: Record<string, { title: string; format: string; currency: string; steps: string[]; notes: string }> = {
    Avanza: {
      title: 'Avanza (Sweden)',
      format: 'Transactions CSV',
      currency: 'SEK',
      steps: [
        'Log in to Avanza and navigate to Mina sidor -> Kontosöversikt -> Historik.',
        'Click "Exportera historik" (Export history) in the top right.',
        'Select your date range and download as CSV.',
      ],
      notes: 'Extracts buy, sell, and dividend transactions with automatic holding aggregation.',
    },
    Zerodha: {
      title: 'Zerodha Coin & Kite (India)',
      format: 'Holdings Excel (.xlsx)',
      currency: 'INR',
      steps: [
        'Log in to Zerodha Console (Reports -> Holdings) or Kite (Portfolio -> Holdings).',
        'Click the download button to export your holdings as an Excel (.xlsx) file.',
        'Upload the downloaded file directly here.',
      ],
      notes: 'Supports multi-tab workbooks (Equity & Mutual Funds) and automatically parses snapshots.',
    },
    Kuvera: {
      title: 'Kuvera (India - Mutual Funds)',
      format: 'Transactions CSV',
      currency: 'INR',
      steps: [
        'Log in to Kuvera and go to Profile -> Reports -> Transaction Report.',
        'Select your date range and click Download CSV.',
        'Upload the exported CSV file.',
      ],
      notes: 'Extracts fund name, folio number, order type (buy/sell), units, and execution NAV.',
    },
    Degiro: {
      title: 'DEGIRO (Europe)',
      format: 'Transactions CSV',
      currency: 'EUR / SEK / USD',
      steps: [
        'Log in to DEGIRO and go to Inbox / Activity -> Transactions.',
        'Set your start date to the beginning of your account and click Export -> CSV.',
        'Upload the exported Transactions.csv file.',
      ],
      notes: 'Extracts ISIN, product name, quantity, and execution price.',
    },
    InteractiveBrokers: {
      title: 'Interactive Brokers (IBKR)',
      format: 'Transaction History CSV',
      currency: 'USD / SEK / EUR (Multi-currency)',
      steps: [
        'Log in to IBKR Client Portal.',
        'Navigate to Performance & Reports -> Statements.',
        'Select "Transaction History" and choose your date range.',
        'Export / Download as CSV and upload the file here.',
      ],
      notes: 'Parses execution dates, ticker symbols, quantities, and price currency across multiple asset classes.',
    },
    Groww: {
      title: 'Groww (India)',
      format: 'Holdings / Investment Report',
      currency: 'INR',
      steps: [
        'Go to Groww Web -> Reports -> Stocks / Mutual Funds Report.',
        'Download your transaction or holdings report.',
        'Upload the report file here.',
      ],
      notes: 'Automatically maps investment holdings and mutual fund units.',
    },
    Generic: {
      title: 'Other / Custom CSV',
      format: 'Standard CSV',
      currency: 'Any',
      steps: [
        'Format your CSV with columns: Date, Symbol, Type (BUY/SELL), Quantity, Price.',
        'Ensure headers are clearly labeled in the first row.',
        'Upload the CSV file.',
      ],
      notes: 'Flexible fallback parser for custom portfolio sheets.',
    },
  };

  const current = guideMap[broker as string] || guideMap['Generic'];

  return (
    <div
      className={`p-5 rounded-2xl border mb-6 text-xs space-y-3 ${
        isDark ? 'bg-slate-950/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/20 pb-3">
        <div>
          <h4 className="font-bold text-sm text-indigo-400">{current.title} Import Guide</h4>
          <p className="opacity-70 text-[11px] mt-0.5">{current.notes}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-mono font-semibold text-[10px]">
            {current.format}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-semibold text-[10px]">
            {current.currency}
          </span>
        </div>
      </div>

      <ol className="list-decimal list-inside space-y-1.5 opacity-90 pl-1">
        {current.steps.map((step, idx) => (
          <li key={idx} className="leading-relaxed">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
};