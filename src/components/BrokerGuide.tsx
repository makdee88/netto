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
      'Log in to your Avanza account on a desktop browser.',
      'Navigate to **Min ekonomi** (My Economy) → **Transaktioner** (Transactions).',
      'Select your specific account (ISK, KF, or Aktie- och fondkonto) and set the date range to **Sedan start** (Since start).',
      'Click the **Exportera transaktioner** (Export transactions) button to download your CSV file.',
    ],
    tip: 'Netto reads Swedish headers, date formats, and European comma/decimal values automatically.',
  },
  NORDNET: {
    name: 'Nordnet',
    country: 'Nordics 🇸🇪 🇳🇴 🇩🇰 🇫🇮',
    steps: [
      'Log in to your Nordnet account.',
      'Go to the **Transaktioner** (Transactions) tab.',
      'Select your account and choose a full date range covering your trading history.',
      'Click on **Exportera CSV** (Export CSV) to download your file.',
    ],
    tip: 'Nordnet exports include all historical trades, which Netto normalizes into current holdings.',
  },
  ZERODHA: {
    name: 'Zerodha (Console)',
    country: 'India 🇮🇳',
    steps: [
      'Log in to **Zerodha Console** (`console.zerodha.com`).',
      'Navigate to **Reports** → **Holdings** or **Tradebook**.',
      'Select your date range if using Tradebook.',
      'Click the **Download** (down arrow icon) at the top right of the table to save as CSV.',
    ],
    tip: 'Netto automatically parses NSE/BSE symbols and appends `.NS` for live Yahoo Finance price feeds.',
  },
  UPSTOX: {
    name: 'Upstox',
    country: 'India 🇮🇳',
    steps: [
      'Log in to the Upstox web platform.',
      'Go to **Reports** → **Trade History** or **Holdings**.',
      'Select the widest date range available.',
      'Click **Download CSV** to export your report.',
    ],
    tip: 'Ensure headers include Instrument/Symbol, Quantity, and Average Price.',
  },
  IBKR: {
    name: 'Interactive Brokers',
    country: 'Global 🌍',
    steps: [
      'Log in to the **IBKR Client Portal**.',
      'Go to **Performance & Reports** → **Statements** → **Activity**.',
      'Select **CSV** as the report format and click **Download**.',
      '(Alternatively, use the Classic TWS platform under *Account → Export Portfolio*).',
    ],
    tip: 'Netto reads multi-currency primary fields and cost basis automatically from IBKR statements.',
  },
};

export const BrokerGuide: React.FC<BrokerGuideProps> = ({ broker, theme }) => {
  const isDark = theme === 'dark';
  const info = BROKER_INSTRUCTIONS[broker];

  return (
    <div className={`p-5 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-indigo-400">{info.name}</span>
          <span className="text-xs opacity-60">({info.country})</span>
        </div>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
          Guided Export
        </span>
      </div>

      <div className="space-y-2 pt-1">
        {info.steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
              {idx + 1}
            </span>
            <p className="opacity-90 leading-relaxed" dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
          </div>
        ))}
      </div>

      <div className={`p-3 rounded-xl border text-[11px] flex items-center gap-2 ${isDark ? 'bg-slate-900 border-slate-800 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
        <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
        <span><b>Pro Tip:</b> {info.tip}</span>
      </div>
    </div>
  );
};