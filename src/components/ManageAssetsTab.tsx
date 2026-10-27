import React, { useState, useRef } from 'react';
import type { Database } from 'sql.js';
import { HoldingRow, CurrencyCode, BrokerType, CsvImportResult } from '../types';
import {
  FileSpreadsheet,
  Trash2,
  Plus,
  Landmark,
  Building,
  CreditCard,
  Upload,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Edit2,
  ClipboardPaste,
  X,
  CheckCircle2,
} from 'lucide-react';
import { getProperties, getLiabilities } from '../db/database';
import { BrokerGuide } from './BrokerGuide';
import { parsePastedFdRows, ParsedFdItem } from '../parsers/fdImporter';
import { calculateFdValuation } from '../utils/finance';

interface ManageAssetsTabProps {
  db: Database;
  holdings: HoldingRow[];
  theme: 'dark' | 'light';
  onBackToOverview: () => void;
  onCsvImport: (file: File, broker: string) => Promise<CsvImportResult | void> | void;
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
  onAddBulkFDs?: (items: ParsedFdItem[]) => Promise<void> | void;
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
  onUpdatePropertyValuation?: (id: number, currentPrice: number) => void;
  onUpdateLiabilityBalance?: (id: number, remainingBalance: number) => void;
  onUpdateHoldingValuation?: (id: number, marketPrice: number) => void;
  onDeleteHolding: (id: number) => void;
  onDeleteProperty: (id: number) => void;
  onDeleteLiability: (id: number) => void;
}

