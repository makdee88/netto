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
  Sun,
  Moon,
} from 'lucide-react';
import { calculateFDCurrentValue } from '../db/database';
import { BrokerType, CurrencyCode, HoldingRow } from '../types';

interface PortfolioDashboardProps {
  holdings: HoldingRow[];
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  fxRates: Record<string, number>;
  statusMsg: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  theme,
  onToggleTheme,
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
  const isDark = theme === 'dark';
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('AVANZA');
  
  // Single or Bulk FD Input mode
  const [fdInputMode, setFdInputMode] = useState<'SINGLE' | 'QUICK_BULK'>('SINGLE');
  const [bulkFdText, setBulkFdText] = useState(
    'Bank Name, FD Ref, Description, Principal, Rate %, Currency (INR/SEK/USD/EUR), Start Date (YYYY-MM-DD), Maturity Date\nSBI, FD-001, 5Yr Tax Saver, 500000, 7.25, INR, 2025-01-15, 2030-01-15'
  );

  const [fdForm, setFdForm] = useState({
    broker: 'Bank / Institution',
    symbol: 'FD-001',
    name: 'Fixed Deposit',
    currency: 'INR' as CurrencyCode,
    principal: 100000,
    interest_rate: 7.0,
    compounding_freq: 4,
    start_date: new Date().toISOString().slice(0, 10),
    maturity_date: new Date(Date.now() + 365 * 86400000 * 3).toISOString().slice(0, 10),
  });

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const totalNetWorth = holdings.reduce((sum, h) => {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    return sum + convertToBase(nativeVal, h.currency);
  }, 0);

