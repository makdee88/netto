import React, { useState } from 'react';
import type { Database } from 'sql.js';
import { HoldingRow, CurrencyCode, BrokerType } from '../types';
import {
  FileSpreadsheet,
  Trash2,
  Plus,
  Landmark,
  Building,
  CreditCard,
  Upload,
  ArrowLeft,
} from 'lucide-react';
import { getProperties, getLiabilities } from '../db/database';
import { BrokerGuide } from './BrokerGuide';

interface ManageAssetsTabProps {
  db: Database;
  holdings: HoldingRow[];
  theme: 'dark' | 'light';
  onBackToOverview: () => void;
  onCsvImport: (file: File, broker: string) => void;
  onClearBroker: (broker: string) => void;
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
  onAddProperty: (p: {
    name: string;
    property_type: string;
    currency: CurrencyCode;
    buy_price: number;
    buy_month: number;
    buy_year: number;
    current_price: number;
  }) => void;
  onAddLiability: (l: {
    name: string;
    liability_type: string;
    currency: CurrencyCode;
    total_loan: number;
    remaining_balance: number;
    interest_rate: number;
  }) => void;
  onDeleteHolding: (id: number) => void;
  onDeleteProperty: (id: number) => void;
  onDeleteLiability: (id: number) => void;
}

const BROKER_OPTIONS: { value: BrokerType; label: string }[] = [
  { value: 'Avanza', label: 'Avanza (Sweden)' },
  { value: 'Nordnet', label: 'Nordnet (Nordics)' },
  { value: 'Zerodha', label: 'Zerodha (India)' },
  { value: 'Groww', label: 'Groww (India)' },
  { value: 'InteractiveBrokers', label: 'Interactive Brokers' },
  { value: 'Degiro', label: 'DEGIRO' },
  { value: 'Generic', label: 'Other / Custom CSV' },
];

