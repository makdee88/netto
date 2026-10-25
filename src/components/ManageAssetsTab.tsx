import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Landmark,
  Trash2,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import { BrokerGuide } from './BrokerGuide';
import { calculateFDCurrentValue } from '../db/database';
import { BrokerType, CurrencyCode, HoldingRow } from '../types';

interface ManageAssetsTabProps {
  holdings: HoldingRow[];
  theme: 'dark' | 'light';
  onBackToOverview: () => void;
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
  onDeleteHolding: (id: number) => void;
}

export const ManageAssetsTab: React.FC<ManageAssetsTabProps> = ({
  holdings,
  theme,
  onBackToOverview,
  onCsvImport,
  onAddFD,
  onDeleteHolding,
}) => {
  const isDark = theme === 'dark';
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('AVANZA');
  const [showGuide, setShowGuide] = useState(true);
  const [fdInputMode, setFdInputMode] = useState<'SINGLE' | 'QUICK_BULK'>('SINGLE');
  
  const [bulkFdText, setBulkFdText] = useState(
    'Bank Name, FD Ref, Description, Principal, Rate %, Currency (INR/SEK/USD/EUR), Start Date (YYYY-MM-DD), Maturity Date\nSBI, FD-001, Tax Saver, 500000, 7.25, INR, 2025-01-15, 2030-01-15'
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

  const handleBulkFdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkFdText.split('\n').slice(1);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard Overview
        </button>
        <h2 className="text-lg font-bold">Manage, Import & Edit Assets</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Guided Broker Import */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-base">Guided Broker Position Import</h3>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <HelpCircle className="w-3.5 h-3.5" /> {showGuide ? 'Hide Guide' : 'Show Guide'}
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold opacity-80">Select Broker / Platform:</label>
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value as BrokerType)}
              className={`w-full border rounded-xl px-3 py-2.5 text-xs font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            >
              <option value="AVANZA">Avanza (Sweden)</option>
              <option value="NORDNET">Nordnet (Nordics)</option>
              <option value="ZERODHA">Zerodha Console (India)</option>
              <option value="UPSTOX">Upstox (India)</option>
              <option value="IBKR">Interactive Brokers (Global)</option>
            </select>
          </div>

          {showGuide && <BrokerGuide broker={selectedBroker} theme={theme} />}

          <div className="pt-2">
            <label className="block text-xs font-semibold opacity-80 mb-1.5">Upload Exported CSV File:</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvImport(f, selectedBroker);
              }}
              className="w-full text-xs file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer border border-dashed border-slate-700 rounded-xl p-3"
            />
          </div>
        </div>

        {/* Fixed Deposits & Savings */}
        <div className={`border p-6 rounded-2xl space-y-3 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <Landmark className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-base">Fixed Deposits & Savings Accounts</h3>
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
                Bulk Paste
              </button>
            </div>
          </div>

          {fdInputMode === 'SINGLE' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddFD(fdForm);
              }}
              className="grid grid-cols-2 gap-3 text-xs pt-1"
            >
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Bank Name</label>
                <input
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.broker}
                  onChange={(e) => setFdForm({ ...fdForm, broker: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Account / Ref ID</label>
                <input
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.symbol}
                  onChange={(e) => setFdForm({ ...fdForm, symbol: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] opacity-70 mb-1">Description / Name</label>
                <input
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.name}
                  onChange={(e) => setFdForm({ ...fdForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Principal Amount</label>
                <input
                  type="number"
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.principal}
                  onChange={(e) => setFdForm({ ...fdForm, principal: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.interest_rate}
                  onChange={(e) => setFdForm({ ...fdForm, interest_rate: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Currency</label>
                <select
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.currency}
                  onChange={(e) => setFdForm({ ...fdForm, currency: e.target.value as CurrencyCode })}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="SEK">SEK (kr)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] opacity-70 mb-1">Start Date</label>
                <input
                  type="date"
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.start_date}
                  onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] opacity-70 mb-1">Maturity Date</label>
                <input
                  type="date"
                  className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                  value={fdForm.maturity_date}
                  onChange={(e) => setFdForm({ ...fdForm, maturity_date: e.target.value })}
                />
              </div>
              <div className="col-span-2 pt-1">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold py-2.5 transition text-xs shadow"
                >
                  Save Fixed Deposit
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkFdSubmit} className="space-y-3 text-xs pt-1">
              <p className="opacity-70 text-[11px]">
                Paste comma-separated rows (Bank, ID, Name, Principal, Rate %, Currency, StartDate, MaturityDate):
              </p>
              <textarea
                rows={5}
                value={bulkFdText}
                onChange={(e) => setBulkFdText(e.target.value)}
                className={`w-full font-mono text-[11px] p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold py-2.5 transition text-xs shadow"
              >
                Import Bulk Fixed Deposits
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Delete / Edit Existing Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b">
          <h3 className="font-bold text-sm">Delete / Remove Individual Holdings</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <tr>
              <th className="p-4">Broker / Bank</th>
              <th className="p-4">Asset</th>
              <th className="p-4">Type</th>
              <th className="p-4">Value</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center opacity-60">No holdings in database.</td>
              </tr>
            ) : (
              holdings.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
                const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
                return (
                  <tr key={h.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">{h.broker}</td>
                    <td className="p-4">{h.name} ({h.symbol})</td>
                    <td className="p-4">{h.category}</td>
                    <td className="p-4 font-medium">{Math.round(nativeVal).toLocaleString()} {h.currency}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${h.name} from Netto?`)) onDeleteHolding(h.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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