const BROKER_OPTIONS: { value: BrokerType; label: string }[] = [
  { value: 'Avanza', label: 'Avanza (Sweden)' },
  { value: 'Nordnet', label: 'Nordnet (Nordics)' },
  { value: 'Zerodha', label: 'Zerodha (India)' },
  { value: 'Kuvera', label: 'Kuvera (India - MFs)' },
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
  onAddBulkFDs,
  onAddProperty,
  onAddLiability,
  onUpdatePropertyValuation,
  onUpdateLiabilityBalance,
  onUpdateHoldingValuation,
  onDeleteHolding,
  onDeleteProperty,
  onDeleteLiability,
}) => {
  const isDark = theme === 'dark';
  const properties = getProperties(db);
  const liabilities = getLiabilities(db);

  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('Avanza');
  const [activeFormTab, setActiveFormTab] = useState<'EQUITY' | 'FD' | 'PROPERTY' | 'LIABILITY' | 'PENSION'>('EQUITY');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [csvSummary, setCsvSummary] = useState<CsvImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Paste Modal State for FDs
  const [showFdPasteModal, setShowFdPasteModal] = useState<boolean>(false);
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [previewFdItems, setPreviewFdItems] = useState<ParsedFdItem[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState<boolean>(false);

  // Fixed Deposit Form
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

  const pensionHoldings = holdings.filter((h) => h.category === 'PENSION');

  // Pension Form state
  const [pensionForm, setPensionForm] = useState({
    name: '',
    broker: 'Pensionsmyndigheten',
    currency: 'SEK' as CurrencyCode,
    valuation: 0,
  });

  const equityHoldings = holdings.filter((h) => h.category === 'EQUITY' || h.category === 'MUTUAL_FUND');
  const fdHoldings = holdings.filter((h) => h.category === 'FIXED_DEPOSIT');

  const formatCompoundingLabel = (freq: number) => {
    if (freq === 12) return 'Monthly';
    if (freq === 4) return 'Quarterly';
    if (freq === 2) return 'Semi-Annual';
    return 'Annual';
  };

  const handleProcessPastedText = (text: string) => {
    setPastedRawText(text);
    const items = parsePastedFdRows(text);
    setPreviewFdItems(items);
  };

  const handleSaveBulkFds = async () => {
    if (previewFdItems.length === 0 || !onAddBulkFDs) return;
    try {
      setIsSavingBulk(true);
      await onAddBulkFDs(previewFdItems);
      setShowFdPasteModal(false);
      setPastedRawText('');
      setPreviewFdItems([]);
    } catch (err: any) {
      alert(`Bulk save failed: ${err?.message || err}`);
    } finally {
      setIsSavingBulk(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToOverview}
          className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Overview
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
          <button
            onClick={() => setActiveFormTab('PENSION')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeFormTab === 'PENSION' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            Pensions (NPS / SE)
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
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold">Broker Ledger Import</h3>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Select your broker below to view export instructions and upload your report.
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

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md transition disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Parsing File...' : 'Upload File'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      setIsUploading(true);
                      setCsvSummary(null);
                      setUploadStatus(`Reading and parsing ${file.name}...`);

                      const summary = await onCsvImport(file, selectedBroker);
                      if (summary) {
                        setCsvSummary(summary);
                        setUploadStatus('Import completed successfully!');
                      }
                    } catch (err: any) {
                      setUploadStatus(`Error: ${err?.message || err}`);
                      alert(`Import failed: ${err?.message || err}`);
                    } finally {
                      setIsUploading(false);
                      e.target.value = '';
                    }
                  }
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  if (confirm(`Wipe all imported transactions and holdings for ${selectedBroker}?`)) {
                    onClearBroker(selectedBroker);
                    setCsvSummary(null);
                  }
                }}
                className="p-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition"
                title={`Clear ${selectedBroker} Ledger`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Broker Export Guide */}
          <BrokerGuide broker={selectedBroker} isDark={isDark} />

          {/* Interactive Loading / Summary Box */}
          {(isUploading || csvSummary || uploadStatus) && (
            <div
              className={`mb-6 p-4 rounded-2xl border text-xs transition-all ${
                isUploading
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 animate-pulse'
                  : csvSummary
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatus || 'Processing broker report...'}</span>
                    </>
                  ) : csvSummary ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>
                        Import Summary ({csvSummary.broker} - {csvSummary.importType})
                      </span>
                    </>
                  ) : (
                    <span>{uploadStatus}</span>
                  )}
                </div>
                {csvSummary && (
                  <button
                    onClick={() => setCsvSummary(null)}
                    className="opacity-70 hover:opacity-100 text-[10px] underline"
                  >
                    Dismiss
                  </button>
                )}
              </div>

              {csvSummary && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-emerald-500/20 font-mono text-xs">
                  <div>
                    <span className="opacity-70 block text-[10px]">New Transactions:</span>
                    <span className="font-bold text-emerald-400">+{csvSummary.newTransactionsAdded}</span>
                  </div>
                  <div>
                    <span className="opacity-70 block text-[10px]">Holdings Updated:</span>
                    <span className="font-bold">{csvSummary.holdingsUpdated}</span>
                  </div>
                  <div>
                    <span className="opacity-70 block text-[10px]">Duplicates Skipped:</span>
                    <span className="font-bold opacity-80">{csvSummary.duplicatesSkipped || 0}</span>
                  </div>
                  <div>
                    <span className="opacity-70 block text-[10px]">Mode:</span>
                    <span className="font-bold">{csvSummary.importType}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tradebook vs Holdings Snapshot Guide */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-indigo-50/50 border-indigo-100'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-indigo-400 mb-1">
                <FileText className="w-4 h-4" /> Tradebook (Full History)
              </div>
              <p className="opacity-80 leading-relaxed">
                Contains complete buy/sell execution history. Enables exact realized P&amp;L tracking, historical XIRR, and multi-year analytics.
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-amber-50/50 border-amber-100'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                <ShieldCheck className="w-4 h-4" /> Holdings Snapshot (Current Position)
              </div>
              <p className="opacity-80 leading-relaxed">
                Used when historical trade logs aren't available. Netto displays current open holdings and synthesizes baseline opening transactions.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/40 opacity-70">
                  <th className="pb-3">Broker</th>
                  <th className="pb-3">Asset / Name</th>
                  <th className="pb-3">Data Source</th>
                  <th className="pb-3 text-right">Quantity</th>
                  <th className="pb-3 text-right">Avg Purchase Price</th>
                  <th className="pb-3 text-right">Current Market Price</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/20">
                {equityHoldings.map((h) => {
                  const isSnapshot = h.broker === 'Zerodha' || String(h.symbol).includes('HOLDINGS');
                  return (
                    <tr key={h.id} className="hover:bg-slate-800/10 transition">
                      <td className="py-3 font-bold">{h.broker}</td>
                      <td className="py-3">
                        <div className="font-semibold">{h.name || h.symbol}</div>
                        <div className="text-[10px] opacity-60 font-mono">{h.symbol}</div>
                      </td>
                      <td className="py-3">
                        {isSnapshot ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Holdings Snapshot
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Tradebook (History)
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium">{h.quantity}</td>
                      <td className="py-3 text-right font-mono">
                        {(h.avg_price || 0).toFixed(2)} {h.currency || 'SEK'}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {h.market_price && h.market_price > 0 ? `${h.market_price.toFixed(2)} ${h.currency || 'SEK'}` : '-'}
                      </td>
                      <td className="py-3 text-right flex items-center justify-end gap-1">
                        {onUpdateHoldingValuation && (
                          <button
                            onClick={() => {
                              const val = prompt(
                                `Update market price for ${h.name || h.symbol}:`,
                                String(h.market_price || h.avg_price)
                              );
                              if (val !== null) {
                                const parsed = parseFloat(val);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  onUpdateHoldingValuation(h.id, parsed);
                                }
                              }
                            }}
                            className="text-indigo-400 hover:text-indigo-300 p-1"
                            title="Update Market Price"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteHolding(h.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition"
                          title="Delete Asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-400" /> Fixed Deposits &amp; Term Accounts
            </h3>
            <button
              onClick={() => setShowFdPasteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Quick Paste from Excel / Web
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className={`p-6 rounded-3xl border shadow-sm ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-4">Add Single Deposit</h4>
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
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Save Deposit
                </button>
              </form>
            </div>

            <div
              className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-4">Active Fixed Deposits</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/40 opacity-70">
                      <th className="pb-2">Institution</th>
                      <th className="pb-2">Deposit Name</th>
                      <th className="pb-2 text-right">Principal</th>
                      <th className="pb-2 text-right">Live Accrued Value</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Maturity</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/20">
                    {fdHoldings.map((fd) => {
                      const val = calculateFdValuation(
                        fd.principal || 0,
                        fd.interest_rate || 0,
                        fd.compounding_freq || 4,
                        fd.start_date || new Date().toISOString().slice(0, 10),
                        fd.maturity_date
                      );

                      return (
                        <tr key={fd.id} className="hover:bg-slate-800/10 transition">
                          <td className="py-3 font-semibold">{fd.broker}</td>
                          <td className="py-3">
                            <div className="font-semibold">{fd.name}</div>
                            <div className="text-[10px] opacity-60">
                              {val.isMatured ? (
                                <span className="text-emerald-400 font-semibold">Matured</span>
                              ) : (
                                `${val.daysRemaining} days left`
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right font-mono font-medium">
                            {fd.principal.toLocaleString()} {fd.currency}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-emerald-400">
                            <div>{val.currentValue.toLocaleString()} {fd.currency}</div>
                            <div className="text-[10px] font-normal text-emerald-500/80">
                              (+{val.accruedInterest.toLocaleString()} {fd.currency})
                            </div>
                          </td>
                          <td className="py-3 text-right font-mono opacity-80">
                            {fd.interest_rate}% ({formatCompoundingLabel(fd.compounding_freq)})
                          </td>
                          <td className="py-3 text-right font-mono opacity-80">{fd.maturity_date || '-'}</td>
                          <td className="py-3 text-right flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                const valPrompt = prompt(
                                  `Update principal balance for ${fd.name}:`,
                                  String(fd.principal)
                                );
                                if (valPrompt !== null) {
                                  const parsed = parseFloat(valPrompt);
                                  if (!isNaN(parsed) && parsed > 0 && onUpdateHoldingValuation) {
                                    onUpdateHoldingValuation(fd.id, parsed);
                                  }
                                }
                              }}
                              className="text-indigo-400 hover:text-indigo-300 p-1 cursor-pointer"
                              title="Update Principal"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteHolding(fd.id)}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              title="Delete Deposit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {fdHoldings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 opacity-60">
                          No fixed deposits recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Paste Modal */}
      {showFdPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-4xl rounded-3xl p-6 sm:p-8 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/20 pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                  <ClipboardPaste className="w-4 h-4" /> Quick Paste Fixed Deposits
                </h3>
                <p className="text-[11px] opacity-70 mt-0.5">
                  Copy rows directly from Excel, Google Sheets, or your online banking table and paste them below.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowFdPasteModal(false);
                  setPastedRawText('');
                  setPreviewFdItems([]);
                }}
                className="opacity-70 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] opacity-70 mb-1">
                <span>
                  <strong>Supported column order:</strong> Bank | Deposit Name | Principal | Rate % | Currency | Start Date | Maturity Date
                </span>
                <span className="font-mono text-emerald-400 font-bold">{previewFdItems.length} recognized</span>
              </div>
              <textarea
                rows={5}
                value={pastedRawText}
                onChange={(e) => handleProcessPastedText(e.target.value)}
                placeholder={'SBAB\tFasträntekonto 1Y\t100000\t3.75\tSEK\t2026-01-15\t2027-01-15\nHDFC\tTax Saver FD\t50000\t7.10\tINR\t2025-05-10\t2030-05-10'}
                className={`w-full p-3 rounded-2xl border font-mono text-xs outline-none ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            {/* Preview Table with Start Date */}
            {previewFdItems.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  Data Preview ({previewFdItems.length} deposits detected)
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-800/20 max-h-52">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/20">
                      <tr className="opacity-70 border-b border-slate-800/30">
                        <th className="p-2">Bank</th>
                        <th className="p-2">Deposit Name</th>
                        <th className="p-2 text-right">Principal</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2">Currency</th>
                        <th className="p-2">Start Date</th>
                        <th className="p-2">Maturity Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/20 font-mono">
                      {previewFdItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/10">
                          <td className="p-2 font-semibold">{item.broker}</td>
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-right font-medium">
                            {item.principal.toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-emerald-400">{item.interestRate}%</td>
                          <td className="p-2">{item.currency}</td>
                          <td className="p-2 text-indigo-400">{item.startDate}</td>
                          <td className="p-2 opacity-80">{item.maturityDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/20">
              <button
                onClick={() => {
                  setShowFdPasteModal(false);
                  setPastedRawText('');
                  setPreviewFdItems([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={previewFdItems.length === 0 || isSavingBulk}
                onClick={handleSaveBulkFds}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSavingBulk ? 'Saving & Encrypting...' : `Save ${previewFdItems.length} Deposits`}
              </button>
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
              <Building className="w-4 h-4 text-sky-400" />
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
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Property
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
                    <th className="pb-2 text-right">Actions</th>
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
                        <div className="flex items-center justify-end gap-2">
                          {onUpdatePropertyValuation && (
                            <button
                              onClick={() => {
                                const val = prompt(
                                  `Update current market valuation for ${p.name}:`,
                                  String(p.current_price)
                                );
                                if (val !== null) {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed) && parsed > 0) {
                                    onUpdatePropertyValuation(p.id, parsed);
                                  }
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Update Valuation"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteProperty(p.id)}
                            className="p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                            title="Delete Property"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              <CreditCard className="w-4 h-4 text-rose-400" />
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
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Liability
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
                      <td className="py-3 text-right flex items-center justify-end gap-2">
                        {onUpdateLiabilityBalance && (
                          <button
                            onClick={() => {
                              const val = prompt(
                                `Update remaining balance for ${l.name}:`,
                                String(l.remaining_balance)
                              );
                              if (val !== null) {
                                const parsed = parseFloat(val);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  onUpdateLiabilityBalance(l.id, parsed);
                                }
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-medium transition flex items-center gap-1 cursor-pointer"
                            title="Update Remaining Balance"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteLiability(l.id)}
                          className="p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                          title="Delete Liability"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
      {/* 5. Pension & Retirement Form & Table */}
      {activeFormTab === 'PENSION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold">Add Pension / Retirement Account</h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddPension(pensionForm);
                setPensionForm({ ...pensionForm, name: '', valuation: 0 });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block mb-1 opacity-70">Account / Plan Name</label>
                <input
                  type="text"
                  required
                  value={pensionForm.name}
                  onChange={(e) => setPensionForm({ ...pensionForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. Inkomstpension, NPS Tier-1, ITP1"
                />
              </div>

              <div>
                <label className="block mb-1 opacity-70">Provider / Manager</label>
                <input
                  type="text"
                  required
                  value={pensionForm.broker}
                  onChange={(e) => setPensionForm({ ...pensionForm, broker: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  placeholder="e.g. Pensionsmyndigheten, NSDL/Protean, Alecta"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-70">Currency</label>
                  <select
                    value={pensionForm.currency}
                    onChange={(e) => setPensionForm({ ...pensionForm, currency: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  >
                    <option value="SEK">SEK (Sweden)</option>
                    <option value="INR">INR (India - NPS)</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 opacity-70">Current Value</label>
                  <input
                    type="number"
                    required
                    value={pensionForm.valuation || ''}
                    onChange={(e) =>
                      setPensionForm({ ...pensionForm, valuation: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border bg-transparent"
                    placeholder="150000"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Pension
              </button>
            </form>
          </div>

          <div
            className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-sm font-bold mb-4">Retirement Accounts &amp; Pensions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40 opacity-70">
                    <th className="pb-2">Provider</th>
                    <th className="pb-2">Plan Name</th>
                    <th className="pb-2 text-right">Current Valuation</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {pensionHoldings.map((p) => {
                    const displayVal = p.market_price > 0 ? p.market_price : p.principal || 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/10 transition">
                        <td className="py-3 font-semibold">{p.broker}</td>
                        <td className="py-3">{p.name}</td>
                        <td className="py-3 text-right font-mono font-bold text-purple-400">
                          {displayVal.toLocaleString()} {p.currency}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {onUpdateHoldingValuation && (
                              <button
                                onClick={() => {
                                  const val = prompt(
                                    `Update valuation for ${p.name}:`,
                                    String(displayVal)
                                  );
                                  if (val !== null) {
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed) && parsed >= 0) {
                                      onUpdateHoldingValuation(p.id, parsed);
                                    }
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-medium transition flex items-center gap-1 cursor-pointer"
                                title="Update Valuation"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteHolding(p.id)}
                              className="p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                              title="Delete Pension"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pensionHoldings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 opacity-60">
                        No pension or retirement accounts recorded.
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