import React from 'react';
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  ServerOff,
  FileSpreadsheet,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { calculateFDCurrentValue, getSnapshots } from '../db/database';
import { CurrencyCode, HoldingRow } from '../types';
import type { Database } from 'sql.js';

interface OverviewTabProps {
  db: Database;
  holdings: HoldingRow[];
  baseCurrency: CurrencyCode;
  fxRates: Record<string, number>;
  theme: 'dark' | 'light';
  onGoToManage: () => void;
  onOpenPrivacyModal: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  db,
  holdings,
  baseCurrency,
  fxRates,
  theme,
  onGoToManage,
  onOpenPrivacyModal,
}) => {
  const isDark = theme === 'dark';
  const snapshots = getSnapshots(db);

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const totalNetWorth = holdings.reduce((sum, h) => {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    return sum + convertToBase(nativeVal, h.currency);
  }, 0);

  // Calculate asset class breakdown
  const breakdown: Record<string, number> = {};
  for (const h of holdings) {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    const valBase = convertToBase(nativeVal, h.currency);
    const key = h.category === 'FIXED_DEPOSIT' ? 'Fixed Deposits / Savings' : 'Equities & ETFs';
    breakdown[key] = (breakdown[key] || 0) + valBase;
  }

  return (
    <div className="space-y-6">
      {/* Net Worth Hero & Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 border p-6 rounded-2xl flex flex-col justify-between shadow-sm ${isDark ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border-indigo-500/30' : 'bg-gradient-to-r from-indigo-50 via-white to-white border-indigo-200'}`}>
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-500 font-semibold">Total Netto Worth</span>
            <div className={`text-4xl font-extrabold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400">{baseCurrency}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-indigo-500/20">
            <p className="text-xs opacity-70">
              Real-time multi-currency consolidation across global brokerages and bank savings.
            </p>
            <button
              onClick={onGoToManage}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow transition"
            >
              <PlusCircle className="w-4 h-4" /> Manage / Add Assets
            </button>
          </div>
        </div>

        <div className={`border p-5 rounded-2xl space-y-3 text-xs shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 font-semibold text-emerald-500">
            <ShieldCheck className="w-4 h-4" /> Zero-Knowledge Privacy
          </div>
          <p className="opacity-75 leading-relaxed">
            All calculations run locally in browser WebAssembly. Your portfolio rows never touch our servers.
          </p>
          <button onClick={onOpenPrivacyModal} className="text-indigo-500 hover:underline font-medium inline-block">
            Inspect security details →
          </button>
        </div>
      </div>

      {/* Analytics & Growth Over Time Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Growth Over Time Chart (SVG Trend) */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-base">Net Worth Growth Trajectory</h2>
            </div>
            <span className="text-[11px] opacity-60">Historical Snapshots</span>
          </div>

          {snapshots.length < 2 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center opacity-60 text-xs space-y-1">
              <p>Growth analytics populate automatically as you update prices or import files over multiple days.</p>
              <span className="text-[10px] text-indigo-400">Current recorded snapshot: {Math.round(totalNetWorth).toLocaleString()} {baseCurrency}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-40 flex items-end gap-2 pt-4 px-2 border-b border-slate-800">
                {snapshots.map((s, idx) => {
                  const maxVal = Math.max(...snapshots.map((x) => x.value), 1);
                  const heightPct = Math.max(15, (s.value / maxVal) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-t transition-all"
                      />
                      <span className="text-[9px] opacity-60 truncate">{s.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-xs opacity-75">
                <span>Start: {snapshots[0]?.date}</span>
                <span className="font-bold text-indigo-400">Latest: {Math.round(totalNetWorth).toLocaleString()} {baseCurrency}</span>
              </div>
            </div>
          )}
        </div>

        {/* Asset Allocation Breakdown */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">Asset Class Allocation</h2>
          </div>

          <div className="space-y-3 pt-2">
            {Object.keys(breakdown).length === 0 ? (
              <p className="text-xs opacity-60 text-center py-12">No asset allocation data yet.</p>
            ) : (
              Object.entries(breakdown).map(([category, val]) => {
                const pct = totalNetWorth > 0 ? (val / totalNetWorth) * 100 : 0;
                return (
                  <div key={category} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{category}</span>
                      <span>
                        {Math.round(val).toLocaleString()} {baseCurrency} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${category.includes('Fixed') ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Consolidated Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-sm">Consolidated Portfolio Holdings</h3>
          <button onClick={onGoToManage} className="text-xs text-indigo-400 hover:underline font-semibold">
            + Add or Edit Holdings
          </button>
        </div>
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
                <td colSpan={7} className="p-10 text-center opacity-60">
                  No holdings found. Click <b>Manage / Add Assets</b> to import your broker CSV or add savings.
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
                      <span className="font-medium">{h.name}</span> <span className="opacity-60">({h.symbol})</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isFD ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 opacity-90">{isFD ? `${h.principal.toLocaleString()} ${h.currency}` : h.quantity}</td>
                    <td className="p-4 opacity-90">{isFD ? `${h.interest_rate}%` : `${h.market_price} ${h.currency}`}</td>
                    <td className="p-4 font-medium">{Math.round(nativeVal).toLocaleString()} {h.currency}</td>
                    <td className="p-4 font-bold text-indigo-400">{Math.round(baseVal).toLocaleString()} {baseCurrency}</td>
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