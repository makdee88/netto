import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BrokerType } from '../types';

interface BrokerGuideProps {
  broker: BrokerType;
  theme: 'dark' | 'light';
}

const BROKER_INSTRUCTIONS: Record<
  BrokerType,
  { name: string; country: string; steps: string[]; tip: string }
> = {
  AVANZA: {
    name: 'Avanza',
    country: 'Sweden 🇸🇪',
    steps: [
      'Log in to Avanza on a desktop browser and go to **Min ekonomi** → **Transaktioner**.',
      '**First time:** Set the date filter to **Sedan start** (Since start). **Future updates:** Just export the latest month or quarter!',
      'Click **Exportera transaktioner** (CSV) and upload the file below.',
    ],
    tip: 'Netto saves every transaction in your encrypted SQLite ledger and automatically skips duplicates if date ranges overlap.',
  },
  NORDNET: {
    name: 'Nordnet',
    country: 'Nordics 🇸🇪 🇳🇴 🇩🇰 🇫🇮',
    steps: [
      'Log in to Nordnet and navigate to **Transaktioner** (Transactions).',
      '**First time:** Choose your full date range. **Future updates:** Export only recent weeks/months.',
      'Click **Exportera CSV** and upload it here.',
    ],
    tip: 'Overlapping date ranges are safely deduplicated automatically.',
  },
  ZERODHA: {
    name: 'Zerodha (Console)',
    country: 'India 🇮🇳',
    steps: [
      'Log in to **Zerodha Console** (`console.zerodha.com`).',
      'Go to **Portfolio** → **Holdings** (or **Reports** → **Tradebook**).',
      'Click the **Download CSV** icon at the top right of the table.',
    ],
    tip: 'Netto automatically maps NSE/BSE tickers and fetches live INR prices.',
  },
  UPSTOX: {
    name: 'Upstox',
    country: 'India 🇮🇳',
    steps: [
      'Log in to the Upstox web portal.',
      'Navigate to **Portfolio** → **Holdings** or **Reports** → **Trade History**.',
      'Click **Download CSV** and upload the exported report.',
    ],
    tip: 'Both position snapshots and trade history files are supported.',
  },
  IBKR: {
    name: 'Interactive Brokers',
    country: 'Global 🌍',
    steps: [
      'Log in to the **IBKR Client Portal**.',
      'Go to **Performance & Reports** → **Statements** → **Activity**.',
      'Export the **Positions** or **Trades** section in **CSV** format.',
    ],
    tip: 'Multi-currency positions (USD, EUR, SEK) are consolidated automatically.',
  },
};

export const BrokerGuide: React.FC<BrokerGuideProps> = ({ broker, theme }) => {
  const isDark = theme === 'dark';
  const info = BROKER_INSTRUCTIONS[broker];

  return (
    <div className={`p-5 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-indigo-500">{info.name}</span>
          <span className="text-xs opacity-60">({info.country})</span>
        </div>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
          Incremental Sync Ready
        </span>
      </div>

      <div className="space-y-2 pt-1">
        {info.steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
              {idx + 1}
            </span>
            <p
              className="opacity-90 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }}
            />
          </div>
        ))}
      </div>

      <div className={`p-3 rounded-xl border text-[11px] flex items-center gap-2 ${isDark ? 'bg-slate-900 border-slate-800 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
        <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-500" />
        <span><b>Smart Ledger:</b> {info.tip}</span>
      </div>
    </div>
  );
};