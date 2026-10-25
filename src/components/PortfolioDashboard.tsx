import React, { useState } from 'react';
import {
  ShieldCheck,
  CloudUpload,
  CloudDownload,
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  Landmark,
  Info,
  KeyRound,
  ServerOff,
} from 'lucide-react';
import { calculateFDCurrentValue } from '../db/database';
import { BrokerType, CurrencyCode, HoldingRow } from '../types';

interface PortfolioDashboardProps {
  holdings: HoldingRow[];
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  fxRates: Record<string, number>;
  statusMsg: string;
  onGoLanding: () => void;
  onOpenPrivacyModal: () => void;
  onOpenPassModal: () => void;
  onSyncLivePrices: () => void;
  onDriveBackup: () => void;
  onDriveRestore: () => void;
  onDownloadEncryptedFile: () => void;
  onUploadEncryptedFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCsvImport: (file: File, broker: BrokerType) => void;
  onAddFD: (fd: {
    broker: string;
    symbol: string;
    name: string;
    currency: CurrencyCode;
    principal: number;
    interest_rate: number;
    compounding_freq: number;
    start_date: string;
    maturity_date: string;
  }) => void;
}

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  holdings,
  baseCurrency,
  setBaseCurrency,
  fxRates,
  statusMsg,
  onGoLanding,
  onOpenPrivacyModal,
  onOpenPassModal,
  onSyncLivePrices,
  onDriveBackup,
  onDriveRestore,
  onDownloadEncryptedFile,
  onUploadEncryptedFile,
  onCsvImport,
  onAddFD,
}) => {
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('AVANZA');
  const [fdForm, setFdForm] = useState({
    broker: 'SBI Bank',
    symbol: 'FD-001',
    name: '5-Yr Fixed Deposit',
    currency: 'INR' as CurrencyCode,
    principal: 500000,
    interest_rate: 7.25,
    compounding_freq: 4,
    start_date: '2025-01-15',
    maturity_date: '2030-01-15',
  });

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const totalNetWorth = holdings.reduce((sum, h) => {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    return sum + convertToBase(nativeVal, h.currency);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={onGoLanding}
                className="text-xl font-bold text-white tracking-tight cursor-pointer hover:text-indigo-400 transition"
                title="View Landing Page"
              >
                netto
              </h1>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                AES-256 Unlocked
              </span>
            </div>
            <p className="text-xs text-slate-400">{statusMsg}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenPrivacyModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Privacy Architecture
          </button>
          <button
            onClick={onOpenPassModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
          </button>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            <option value="SEK">Base: SEK (kr)</option>
            <option value="INR">Base: INR (₹)</option>
            <option value="USD">Base: USD ($)</option>
            <option value="EUR">Base: EUR (€)</option>
          </select>
          <button
            onClick={onSyncLivePrices}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Live Prices
          </button>
          <button
            onClick={onDriveBackup}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Save to Drive
          </button>
          <button
            onClick={onDriveRestore}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <CloudDownload className="w-3.5 h-3.5" /> Load Drive
          </button>
          <button
            onClick={onDownloadEncryptedFile}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> .sqlite.enc
          </button>
          <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Load File
            <input type="file" accept=".enc,.sqlite" onChange={onUploadEncryptedFile} className="hidden" />
          </label>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Total Netto Worth</span>
            <div className="text-4xl font-extrabold text-white mt-2">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400">{baseCurrency}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Automatically converts Swedish Avanza (SEK), Indian Zerodha & Bank FDs (INR), and Interactive Brokers
            (USD/EUR) into {baseCurrency}.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <ServerOff className="w-4 h-4" /> Zero Server Storage Guarantee
          </div>
          <p className="text-slate-400 leading-relaxed">
            Your SQLite database runs in browser WebAssembly memory and is encrypted with <b>AES-256-GCM</b> before
            saving to your device or Google Drive.
          </p>
          <button onClick={onOpenPrivacyModal} className="text-indigo-400 hover:underline font-medium inline-block pt-1">
            Inspect Local vs. Server Data Breakdown →
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base text-white">Re-Import Broker CSV (Auto-Upsert)</h2>
          </div>
          <p className="text-xs text-slate-400">
            Select your broker and drop your latest positions export. Existing holdings update cleanly.
          </p>
          <div className="flex flex-wrap gap-3 items-center pt-1">
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value as BrokerType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white"
            >
              <option value="AVANZA">Avanza (Sweden CSV)</option>
              <option value="ZERODHA">Zerodha Console (India CSV)</option>
              <option value="IBKR">Interactive Brokers (Global CSV)</option>
            </select>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvImport(f, selectedBroker);
              }}
              className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddFD(fdForm);
          }}
          className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3"
        >
          <div className="flex items-center gap-2.5">
            <Landmark className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base text-white">Add / Update Fixed Deposit (Auto-Compounding)</h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Bank (e.g. SBI, SBAB)"
              value={fdForm.broker}
              onChange={(e) => setFdForm({ ...fdForm, broker: e.target.value })}
            />
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="FD Receipt ID"
              value={fdForm.symbol}
              onChange={(e) => setFdForm({ ...fdForm, symbol: e.target.value })}
            />
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Description"
              value={fdForm.name}
              onChange={(e) => setFdForm({ ...fdForm, name: e.target.value })}
            />
            <input
              type="number"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Principal"
              value={fdForm.principal}
              onChange={(e) => setFdForm({ ...fdForm, principal: Number(e.target.value) })}
            />
            <input
              type="number"
              step="0.01"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Annual Rate %"
              value={fdForm.interest_rate}
              onChange={(e) => setFdForm({ ...fdForm, interest_rate: Number(e.target.value) })}
            />
            <select
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.currency}
              onChange={(e) => setFdForm({ ...fdForm, currency: e.target.value as CurrencyCode })}
            >
              <option value="INR">INR (₹)</option>
              <option value="SEK">SEK (kr)</option>
              <option value="USD">USD ($)</option>
            </select>
            <input
              type="date"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.start_date}
              onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
            />
            <input
              type="date"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.maturity_date}
              onChange={(e) => setFdForm({ ...fdForm, maturity_date: e.target.value })}
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
            >
              Save FD
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="p-4">Broker / Bank</th>
              <th className="p-4">Asset</th>
              <th className="p-4">Category</th>
              <th className="p-4">Qty / Principal</th>
              <th className="p-4">Market Price / Rate</th>
              <th className="p-4">Current Native Value</th>
              <th className="p-4">Value ({baseCurrency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No holdings yet. Import a CSV from Avanza, Zerodha, or IBKR, or add a Fixed Deposit above.
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
                const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
                const baseVal = convertToBase(nativeVal, h.currency);
                return (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-semibold text-white">{h.broker}</td>
                    <td className="p-4">
                      <span className="text-slate-100 font-medium">{h.name}</span>{' '}
                      <span className="text-slate-500">({h.symbol})</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isFD ? 'bg-emerald-500/15 text-emerald-300' : 'bg-indigo-500/15 text-indigo-300'
                        }`}
                      >
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      {isFD ? `${h.principal.toLocaleString()} ${h.currency}` : h.quantity}
                    </td>
                    <td className="p-4 text-slate-300">
                      {isFD ? `${h.interest_rate}% (Since ${h.start_date})` : `${h.market_price} ${h.currency}`}
                    </td>
                    <td className="p-4 text-slate-200 font-medium">
                      {Math.round(nativeVal).toLocaleString()} {h.currency}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {Math.round(baseVal).toLocaleString()} {baseCurrency}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
