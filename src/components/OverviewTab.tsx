import React from 'react';
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  ServerOff,
  PlusCircle,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { calculateFDCurrentValue, getSnapshots, getProperties, getLiabilities } from '../db/database';
import { CurrencyCode, HoldingRow, PropertyRow, LiabilityRow } from '../types';
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
  const properties: PropertyRow[] = getProperties(db);
  const liabilities: LiabilityRow[] = getLiabilities(db);

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  // 1. Total Financial Assets (Equities + FDs)
  const totalFinancialAssets = holdings.reduce((sum, h) => {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    return sum + convertToBase(nativeVal, h.currency);
  }, 0);

  // 2. Total Real Estate / Properties
  const totalRealEstate = properties.reduce((sum, p) => {
    return sum + convertToBase(p.current_price, p.currency);
  }, 0);

  const totalAssets = totalFinancialAssets + totalRealEstate;

  // 3. Total Liabilities
  const totalLiabilities = liabilities.reduce((sum, l) => {
    return sum + convertToBase(l.remaining_balance, l.currency);
  }, 0);

  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Asset Allocation Breakdown
  const breakdown: Record<string, number> = {
    'Equities & ETFs': holdings.filter(h => h.category !== 'FIXED_DEPOSIT').reduce((s, h) => s + convertToBase(h.quantity * h.market_price, h.currency), 0),
    'Fixed Deposits & Savings': holdings.filter(h => h.category === 'FIXED_DEPOSIT').reduce((s, h) => s + convertToBase(calculateFDCurrentValue(h), h.currency), 0),
    'Real Estate & Land': totalRealEstate,
  };

  return (
    <div className="space-y-6">
      {/* Financial Health Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Net Worth</span>
          <div className="text-2xl font-extrabold mt-1 text-indigo-400">
            {Math.round(netWorth).toLocaleString()} {baseCurrency}
          </div>
          <span className="text-[10px] opacity-60">Total Assets minus Liabilities</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Total Gross Assets</span>
          <div className="text-2xl font-extrabold mt-1 text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-5 h-5" /> {Math.round(totalAssets).toLocaleString()} {baseCurrency}
          </div>
          <span className="text-[10px] opacity-60">Equities, FDs & Properties</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Total Liabilities</span>
          <div className="text-2xl font-extrabold mt-1 text-rose-400 flex items-center gap-1">
            <ArrowDownRight className="w-5 h-5" /> {Math.round(totalLiabilities).toLocaleString()} {baseCurrency}
          </div>
          <span className="text-[10px] opacity-60">Mortgages & Loans</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Debt-to-Asset Ratio</span>
          <div className={`text-2xl font-extrabold mt-1 ${debtToAssetRatio > 50 ? 'text-rose-400' : 'text-indigo-400'}`}>
            {debtToAssetRatio.toFixed(1)}%
          </div>
          <span className="text-[10px] opacity-60">{debtToAssetRatio < 40 ? 'Healthy Leverage' : 'High Leverage'}</span>
        </div>
      </div>

      {/* Analytics & Growth Over Time Section (Assets vs Liabilities Trajectory) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-base">Assets vs. Liabilities Trajectory</h2>
            </div>
            <button onClick={onGoToManage} className="text-xs text-indigo-400 hover:underline font-semibold flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" /> Add Asset/Liability
            </button>
          </div>

          {snapshots.length < 2 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center opacity-60 text-xs space-y-1">
              <p>Historical trends populate automatically as you record snapshots over time.</p>
              <span className="text-[10px] text-indigo-400">Current Net Worth: {Math.round(netWorth).toLocaleString()} {baseCurrency}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-40 flex items-end gap-2 pt-4 px-2 border-b border-slate-800">
                {snapshots.map((s, idx) => {
                  const maxVal = Math.max(...snapshots.map((x) => x.assets), 1);
                  const assetH = Math.max(10, (s.assets / maxVal) * 100);
                  const liabH = Math.max(5, (s.liabilities / maxVal) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full flex items-end gap-0.5 h-full">
                        <div style={{ height: `${assetH}%` }} className="w-1/2 bg-emerald-500 rounded-t" title={`Assets: ${Math.round(s.assets)}`} />
                        <div style={{ height: `${liabH}%` }} className="w-1/2 bg-rose-500 rounded-t" title={`Liabilities: ${Math.round(s.liabilities)}`} />
                      </div>
                      <span className="text-[9px] opacity-60 truncate">{s.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-xs opacity-75">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Assets</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Liabilities</span>
              </div>
            </div>
          )}
        </div>

        {/* Asset Allocation Breakdown */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">Gross Asset Allocation</h2>
          </div>

          <div className="space-y-3 pt-2">
            {totalAssets === 0 ? (
              <p className="text-xs opacity-60 text-center py-12">No assets recorded yet.</p>
            ) : (
              Object.entries(breakdown).map(([category, val]) => {
                const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
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
                        className={`h-full rounded-full ${category.includes('Real') ? 'bg-amber-500' : category.includes('Fixed') ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Properties & Real Estate Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm">Real Estate & Properties</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-400 hover:underline font-semibold">+ Add Property</button>
        </div>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <tr>
              <th className="p-4">Property Name</th>
              <th className="p-4">Type</th>
              <th className="p-4">Acquisition (MM/YYYY)</th>
              <th className="p-4">Buy Price</th>
              <th className="p-4">Current Valuation</th>
              <th className="p-4 text-right">Gain / Loss</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {properties.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center opacity-60">No properties added yet.</td>
              </tr>
            ) : (
              properties.map((p) => {
                const curBase = convertToBase(p.current_price, p.currency);
                const buyBase = convertToBase(p.buy_price, p.currency);
                const gain = curBase - buyBase;
                const gainPct = buyBase > 0 ? (gain / buyBase) * 100 : 0;
                return (
                  <tr key={p.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">{p.name}</td>
                    <td className="p-4 uppercase text-[10px] font-bold">{p.property_type}</td>
                    <td className="p-4 opacity-80">{p.buy_month}/{p.buy_year}</td>
                    <td className="p-4 opacity-80">{Math.round(buyBase).toLocaleString()} {baseCurrency}</td>
                    <td className="p-4 font-bold text-emerald-400">{Math.round(curBase).toLocaleString()} {baseCurrency}</td>
                    <td className={`p-4 text-right font-semibold ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {gain >= 0 ? '+' : ''}{Math.round(gain).toLocaleString()} ({gainPct.toFixed(1)}%)
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Liabilities & Loans Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-sm">Liabilities & Outstanding Loans</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-400 hover:underline font-semibold">+ Add Liability</button>
        </div>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <tr>
              <th className="p-4">Loan Name</th>
              <th className="p-4">Type</th>
              <th className="p-4">Interest Rate</th>
              <th className="p-4">Original Loan</th>
              <th className="p-4 text-right">Remaining Balance</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {liabilities.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center opacity-60">No liabilities recorded yet.</td>
              </tr>
            ) : (
              liabilities.map((l) => {
                const remBase = convertToBase(l.remaining_balance, l.currency);
                const origBase = convertToBase(l.total_loan, l.currency);
                return (
                  <tr key={l.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">{l.name}</td>
                    <td className="p-4 uppercase text-[10px] font-bold">{l.liability_type}</td>
                    <td className="p-4 text-amber-400 font-semibold">{l.interest_rate}%</td>
                    <td className="p-4 opacity-80">{Math.round(origBase).toLocaleString()} {baseCurrency}</td>
                    <td className="p-4 text-right font-bold text-rose-400">{Math.round(remBase).toLocaleString()} {baseCurrency}</td>
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