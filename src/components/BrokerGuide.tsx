import React, { useState } from 'react';
import { BrokerType } from '../types';
import { HelpCircle, ChevronDown, ChevronUp, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface BrokerGuideProps {
  broker: BrokerType;
  isDark?: boolean;
}

const BROKER_INSTRUCTIONS: Record<
  string,
  {
    title: string;
    format: string;
    currency: string;
    steps: string[];
    notes: string;
  }
> = {
  Avanza: {
    title: 'Avanza (Sweden)',
    format: 'CSV (; semicolon-separated)',
    currency: 'SEK',
    steps: [
      'Log in to Avanza.se in your desktop browser.',
      'Go to Min Ekonomi (My Economy) -> Transaktioner (Transactions).',
      'Select your desired date range (or all accounts) and click Exportera transaktioner till CSV.',
      'Upload the downloaded .csv file directly without opening or re-saving it in Excel.',
    ],
    notes: 'Handles Köp (Buy), Sälj (Sell), and Utdelning (Dividend) rows automatically.',
  },
  Nordnet: {
    title: 'Nordnet (Nordics)',
    format: 'CSV (; or Tab separated)',
    currency: 'SEK / NOK / DKK / EUR',
    steps: [
      'Log in to Nordnet and navigate to Mina sidor -> Transaktioner och notor.',
      'Select the full date range for your accounts.',
      'Click Exportera CSV at the top right of the transaction list.',
      'Upload the exported .csv file directly here.',
    ],
    notes: 'Automatically parses Nordic number formatting and currency codes.',
  },
  Zerodha: {
    title: 'Zerodha Kite / Console (India)',
    format: 'Excel (.xlsx Multi-Tab) or CSV (.csv)',
    currency: 'INR',
    steps: [
      'Log in to Zerodha Console (console.zerodha.com).',
      'Go to Reports -> Tradebook (or Portfolio -> Holdings).',
      'Select the date range and click Download XLSX or CSV.',
      'Upload the downloaded .xlsx or .csv file directly—Netto automatically skips Zerodha metadata headers and reads the Tradebook/Holdings sheet.',
    ],
    notes: 'Supports both multi-tab Excel workbooks (.xlsx) and standard Tradebook CSVs.',
  },
  Groww: {
    title: 'Groww (India)',
    format: 'CSV / Excel (.xlsx)',
    currency: 'INR',
    steps: [
      'Log in to Groww and go to Reports -> Order History / Stocks Tradebook.',
      'Download your equity transaction report as CSV or XLSX.',
      'Upload the file directly to compute net holdings and average purchase cost.',
    ],
    notes: 'Deduplicates repeated uploads so you can safely re-import overlapping periods.',
  },
  InteractiveBrokers: {
    title: 'Interactive Brokers (IBKR)',
    format: 'Activity Statement / Trades CSV',
    currency: 'USD / EUR / SEK',
    steps: [
      'Log in to IBKR Client Portal -> Performance & Reports -> Flex Queries or Statements.',
      'Export your Trades section in CSV format.',
      'Upload the CSV file to import your international equity positions.',
    ],
    notes: 'Reads Symbol, Date/Time, Quantity, and Trade Price columns.',
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
  Generic: {
    title: 'Custom / Other Broker CSV',
    format: 'Standard CSV (, or ; separated)',
    currency: 'Default / Multi-currency',
    steps: [
      'Prepare a CSV file with a header row in row 1.',
      'Include columns for: Symbol (or Name), Type (BUY/SELL), Quantity (or Qty), Price, and Date.',
      'Save as UTF-8 .csv and upload.',
    ],
    notes: 'Works with Nordea, Swedbank, Revolut, or any custom spreadsheet export.',
  },
};

export const BrokerGuide: React.FC<BrokerGuideProps> = ({ broker, isDark = true }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const info = BROKER_INSTRUCTIONS[broker] || BROKER_INSTRUCTIONS.Generic;

  return (
    <div
      className={`mb-6 rounded-2xl border transition-all ${
        isDark
          ? 'bg-slate-950/60 border-slate-800/80 text-slate-200'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0"/>
          <span>How to export from {info.title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
            {info.format}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 opacity-60"/>
        ) : (
          <ChevronDown className="w-4 h-4 opacity-60"/>
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/30 text-xs space-y-2.5">
          <ol className="list-decimal pl-4 space-y-1.5 opacity-90">
            {info.steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/>
            <span>{info.notes}</span>
          </div>
        </div>
      )}
    </div>
  );
};