export const ManageAssetsTab: React.FC<ManageAssetsTabProps> = ({
  db,
  holdings,
  theme,
  onBackToOverview,
  onCsvImport,
  onClearBroker,
  onAddFD,
  onAddProperty,
  onAddLiability,
  onDeleteHolding,
  onDeleteProperty,
  onDeleteLiability,
}) => {
  const isDark = theme === 'dark';
  const properties = getProperties(db);
  const liabilities = getLiabilities(db);

  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('Avanza');
  const [activeFormTab, setActiveFormTab] = useState<'EQUITY' | 'FD' | 'PROPERTY' | 'LIABILITY'>('EQUITY');

  // Fixed Deposit Form (compounding_freq as number: 1=Annual, 2=Semi-Annual, 4=Quarterly, 12=Monthly)
  const [fdForm, setFdForm] = useState({
    name: '',
    broker: 'Bank',
    currency: 'SEK' as CurrencyCode,
    principal: 0,
    interest_rate: 3.5,
    compounding_freq: 4,
    start_date: new Date().toISOString().slice(0, 10),
    maturity_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });

  // Property Form
  const [propForm, setPropForm] = useState({
    name: '',
    property_type: 'Apartment',
    currency: 'SEK' as CurrencyCode,
    buy_price: 0,
    buy_month: new Date().getMonth() + 1,
    buy_year: new Date().getFullYear(),
    current_price: 0,
  });

  // Liability Form
  const [liabForm, setLiabForm] = useState({
    name: '',
    liability_type: 'Mortgage',
    currency: 'SEK' as CurrencyCode,
    total_loan: 0,
    remaining_balance: 0,
    interest_rate: 3.5,
  });

  const equityHoldings = holdings.filter((h) => h.category === 'EQUITY');
  const fdHoldings = holdings.filter((h) => h.category === 'FIXED_DEPOSIT');

  const formatCompoundingLabel = (freq: number) => {
    if (freq === 12) return 'Monthly';
    if (freq === 4) return 'Quarterly';
    if (freq === 2) return 'Semi-Annual';
    return 'Annual';
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToOverview}
          className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition"
        >
          <ArrowLeft className="w-4 h-4"/> Back to Overview
        </button>
        <div className="flex items-center gap-1 bg-slate-950/20 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveFormTab('EQUITY')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeFormTab === 'EQUITY' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            Broker Import
          </button>
          <button
            onClick={() => setActiveFormTab('FD')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeFormTab === 'FD' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            Fixed Deposits
          </button>
          <button
            onClick={() => setActiveFormTab('PROPERTY')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeFormTab === 'PROPERTY' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            Real Estate
          </button>
          <button
            onClick={() => setActiveFormTab('LIABILITY')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeFormTab === 'LIABILITY' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            Loans & Mortgages
          </button>
        </div>
      </div>

      {/* 1. Broker Import Section */}
      {activeFormTab === 'EQUITY' && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-sm ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-dashed border-slate-800/40">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400"/>
                <h3 className="text-base font-bold">Broker Ledger Import</h3>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Select your broker below to view export instructions and upload your CSV or Excel (.xlsx) report.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedBroker}
                onChange={(e) => setSelectedBroker(e.target.value as BrokerType)}
                className={`border rounded-xl px-3 py-2 text-xs font-bold ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {BROKER_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>

              <label
                htmlFor="broker-file-upload"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md transition"
              >
                <Upload className="w-4 h-4"/>
                <span>Upload File</span>
              </label>
              <input
                    type="file"
                    accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log('File selected:', file.name, file.size, file.type);
                        try {
                          await onCsvImport(file, selectedBroker);
                          console.log('Import completed successfully');
                        } catch (err: any) {
                          console.error('Import error caught:', err);
                          alert(`Import failed: ${err?.message || err}`);
                        } finally {
                          e.target.value = ''; // Reset input
                        }
                      }
                    }}
                    className="hidden"
                    id="broker-file-input"
                  />
              <button
                onClick={() => {
                  if (confirm(`Wipe all imported transactions and holdings for ${selectedBroker}?`)) {
                    onClearBroker(selectedBroker);
                  }
                }}
                className="p-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition"
                title={`Clear ${selectedBroker} Ledger`}
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* Step-by-Step Broker Export Guide */}
          <BrokerGuide broker={selectedBroker} isDark={isDark} />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/40 opacity-70">
                  <th className="pb-3">Broker</th>
                  <th className="pb-3">Asset / Name</th>
                  <th className="pb-3">ISIN</th>
                  <th className="pb-3 text-right">Quantity</th>
                  <th className="pb-3 text-right">Avg Purchase Price</th>
                  <th className="pb-3 text-right">Current Market Price</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/20">
                {equityHoldings.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/10 transition">
                    <td className="py-3 font-bold">{h.broker}</td>
                    <td className="py-3">
                      <div className="font-semibold">{h.name}</div>
                      <div className="text-[10px] opacity-60 font-mono">{h.symbol}</div>
                    </td>
                    <td className="py-3 font-mono text-[10px] opacity-75">{h.isin || '-'}</td>
                    <td className="py-3 text-right font-medium">{h.quantity}</td>
                    <td className="py-3 text-right font-mono">
                      {h.avg_price.toFixed(2)} {h.currency}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {h.market_price > 0 ? `${h.market_price.toFixed(2)} ${h.currency}` : '-'}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onDeleteHolding(h.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                  </tr>
                ))}
                {equityHoldings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 opacity-60 text-xs">
                      No equity holdings found. Select your broker above and upload a report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Fixed Deposits Form & Table */}
      {activeFormTab === 'FD' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="w-4 h-4 text-emerald-400"/>
              <h3 className="text-sm font-bold">New Fixed Deposit</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddFD({
                  ...fdForm,
                  symbol: `FD_${Date.now()}`,
                });
                setFdForm({ ...fdForm, name: '', principal: 0 });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block mb-1 opacity-70">Deposit / Bank Name</label>
                <input
                  type="text"
                  required
                  value={fdForm.name}
                  onChange={(e) => setFdForm({ ...fdForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. SBAB Fasträntekonto 1Y"
                />
              </div>

              <div>
                <label className="block mb-1 opacity-70">Institution / Broker</label>
                <input
                  type="text"
                  required
                  value={fdForm.broker}
                  onChange={(e) => setFdForm({ ...fdForm, broker: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. SBAB, HDFC Bank"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Currency</label>
                  <select
                    value={fdForm.currency}
                    onChange={(e) => setFdForm({ ...fdForm, currency: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="SEK">SEK</option>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Principal</label>
                  <input
                    type="number"
                    required
                    value={fdForm.principal || ''}
                    onChange={(e) => setFdForm({ ...fdForm, principal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fdForm.interest_rate}
                    onChange={(e) =>
                      setFdForm({ ...fdForm, interest_rate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Compounding</label>
                  <select
                    value={fdForm.compounding_freq}
                    onChange={(e) =>
                      setFdForm({ ...fdForm, compounding_freq: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value={1}>Annual (1x/yr)</option>
                    <option value={2}>Semi-Annual (2x/yr)</option>
                    <option value={4}>Quarterly (4x/yr)</option>
                    <option value={12}>Monthly (12x/yr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Start Date</label>
                  <input
                    type="date"
                    value={fdForm.start_date}
                    onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Maturity Date</label>
                  <input
                    type="date"
                    value={fdForm.maturity_date}
                    onChange={(e) => setFdForm({ ...fdForm, maturity_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5"/> Save Deposit
              </button>
            </form>
          </div>

          <div
            className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-sm font-bold mb-4">Active Fixed Deposits</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40 opacity-70">
                    <th className="pb-2">Institution</th>
                    <th className="pb-2">Deposit Name</th>
                    <th className="pb-2 text-right">Principal</th>
                    <th className="pb-2 text-right">Interest</th>
                    <th className="pb-2 text-right">Maturity</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {fdHoldings.map((fd) => (
                    <tr key={fd.id} className="hover:bg-slate-800/10 transition">
                      <td className="py-3 font-semibold">{fd.broker}</td>
                      <td className="py-3">{fd.name}</td>
                      <td className="py-3 text-right font-mono font-medium">
                        {fd.principal.toLocaleString()} {fd.currency}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-400">
                        {fd.interest_rate}% ({formatCompoundingLabel(fd.compounding_freq)})
                      </td>
                      <td className="py-3 text-right font-mono opacity-80">{fd.maturity_date || '-'}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onDeleteHolding(fd.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fdHoldings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 opacity-60">
                        No fixed deposits recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Real Estate / Properties Form & Table */}
      {activeFormTab === 'PROPERTY' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-4 h-4 text-sky-400"/>
              <h3 className="text-sm font-bold">Add Property / Estate</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddProperty(propForm);
                setPropForm({ ...propForm, name: '', buy_price: 0, current_price: 0 });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block mb-1 opacity-70">Property Label</label>
                <input
                  type="text"
                  required
                  value={propForm.name}
                  onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. Primary Apartment"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Type</label>
                  <select
                    value={propForm.property_type}
                    onChange={(e) => setPropForm({ ...propForm, property_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="House / Villa">House / Villa</option>
                    <option value="Plot / Land">Plot / Land</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Currency</label>
                  <select
                    value={propForm.currency}
                    onChange={(e) => setPropForm({ ...propForm, currency: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="SEK">SEK</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Buy Month</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={propForm.buy_month}
                    onChange={(e) =>
                      setPropForm({ ...propForm, buy_month: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Buy Year</label>
                  <input
                    type="number"
                    min="1950"
                    max="2100"
                    value={propForm.buy_year}
                    onChange={(e) =>
                      setPropForm({ ...propForm, buy_year: parseInt(e.target.value, 10) || 2026 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Purchase Cost</label>
                  <input
                    type="number"
                    required
                    value={propForm.buy_price || ''}
                    onChange={(e) =>
                      setPropForm({ ...propForm, buy_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                    placeholder="3000000"
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Current Value</label>
                  <input
                    type="number"
                    required
                    value={propForm.current_price || ''}
                    onChange={(e) =>
                      setPropForm({ ...propForm, current_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                    placeholder="3500000"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5"/> Save Property
              </button>
            </form>
          </div>

          <div
            className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-sm font-bold mb-4">Real Estate Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40 opacity-70">
                    <th className="pb-2">Property</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Acquired</th>
                    <th className="pb-2 text-right">Purchase Cost</th>
                    <th className="pb-2 text-right">Current Valuation</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {properties.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/10 transition">
                      <td className="py-3 font-semibold">{p.name}</td>
                      <td className="py-3 opacity-80">{p.property_type}</td>
                      <td className="py-3 font-mono opacity-80">
                        {p.buy_month}/{p.buy_year}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {p.buy_price.toLocaleString()} {p.currency}
                      </td>
                      <td className="py-3 text-right font-mono text-sky-400 font-bold">
                        {p.current_price.toLocaleString()} {p.currency}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onDeleteProperty(p.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {properties.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 opacity-60">
                        No properties added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Liabilities / Loans Form & Table */}
      {activeFormTab === 'LIABILITY' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-rose-400"/>
              <h3 className="text-sm font-bold">Add Loan / Liability</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddLiability(liabForm);
                setLiabForm({ ...liabForm, name: '', total_loan: 0, remaining_balance: 0 });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block mb-1 opacity-70">Liability Description</label>
                <input
                  type="text"
                  required
                  value={liabForm.name}
                  onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. Nordea Apartment Mortgage"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Type</label>
                  <select
                    value={liabForm.liability_type}
                    onChange={(e) => setLiabForm({ ...liabForm, liability_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="Mortgage">Mortgage</option>
                    <option value="Vehicle Loan">Vehicle Loan</option>
                    <option value="Personal Loan">Personal Loan</option>
                    <option value="Credit / Other">Credit / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Currency</label>
                  <select
                    value={liabForm.currency}
                    onChange={(e) => setLiabForm({ ...liabForm, currency: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="SEK">SEK</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Original Principal</label>
                  <input
                    type="number"
                    value={liabForm.total_loan || ''}
                    onChange={(e) =>
                      setLiabForm({ ...liabForm, total_loan: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                    placeholder="2500000"
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Interest (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={liabForm.interest_rate}
                    onChange={(e) =>
                      setLiabForm({ ...liabForm, interest_rate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 opacity-70">Remaining Principal Balance</label>
                <input
                  type="number"
                  required
                  value={liabForm.remaining_balance || ''}
                  onChange={(e) =>
                    setLiabForm({
                      ...liabForm,
                      remaining_balance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="2100000"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5"/> Save Liability
              </button>
            </form>
          </div>

          <div
            className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-sm font-bold mb-4">Current Liabilities</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40 opacity-70">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Interest Rate</th>
                    <th className="pb-2 text-right">Remaining Principal</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {liabilities.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/10 transition">
                      <td className="py-3 font-semibold">{l.name}</td>
                      <td className="py-3 opacity-80">{l.liability_type}</td>
                      <td className="py-3 text-right font-mono text-rose-400">
                        {l.interest_rate}%
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-rose-400">
                        -{l.remaining_balance.toLocaleString()} {l.currency}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onDeleteLiability(l.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {liabilities.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 opacity-60">
                        No liabilities or debts recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};