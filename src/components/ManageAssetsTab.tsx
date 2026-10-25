import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Landmark,
  Building2,
  CreditCard,
  Trash2,
  ArrowLeft,
  HelpCircle,
  Plus,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { BrokerGuide } from './BrokerGuide';
import { calculateFDCurrentValue, getProperties, getLiabilities } from '../db/database';
import { BrokerType, CurrencyCode, HoldingRow, PropertyType, LiabilityType, PropertyRow, LiabilityRow } from '../types';
import type { Database } from 'sql.js';

interface ManageAssetsTabProps {
  db: Database;
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
  onAddProperty: (p: { name: string; property_type: PropertyType; currency: CurrencyCode; buy_price: number; buy_month: number; buy_year: number; current_price: number }) => void;
  onAddLiability: (l: { name: string; liability_type: LiabilityType; currency: CurrencyCode; total_loan: number; remaining_balance: number; interest_rate: number }) => void;
  onDeleteHolding: (id: number) => void;
  onDeleteProperty: (id: number) => void;
  onDeleteLiability: (id: number) => void;
}

export const ManageAssetsTab: React.FC<ManageAssetsTabProps> = ({
  db,
  holdings,
  theme,
  onBackToOverview,
  onCsvImport,
  onAddFD,
  onAddProperty,
  onAddLiability,
  onDeleteHolding,
  onDeleteProperty,
  onDeleteLiability,
}) => {
  const isDark = theme === 'dark';
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('AVANZA');
  const [showGuide, setShowGuide] = useState(true);

  // CSV Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');

  const properties: PropertyRow[] = getProperties(db);
  const liabilities: LiabilityRow[] = getLiabilities(db);

  // Friendly FD Wizard Form State
  const [fdForm, setFdForm] = useState({
    broker: 'SBI Bank / Savings Account',
    symbol: 'FD-001',
    name: 'Fixed Deposit',
    currency: 'INR' as CurrencyCode,
    principal: 100000,
    interest_rate: 7.0,
    start_date: new Date().toISOString().slice(0, 10),
    tenure_years: 3,
  });

  // Property Form State
  const [propForm, setPropForm] = useState({
    name: 'Stockholm Apartment',
    property_type: 'APARTMENT' as PropertyType,
    currency: 'SEK' as CurrencyCode,
    buy_price: 3500000,
    buy_month: 6,
    buy_year: 2022,
    current_price: 3800000,
  });

  // Liability Form State
  const [liabForm, setLiabForm] = useState({
    name: 'House Mortgage',
    liability_type: 'MORTGAGE' as LiabilityType,
    currency: 'SEK' as CurrencyCode,
    total_loan: 2800000,
    remaining_balance: 2650000,
    interest_rate: 4.25,
  });

  const handleExecuteImport = () => {
    if (!selectedFile) {
      alert('Please select a CSV file first.');
      return;
    }
    setImportStatus('Processing CSV...');
    onCsvImport(selectedFile, selectedBroker);
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
        <h2 className="text-lg font-bold">Manage Assets, Properties, Loans & Imports</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Guided Broker Import with Explicit Button */}
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

          {/* File Picker & Explicit Upload Button */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold opacity-80">Choose Exported CSV File:</label>
            <div className={`border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer relative ${isDark ? 'border-slate-700 bg-slate-950/50 hover:border-indigo-500' : 'border-slate-300 bg-slate-50 hover:border-indigo-500'}`}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFile(f);
                    setImportStatus('');
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center space-y-1">
                <UploadCloud className="w-6 h-6 text-indigo-400 mb-1" />
                <span className="text-xs font-semibold">
                  {selectedFile ? selectedFile.name : 'Click to browse or drop CSV file here'}
                </span>
                <span className="text-[10px] opacity-60">Supports semicolon & comma delimiters</span>
              </div>
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={handleExecuteImport}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold py-3 transition text-xs shadow-lg flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" /> Upload & Parse {selectedBroker} CSV
              </button>
            )}

            {importStatus && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* User-Friendly Fixed Deposit Wizard */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <Landmark className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base">Quick Add Fixed Deposit / Savings</h3>
          </div>
          <p className="text-xs opacity-70">
            Enter deposit details below. Maturity date is calculated automatically based on tenure.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const startDate = new Date(fdForm.start_date);
              const maturityDate = new Date(startDate);
              maturityDate.setFullYear(startDate.getFullYear() + Number(fdForm.tenure_years));

              onAddFD({
                broker: fdForm.broker,
                symbol: fdForm.symbol,
                name: fdForm.name,
                currency: fdForm.currency,
                principal: fdForm.principal,
                interest_rate: fdForm.interest_rate,
                compounding_freq: 4,
                start_date: fdForm.start_date,
                maturity_date: maturityDate.toISOString().slice(0, 10),
              });
              alert(`Added Fixed Deposit: ${fdForm.name}`);
            }}
            className="grid grid-cols-2 gap-3 text-xs"
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
              <label className="block text-[10px] opacity-70 mb-1">Account / Receipt ID</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.symbol}
                onChange={(e) => setFdForm({ ...fdForm, symbol: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] opacity-70 mb-1">Description</label>
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
              <label className="block text-[10px] opacity-70 mb-1">Tenure (Years)</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.tenure_years}
                onChange={(e) => setFdForm({ ...fdForm, tenure_years: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] opacity-70 mb-1">Start Date</label>
              <input
                type="date"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={fdForm.start_date}
                onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
              />
            </div>
            <div className="col-span-2 pt-1">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold py-2.5 transition text-xs shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Fixed Deposit
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Properties & Liabilities Form Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Add Property Form */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Add Real Estate / Property</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddProperty(propForm);
              alert(`Added Property: ${propForm.name}`);
            }}
            className="grid grid-cols-2 gap-3 text-xs"
          >
            <div className="col-span-2">
              <label className="block text-[10px] opacity-70 mb-1">Property Name / Location</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.name}
                onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Type</label>
              <select
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.property_type}
                onChange={(e) => setPropForm({ ...propForm, property_type: e.target.value as PropertyType })}
              >
                <option value="APARTMENT">Apartment</option>
                <option value="HOUSE">House</option>
                <option value="LAND">Land</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Currency</label>
              <select
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.currency}
                onChange={(e) => setPropForm({ ...propForm, currency: e.target.value as CurrencyCode })}
              >
                <option value="SEK">SEK (kr)</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Buy Price</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.buy_price}
                onChange={(e) => setPropForm({ ...propForm, buy_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Current Valuation</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.current_price}
                onChange={(e) => setPropForm({ ...propForm, current_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Acquisition Month (1-12)</label>
              <input
                type="number"
                min="1"
                max="12"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.buy_month}
                onChange={(e) => setPropForm({ ...propForm, buy_month: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Acquisition Year (YYYY)</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={propForm.buy_year}
                onChange={(e) => setPropForm({ ...propForm, buy_year: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 pt-1">
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold py-2.5 transition text-xs shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Property
              </button>
            </div>
          </form>
        </div>

        {/* Add Liability Form */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-base">Add Liability / Loan</h3>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddLiability(liabForm);
              alert(`Added Liability: ${liabForm.name}`);
            }}
            className="grid grid-cols-2 gap-3 text-xs"
          >
            <div className="col-span-2">
              <label className="block text-[10px] opacity-70 mb-1">Loan Name / Lender</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.name}
                onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Type</label>
              <select
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.liability_type}
                onChange={(e) => setLiabForm({ ...liabForm, liability_type: e.target.value as LiabilityType })}
              >
                <option value="MORTGAGE">House Mortgage</option>
                <option value="CAR_LOAN">Car Loan</option>
                <option value="PERSONAL_LOAN">Personal Loan</option>
                <option value="CREDIT_CARD">Credit Card / Line of Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Currency</label>
              <select
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.currency}
                onChange={(e) => setLiabForm({ ...liabForm, currency: e.target.value as CurrencyCode })}
              >
                <option value="SEK">SEK (kr)</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Original Loan Amount</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.total_loan}
                onChange={(e) => setLiabForm({ ...liabForm, total_loan: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] opacity-70 mb-1">Remaining Balance</label>
              <input
                type="number"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.remaining_balance}
                onChange={(e) => setLiabForm({ ...liabForm, remaining_balance: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] opacity-70 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                value={liabForm.interest_rate}
                onChange={(e) => setLiabForm({ ...liabForm, interest_rate: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 pt-1">
              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold py-2.5 transition text-xs shadow flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Liability
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b">
          <h3 className="font-bold text-sm">Delete / Remove Holdings, Properties or Liabilities</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <tr>
              <th className="p-4">Source / Entity</th>
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Value / Balance</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {holdings.length === 0 && properties.length === 0 && liabilities.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center opacity-60">No items in database.</td>
              </tr>
            ) : (
              <>
                {holdings.map((h) => {
                  const isFD = h.category === 'FIXED_DEPOSIT';
                  const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
                  return (
                    <tr key={`h-${h.id}`} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="p-4 font-semibold">{h.broker}</td>
                      <td className="p-4">{h.name} ({h.symbol})</td>
                      <td className="p-4">{h.category}</td>
                      <td className="p-4 font-medium">{Math.round(nativeVal).toLocaleString()} {h.currency}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => { if (confirm(`Delete ${h.name}?`)) onDeleteHolding(h.id); }}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {properties.map((p) => (
                  <tr key={`p-${p.id}`} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">Real Estate</td>
                    <td className="p-4">{p.name}</td>
                    <td className="p-4 uppercase">PROPERTY</td>
                    <td className="p-4 font-medium">{Math.round(p.current_price).toLocaleString()} {p.currency}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => { if (confirm(`Delete property ${p.name}?`)) onDeleteProperty(p.id); }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {liabilities.map((l) => (
                  <tr key={`l-${l.id}`} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">Liability</td>
                    <td className="p-4">{l.name}</td>
                    <td className="p-4 uppercase">LOAN</td>
                    <td className="p-4 font-medium text-rose-400">-{Math.round(l.remaining_balance).toLocaleString()} {l.currency}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => { if (confirm(`Delete liability ${l.name}?`)) onDeleteLiability(l.id); }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};