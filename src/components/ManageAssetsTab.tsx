import React, { useState } from 'react';
import type { Database } from 'sql.js';
import {
  Upload,
  Building2,
  CreditCard,
  PlusCircle,
  Trash2,
  FileSpreadsheet,
  ArrowLeft,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { BrokerType, CurrencyCode, HoldingRow, PropertyType, LiabilityType } from '../types';
import { clearBrokerData, getProperties, getLiabilities } from '../db/database';
import { BrokerGuide } from './BrokerGuide';

interface ManageAssetsTabProps {
  db: Database;
  holdings: HoldingRow[];
  theme: 'dark' | 'light';
  onBackToOverview: () => void;
  onCsvImport: (file: File, broker: BrokerType) => void;
  onClearBroker: (brokerName: string) => void; // Added prop
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
    property_type: PropertyType;
    currency: CurrencyCode;
    buy_price: number;
    buy_month: number;
    buy_year: number;
    current_price: number;
  }) => void;
  onAddLiability: (l: {
    name: string;
    liability_type: LiabilityType;
    currency: CurrencyCode;
    total_loan: number;
    remaining_balance: number;
    interest_rate: number;
  }) => void;
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
  const [activeBroker, setActiveBroker] = useState<BrokerType>('AVANZA');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // FD Form State
  const [fdBroker, setFdBroker] = useState('Swedbank');
  const [fdName, setFdName] = useState('Fast-Deposit 1');
  const [fdCurrency, setFdCurrency] = useState<CurrencyCode>('SEK');
  const [fdPrincipal, setFdPrincipal] = useState<string>('50000');
  const [fdRate, setFdRate] = useState<string>('3.75');
  const [fdStart, setFdStart] = useState<string>('2025-01-01');
  const [fdMaturity, setFdMaturity] = useState<string>('2026-01-01');

  // Property Form State
  const [propName, setPropName] = useState('Stockholm Apartment');
  const [propType, setPropType] = useState<PropertyType>('APARTMENT');
  const [propCurr, setPropCurr] = useState<CurrencyCode>('SEK');
  const [propBuyPrice, setPropBuyPrice] = useState('2500000');
  const [propBuyMonth, setPropBuyMonth] = useState('6');
  const [propBuyYear, setPropBuyYear] = useState('2021');
  const [propCurrVal, setPropCurrVal] = useState('2900000');

  // Liability Form State
  const [liabName, setLiabName] = useState('Home Mortgage');
  const [liabType, setLiabType] = useState<LiabilityType>('MORTGAGE');
  const [liabCurr, setLiabCurr] = useState<CurrencyCode>('SEK');
  const [liabTotal, setLiabTotal] = useState('2000000');
  const [liabRem, setLiabRem] = useState('1850000');
  const [liabRate, setLiabRate] = useState('4.25');

  const properties = getProperties(db);
  const liabilities = getLiabilities(db);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Manage & Import Assets</h2>
          <p className="text-xs opacity-60">Sync broker CSVs, add fixed deposits, real estate, and loans.</p>
        </div>
        <button
          onClick={onBackToOverview}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
            isDark ? 'bg-slate-900 border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-300 hover:bg-slate-100'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Overview
        </button>
      </div>

      {/* Section 1: Broker CSV Import & Ledger Reset */}
      <div className={`border p-6 rounded-3xl space-y-6 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-4 border-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Incremental Broker CSV Import</h3>
              <p className="text-[11px] opacity-60">Upload export statements from Avanza, Nordnet, Zerodha, Upstox, or IBKR.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(['AVANZA', 'NORDNET', 'ZERODHA', 'UPSTOX', 'IBKR'] as BrokerType[]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setActiveBroker(b);
                  setSelectedFile(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeBroker === b
                    ? 'bg-indigo-600 text-white shadow'
                    : isDark
                    ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          <BrokerGuide broker={activeBroker} theme={theme} />

          <div className={`p-6 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="font-bold text-xs uppercase tracking-wider opacity-80">Upload {activeBroker} Statement</h4>

            <div className="space-y-3">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className={`w-full text-xs file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:cursor-pointer transition ${
                  isDark
                    ? 'text-slate-400 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500'
                    : 'text-slate-600 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500'
                }`}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={() => {
                    if (selectedFile) {
                      onCsvImport(selectedFile, activeBroker);
                      setSelectedFile(null);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow flex items-center justify-center gap-1.5 transition"
                >
                  <Upload className="w-4 h-4" /> Import & Replay Ledger
                </button>

                {/* Explicit Clear Broker History Button */}
                <button
                  type="button"
                  onClick={() => {
                    const brokerLabel = activeBroker === 'AVANZA' ? 'Avanza' : activeBroker === 'NORDNET' ? 'Nordnet' : activeBroker;
                    if (confirm(`Clear all transaction history and holdings for ${brokerLabel}?\n\nThis will permanently remove all stored trades for this broker from your vault so you can start fresh.`)) {
                      onClearBroker(brokerLabel);
                    }
                  }}
                  className={`px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                    isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                  }`}
                  title={`Permanently delete all stored transactions & holdings for ${activeBroker}`}
                >
                  <Trash2 className="w-4 h-4" /> Clear {activeBroker} History
                </button>
              </div>
            </div>

            <p className="text-[10px] opacity-60 leading-relaxed">
              <b>Smart Ledger:</b> Netto safely deduplicates rows using occurrence fingerprint hashes. You can upload overlapping date ranges or incremental monthly exports without duplicating trades.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Fixed Deposits & Savings */}
      <div className={`border p-6 rounded-3xl space-y-6 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2.5 border-b pb-4 border-slate-800/40">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Fixed Deposits & Savings Accounts</h3>
            <p className="text-[11px] opacity-60">Track principal amounts, compound interest rates, and maturity timelines.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddFD({
              broker: fdBroker,
              symbol: fdName.toLowerCase().replace(/\s+/g, '_'),
              name: fdName,
              currency: fdCurrency,
              principal: parseFloat(fdPrincipal) || 0,
              interest_rate: parseFloat(fdRate) || 0,
              compounding_freq: 4,
              start_date: fdStart,
              maturity_date: fdMaturity,
            });
          }}
          className="grid md:grid-cols-4 gap-4 text-xs"
        >
          <div>
            <label className="block opacity-70 mb-1">Bank / Institution</label>
            <input
              type="text"
              value={fdBroker}
              onChange={(e) => setFdBroker(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Deposit Name</label>
            <input
              type="text"
              value={fdName}
              onChange={(e) => setFdName(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Principal Amount</label>
            <input
              type="number"
              value={fdPrincipal}
              onChange={(e) => setFdPrincipal(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Currency</label>
            <select
              value={fdCurrency}
              onChange={(e) => setFdCurrency(e.target.value as CurrencyCode)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="SEK">SEK</option>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="block opacity-70 mb-1">Interest Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={fdRate}
              onChange={(e) => setFdRate(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Start Date</label>
            <input
              type="date"
              value={fdStart}
              onChange={(e) => setFdStart(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Maturity Date</label>
            <input
              type="date"
              value={fdMaturity}
              onChange={(e) => setFdMaturity(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow flex items-center justify-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" /> Save Fixed Deposit
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Real Estate & Properties */}
      <div className={`border p-6 rounded-3xl space-y-6 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2.5 border-b pb-4 border-slate-800/40">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Real Estate & Properties</h3>
            <p className="text-[11px] opacity-60">Track apartments, houses, land, and current market valuations.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddProperty({
              name: propName,
              property_type: propType,
              currency: propCurr,
              buy_price: parseFloat(propBuyPrice) || 0,
              buy_month: parseInt(propBuyMonth, 10) || 1,
              buy_year: parseInt(propBuyYear, 10) || 2020,
              current_price: parseFloat(propCurrVal) || 0,
            });
          }}
          className="grid md:grid-cols-4 gap-4 text-xs"
        >
          <div>
            <label className="block opacity-70 mb-1">Property Name</label>
            <input
              type="text"
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Property Type</label>
            <select
              value={propType}
              onChange={(e) => setPropType(e.target.value as PropertyType)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="APARTMENT">Apartment</option>
              <option value="HOUSE">House</option>
              <option value="LAND">Land</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </div>
          <div>
            <label className="block opacity-70 mb-1">Acquisition Buy Price</label>
            <input
              type="number"
              value={propBuyPrice}
              onChange={(e) => setPropBuyPrice(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Current Valuation</label>
            <input
              type="number"
              value={propCurrVal}
              onChange={(e) => setPropCurrVal(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Buy Month (1-12)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={propBuyMonth}
              onChange={(e) => setPropBuyMonth(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Buy Year</label>
            <input
              type="number"
              value={propBuyYear}
              onChange={(e) => setPropBuyYear(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Currency</label>
            <select
              value={propCurr}
              onChange={(e) => setPropCurr(e.target.value as CurrencyCode)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="SEK">SEK</option>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow flex items-center justify-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" /> Save Property
            </button>
          </div>
        </form>

        {properties.length > 0 && (
          <div className="pt-4 border-t border-slate-800/40 space-y-2">
            <h4 className="font-bold text-xs opacity-70">Saved Properties</h4>
            <div className="space-y-2">
              {properties.map((p) => (
                <div key={p.id} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <span className="font-bold">{p.name}</span>
                    <span className="opacity-60 text-[10px] ml-2">({p.property_type} • bought {p.buy_month}/{p.buy_year})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-emerald-400">{p.current_price.toLocaleString()} {p.currency}</span>
                    <button onClick={() => onDeleteProperty(p.id)} className="text-rose-400 hover:text-rose-300 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Liabilities & Loans */}
      <div className={`border p-6 rounded-3xl space-y-6 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2.5 border-b pb-4 border-slate-800/40">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Liabilities & Outstanding Loans</h3>
            <p className="text-[11px] opacity-60">Track mortgages, car loans, personal loans, and credit balances.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddLiability({
              name: liabName,
              liability_type: liabType,
              currency: liabCurr,
              total_loan: parseFloat(liabTotal) || 0,
              remaining_balance: parseFloat(liabRem) || 0,
              interest_rate: parseFloat(liabRate) || 0,
            });
          }}
          className="grid md:grid-cols-4 gap-4 text-xs"
        >
          <div>
            <label className="block opacity-70 mb-1">Loan Name</label>
            <input
              type="text"
              value={liabName}
              onChange={(e) => setLiabName(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Loan Type</label>
            <select
              value={liabType}
              onChange={(e) => setLiabType(e.target.value as LiabilityType)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="MORTGAGE">Mortgage</option>
              <option value="CAR_LOAN">Car Loan</option>
              <option value="PERSONAL_LOAN">Personal Loan</option>
              <option value="CREDIT_CARD">Credit Card</option>
            </select>
          </div>
          <div>
            <label className="block opacity-70 mb-1">Original Total Loan</label>
            <input
              type="number"
              value={liabTotal}
              onChange={(e) => setLiabTotal(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Remaining Balance</label>
            <input
              type="number"
              value={liabRem}
              onChange={(e) => setLiabRem(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Interest Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={liabRate}
              onChange={(e) => setLiabRate(e.target.value)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
              required
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Currency</label>
            <select
              value={liabCurr}
              onChange={(e) => setLiabCurr(e.target.value as CurrencyCode)}
              className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="SEK">SEK</option>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow flex items-center justify-center gap-1.5 transition"
            >
              <PlusCircle className="w-4 h-4" /> Save Liability / Loan
            </button>
          </div>
        </form>

        {liabilities.length > 0 && (
          <div className="pt-4 border-t border-slate-800/40 space-y-2">
            <h4 className="font-bold text-xs opacity-70">Saved Liabilities</h4>
            <div className="space-y-2">
              {liabilities.map((l) => (
                <div key={l.id} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <span className="font-bold">{l.name}</span>
                    <span className="opacity-60 text-[10px] ml-2">({l.liability_type} • {l.interest_rate}% interest)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-rose-400">{l.remaining_balance.toLocaleString()} {l.currency}</span>
                    <button onClick={() => onDeleteLiability(l.id)} className="text-rose-400 hover:text-rose-300 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Active Holdings List & Individual Deletion */}
      <div className={`border p-6 rounded-3xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex justify-between items-center border-b pb-4 border-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Active Vault Holdings ({holdings.length})</h3>
              <p className="text-[11px] opacity-60">Manage or delete individual holdings stored in SQLite.</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              <tr>
                <th className="p-3">Broker</th>
                <th className="p-3">Asset Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Quantity / Principal</th>
                <th className="p-3">Currency</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center opacity-60">
                    No holdings recorded. Import a CSV or add an asset above.
                  </td>
                </tr>
              ) : (
                holdings.map((h) => {
                  const isFD = h.category === 'FIXED_DEPOSIT';
                  return (
                    <tr key={h.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="p-3 font-semibold">{h.broker}</td>
                      <td className="p-3">
                        <span className="font-bold block">{h.name}</span>
                        <span className="opacity-50 text-[10px] font-mono">{h.symbol}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isFD ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                          {h.category}
                        </span>
                      </td>
                      <td className="p-3 opacity-90">{isFD ? h.principal.toLocaleString() : h.quantity.toLocaleString()}</td>
                      <td className="p-3 font-mono">{h.currency}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onDeleteHolding(h.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete holding"
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
    </div>
  );
};