import React from 'react';
import {
  TrendingUp,
  PieChart,
  ShieldCheck,
  PlusCircle,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Globe2,
  Calendar,
  Layers,
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

  // Calculate true current market value for holdings (falls back to buy price if market price is 0)
  const holdingsWithValues = holdings.map((h) => {
    const isFD = h.category === 'FIXED_DEPOSIT';
    const nativeVal = isFD
      ? calculateFDCurrentValue(h)
      : h.quantity * (h.market_price > 0 ? h.market_price : h.avg_price);
    const costVal = isFD ? h.principal : h.quantity * h.avg_price;
    const baseVal = convertToBase(nativeVal, h.currency);
    const baseCost = convertToBase(costVal, h.currency);
    const gain = baseVal - baseCost;
    return { ...h, nativeVal, baseVal, gain, gainPct: baseCost > 0 ? (gain / baseCost) * 100 : 0 };
  });

  const totalFinancialAssets = holdingsWithValues.reduce((sum, h) => sum + h.baseVal, 0);
  const totalRealEstate = properties.reduce((sum, p) => sum + convertToBase(p.current_price, p.currency), 0);
  const totalAssets = totalFinancialAssets + totalRealEstate;
  const totalLiabilities = liabilities.reduce((sum, l) => sum + convertToBase(l.remaining_balance, l.currency), 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Asset Class Allocation
  const assetBreakdown: Record<string, number> = {
    'Equities & ETFs': holdingsWithValues.filter(h => h.category !== 'FIXED_DEPOSIT').reduce((s, h) => s + h.baseVal, 0),
    'Fixed Deposits & Savings': holdingsWithValues.filter(h => h.category === 'FIXED_DEPOSIT').reduce((s, h) => s + h.baseVal, 0),
    'Real Estate': totalRealEstate,
  };

  // Stock / Fund Wise Breakdown (Sorted by largest current value)
  const sortedHoldings = [...holdingsWithValues].sort((a, b) => b.baseVal - a.baseVal);

  // Currency Exposure
  const currencyBreakdown: Record<string, number> = {};
  holdingsWithValues.forEach(h => {
    currencyBreakdown[h.currency] = (currencyBreakdown[h.currency] || 0) + h.baseVal;
  });
  properties.forEach(p => {
    currencyBreakdown[p.currency] = (currencyBreakdown[p.currency] || 0) + convertToBase(p.current_price, p.currency);
  });

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
          <span className="text-[10px] opacity-60">Equities, FDs & Properties (Current Value)</span>
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

      {/* Analytics Row: Trajectory Graph + Asset Allocation */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Net Worth & Asset Trajectory Graph */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-base">Net Worth & Asset Trajectory Over Time</h2>
            </div>
            <button onClick={onGoToManage} className="text-xs text-indigo-400 hover:underline font-semibold flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" /> Update Data
            </button>
          </div>

          <div className="space-y-3">
            <div className="h-48 flex items-end gap-3 pt-6 px-2 border-b border-slate-800 relative">
              {snapshots.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-60 text-xs space-y-1">
                  <p>Historical snapshots record automatically as you open or update your portfolio.</p>
                  <span className="text-[11px] text-indigo-400 font-bold">Current Net Worth: {Math.round(netWorth).toLocaleString()} {baseCurrency}</span>
                </div>
              ) : (
                snapshots.map((s, idx) => {
                  const maxVal = Math.max(...snapshots.map((x) => x.assets), 1);
                  const assetH = Math.max(12, (s.assets / maxVal) * 100);
                  const netH = Math.max(10, (s.netWorth / maxVal) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                      <div className="w-full flex items-end gap-1 h-full">
                        <div style={{ height: `${assetH}%` }} className="w-1/2 bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all" title={`Total Assets: ${Math.round(s.assets)}`} />
                        <div style={{ height: `${netH}%` }} className="w-1/2 bg-indigo-500 hover:bg-indigo-400 rounded-t transition-all" title={`Net Worth: ${Math.round(s.netWorth)}`} />
                      </div>
                      <span className="text-[9px] opacity-70 truncate pt-1">{s.date.slice(5)}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-between items-center text-xs opacity-80 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Total Assets</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Net Worth</span>
              </div>
              <span className="text-[10px] opacity-60">Updated Daily</span>
            </div>
          </div>
        </div>

        {/* Asset Class Allocation */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">Gross Asset Allocation</h2>
          </div>

          <div className="space-y-3 pt-2">
            {totalAssets === 0 ? (
              <p className="text-xs opacity-60 text-center py-12">No assets recorded yet.</p>
            ) : (
              Object.entries(assetBreakdown).map(([category, val]) => {
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

      {/* Stock / Fund-Wise Concentration Breakdown */}
      <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base">Stock & Fund Concentration (Top Holdings)</h2>
          </div>
          <span className="text-xs opacity-60">{sortedHoldings.length} Total Holdings</span>
        </div>

        <div className="space-y-3 pt-1">
          {sortedHoldings.length === 0 ? (
            <p className="text-xs opacity-60 text-center py-6">No stock or fund holdings imported yet.</p>
          ) : (
            sortedHoldings.slice(0, 8).map((h) => {
              const pct = totalAssets > 0 ? (h.baseVal / totalAssets) * 100 : 0;
              return (
                <div key={h.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="flex items-center gap-2">
                      <b className="text-white">{h.name}</b>
                      <span className="opacity-60 text-[10px]">({h.symbol} • {h.broker})</span>
                    </span>
                    <span>
                      {Math.round(h.baseVal).toLocaleString()} {baseCurrency} <b className="text-indigo-400">({pct.toFixed(1)}%)</b>
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                    <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-indigo-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Additional Analytics Row: Currency Exposure & Upcoming FD Maturities */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Currency Exposure Analytics */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-sky-400" />
            <h2 className="font-bold text-base">Multi-Currency Exposure</h2>
          </div>
          <div className="space-y-3 pt-1">
            {Object.keys(currencyBreakdown).length === 0 ? (
              <p className="text-xs opacity-60 text-center py-6">No currency data available.</p>
            ) : (
              Object.entries(currencyBreakdown).map(([curr, val]) => {
                const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                return (
                  <div key={curr} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{curr} Denominated Assets</span>
                      <span>{Math.round(val).toLocaleString()} {baseCurrency} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-sky-500" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Fixed Deposit / Savings Maturity Timeline */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">Fixed Deposit Maturities</h2>
          </div>
          <div className="space-y-2 text-xs">
            {holdingsWithValues.filter(h => h.category === 'FIXED_DEPOSIT').length === 0 ? (
              <p className="text-xs opacity-60 text-center py-6">No Fixed Deposits recorded.</p>
            ) : (
              holdingsWithValues.filter(h => h.category === 'FIXED_DEPOSIT').map(fd => (
                <div key={fd.id} className={`p-3 rounded-xl border flex justify-between items-center ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <span className="font-bold text-white">{fd.name}</span>
                    <p className="text-[10px] opacity-60">{fd.broker} • {fd.interest_rate}% interest</p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-emerald-400">{fd.maturity_date || 'No maturity date'}</span>
                    <p className="text-[10px] opacity-60">{Math.round(fd.baseVal).toLocaleString()} {baseCurrency}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Holdings Table with Live Market Values and Unrealized Gains */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-sm">Consolidated Portfolio Holdings (Live Valuation)</h3>
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
              <th className="p-4">Current Market Value</th>
              <th className="p-4 text-right">Unrealized Gain / Loss</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800/70' : 'divide-slate-200'}`}>
            {holdingsWithValues.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center opacity-60">
                  No holdings found. Click <b>Manage & Import Assets</b> above.
                </td>
              </tr>
            ) : (
              holdingsWithValues.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
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
                    <td className="p-4 opacity-90">{isFD ? `${h.interest_rate}%` : `${h.market_price > 0 ? h.market_price : h.avg_price} ${h.currency}`}</td>
                    <td className="p-4 font-bold text-white">{Math.round(h.baseVal).toLocaleString()} {baseCurrency}</td>
                    <td className={`p-4 text-right font-semibold ${h.gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {h.gain >= 0 ? '+' : ''}{Math.round(h.gain).toLocaleString()} ({h.gainPct.toFixed(1)}%)
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Properties Table */}
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
              <th className="p-4">Acquisition</th>
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

      {/* Liabilities Table */}
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