import React from 'react';
import { ExternalLink, CheckCircle2, HelpCircle } from 'lucide-react';
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
      'Log in to Avanza on your desktop browser.',
      'Go to **Mina sidor** (My Pages) → **Kontosöversikt** (Account Overview).',
      'Select your ISK or KF account, then click on the **Innehav** (Holdings) tab.',
      'Click the **Exportera** (Export) or download button in the top right of the holdings table to download your CSV.',
    ],
    tip: 'Netto automatically detects Swedish comma decimals and semicolons in Avanza exports.',
  },
  NORDNET: {
    name: 'Nordnet',
    country: 'Nordics 🇸🇪 🇳🇴 🇩🇰 🇫🇮',
    steps: [
      'Log in to Nordnet and navigate to your portfolio overview.',
      'Open your specific account and click on **Mina aktier / fonder** (Holdings).',
      'Look for the export or download icon (usually located above the positions table).',
      'Save the file as a CSV and upload it directly into Netto.',
    ],
    tip: 'Ensure columns include Quantity and Average Purchase Price (GAV).',
  },
  ZERODHA: {
    name: 'Zerodha (Console)',
    country: 'India 🇮🇳',
    steps: [
      'Log in to **Zerodha Console** (console.zerodha.com).',
      'Navigate to **Portfolio** → **Holdings** in the top menu.',
      'Click on the **Download** button (down arrow icon) at the top right of your holdings list.',
      'Save the downloaded CSV file and upload it here.',
    ],
    tip: 'Netto automatically parses NSE/BSE symbols and appends `.NS` for live price fetching.',
  },
  UPSTOX: {
    name: 'Upstox',
    country: 'India 🇮🇳',
    steps: [
      'Log in to the Upstox web portal or app.',
      'Go to **Portfolio** → **Holdings**.',
      'Click the download/export report button to download your current holdings CSV.',
      'Upload the exported file into Netto.',
    ],
    tip: 'Ensure headers include Instrument/Symbol, Quantity, and Average Price.',
  },
  IBKR: {
    name: 'Interactive Brokers',
    country: 'Global 🌍',
    steps: [
      'Log in to **Client Portal** on the IBKR website.',
      'Go to **Performance & Reports** → **Statements** → **Flex Queries** (or generate a Custom Portfolio CSV Report).',
      'Select **Positions** in the section fields and export format as CSV.',
      'Download and upload the positions report into Netto.',
    ],
    tip: 'Netto reads multi-currency primary fields and cost basis automatically.',
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