  const handleBulkFdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkFdText.split('\n').slice(1); // skip header
    let count = 0;
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 8) {
        const [broker, symbol, name, principal, rate, currency, start_date, maturity_date] = parts;
        if (broker && principal) {
          onAddFD({
            broker,
            symbol: symbol || `FD-${Math.random().toString(36).slice(2, 6)}`,
            name: name || 'Fixed Deposit',
            currency: (currency.toUpperCase() as CurrencyCode) || 'INR',
            principal: Number(principal) || 0,
            interest_rate: Number(rate) || 0,
            compounding_freq: 4,
            start_date: start_date || '2025-01-01',
            maturity_date: maturity_date || '2030-01-01',
          });
          count++;
        }
      }
    }
    alert(`Successfully added ${count} Fixed Deposits!`);
  };

  return (
    <div className={`max-w-7xl mx-auto p-6 space-y-6 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      <header className={`flex flex-wrap justify-between items-center gap-4 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={onGoLanding}
                className="text-xl font-bold tracking-tight cursor-pointer hover:text-indigo-400 transition"
                title="View Landing Page"
              >
                netto
              </h1>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                AES-256 Unlocked
              </span>
            </div>
            <p className="text-xs opacity-75">{statusMsg}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-700'}`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenPrivacyModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Privacy
          </button>
          <button
            onClick={onOpenPassModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
          </button>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
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
            <RefreshCw className="w-3.5 h-3.5" /> Prices
          </button>
          <button
            onClick={onDriveBackup}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Save to Google Drive
          </button>
          <button
            onClick={onDriveRestore}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <CloudDownload className="w-3.5 h-3.5" /> Load Drive
          </button>
          <button
            onClick={onDownloadEncryptedFile}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <Download className="w-3.5 h-3.5" /> .enc
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}>
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept=".enc,.sqlite" onChange={onUploadEncryptedFile} className="hidden" />
          </label>
        </div>
      </header>

      {/* Net Worth Hero */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 border p-6 rounded-2xl flex flex-col justify-between shadow-sm ${isDark ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border-indigo-500/30' : 'bg-gradient-to-r from-indigo-50 via-white to-white border-indigo-200'}`}>
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-500 font-semibold">Total Netto Worth</span>
            <div className={`text-4xl font-extrabold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400">{baseCurrency}</span>
            </div>
          </div>
          <p className="text-xs opacity-70 mt-4">
            Consolidating global investment portfolios and fixed-rate savings accounts into {baseCurrency}.
          </p>
        </div>

        <div className={`border p-5 rounded-2xl space-y-2 text-xs shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 font-semibold text-emerald-500">
            <ServerOff className="w-4 h-4" /> Zero Server Storage Guarantee
          </div>
          <p className="opacity-75 leading-relaxed">
            Your vault is encrypted with <b>AES-256-GCM</b> before syncing directly to your private Google Drive account.
          </p>
          <button onClick={onOpenPrivacyModal} className="text-indigo-500 hover:underline font-medium inline-block pt-1">
            Learn how security works →
          </button>
        </div>
      </div>

      {/* Action Cards: CSV Import & Simplified Fixed Deposits */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Broker CSV Import */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-base">Import Broker CSV (Auto-Upsert)</h2>
          </div>
          <p className="text-xs opacity-70">
            Select your broker and drop your positions export. Existing holdings update cleanly.
          </p>
          <div className="flex flex-wrap gap-3 items-center pt-1">
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value as BrokerType)}
              className={`border rounded-lg px-3 py-2 text-xs font-medium ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            >
              <option value="AVANZA">Avanza (Sweden)</option>
              <option value="NORDNET">Nordnet (Nordics)</option>
              <option value="ZERODHA">Zerodha (India)</option>
              <option value="UPSTOX">Upstox (India)</option>
              <option value="IBKR">Interactive Brokers (Global)</option>
            </select>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvImport(f, selectedBroker);
              }}
              className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Simplified Fixed Deposits (Single or Quick Bulk Mode) */}
        <div className={`border p-6 rounded-2xl space-y-3 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <Landmark className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-base">Fixed Deposits & Savings</h2>
            </div>
            <div className="flex gap-1 bg-slate-950/20 p-1 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFdInputMode('SINGLE')}
                className={`px-2 py-1 rounded ${fdInputMode === 'SINGLE' ? 'bg-emerald-600 text-white' : 'opacity-70'}`}
              >
                Single Form
              </button>
              <button
                type="button"
                onClick={() => setFdInputMode('QUICK_BULK')}
                className={`px-2 py-1 rounded ${fdInputMode === 'QUICK_BULK' ? 'bg-emerald-600 text-white' : 'opacity-70'}`}
              >
                Quick Bulk Paste
              </button>
            </div>
          </div>

          {fdInputMode === 'SINGLE' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddFD(fdForm);
              }}
              className="grid grid-cols-3 gap-2.5 text-xs pt-1"
            >
              <input
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                placeholder="Bank Name"
                value={fdForm.broker}
                onChange={(e) => setFdForm({ ...fdForm, broker: e.target.value })}
              />
              <input
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                placeholder="Account / Ref ID"
                value={fdForm.symbol}
                onChange={(e) => setFdForm({ ...fdForm, symbol: e.target.value })}
              />
              <input
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                placeholder="Description"
                value={fdForm.name}
                onChange={(e) => setFdForm({ ...fdForm, name: e.target.value })}
              />
              <input
                type="number"
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                placeholder="Principal Amount"
                value={fdForm.principal}
                onChange={(e) => setFdForm({ ...fdForm, principal: Number(e.target.value) })}
              />
              <input
                type="number"
                step="0.01"
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                placeholder="Annual Rate %"
                value={fdForm.interest_rate}
                onChange={(e) => setFdForm({ ...fdForm, interest_rate: Number(e.target.value) })}
              />
              <select
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.currency}
                onChange={(e) => setFdForm({ ...fdForm, currency: e.target.value as CurrencyCode })}
              >
                <option value="INR">INR (₹)</option>
                <option value="SEK">SEK (kr)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              <input
                type="date"
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.start_date}
                onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
              />
              <input
                type="date"
                className={`border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.maturity_date}
                onChange={(e) => setFdForm({ ...fdForm, maturity_date: e.target.value })}
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition py-2"
              >
                Save FD
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkFdSubmit} className="space-y-2 text-xs pt-1">
              <p className="opacity-70 text-[11px]">
                Paste comma-separated rows (Bank, ID, Name, Principal, Rate %, Currency, StartDate, MaturityDate):
              </p>
              <textarea
                rows={4}
                value={bulkFdText}
                onChange={(e) => setBulkFdText(e.target.value)}
                className={`w-full font-mono text-[11px] p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold py-2 transition"
              >
                Import Bulk Fixed Deposits
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
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
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center opacity-60">
                  No holdings yet. Import a broker CSV or add a Fixed Deposit above.
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
                const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
                const baseVal = convertToBase(nativeVal, h.currency);
                return (
                  <tr key={h.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">{h.broker}</td>
                    <td className="p-4">
                      <span className="font-medium">{h.name}</span>{' '}
                      <span className="opacity-60">({h.symbol})</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isFD ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'
                        }`}
                      >
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD ? `${h.principal.toLocaleString()} ${h.currency}` : h.quantity}
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD ? `${h.interest_rate}% (Since ${h.start_date})` : `${h.market_price} ${h.currency}`}
                    </td>
                    <td className="p-4 font-medium">
                      {Math.round(nativeVal).toLocaleString()} {h.currency}
                    </td>
                    <td className="p-4 font-bold text-indigo-400">
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