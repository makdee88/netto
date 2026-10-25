import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart,
  PlusCircle,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Globe2,
  Calendar,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import {
  calculateFDCurrentValue,
  getProperties,
  getLiabilities,
  getHistoricalPortfolioTimeline,
  getAllTransactions,
} from '../db/database';
import { CurrencyCode, HoldingRow, PropertyRow, LiabilityRow, TransactionRow } from '../types';
import type { Database } from 'sql.js';

interface OverviewTabProps {
  db: Database;
  holdings: HoldingRow[];
  baseCurrency: CurrencyCode;
  fxRates: Record<string, number>;
  theme: 'dark' | 'light';
  isMasked: boolean;
  onGoToManage: () => void;
  onOpenPrivacyModal: () => void;
}

type TimeframeRange = '1Y' | '3Y' | '5Y' | 'ALL';
type FrequencyMode = 'MONTHLY' | 'YEARLY';

export const OverviewTab: React.FC<OverviewTabProps> = ({
  db,
  holdings,
  baseCurrency,
  fxRates,
  theme,
  isMasked,
  onGoToManage,
}) => {
  const isDark = theme === 'dark';
  const [range, setRange] = useState<TimeframeRange>('ALL');
  const [frequency, setFrequency] = useState<FrequencyMode>('MONTHLY');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);

  const properties: PropertyRow[] = getProperties(db);
  const liabilities: LiabilityRow[] = getLiabilities(db);
  const allTransactions: TransactionRow[] = getAllTransactions(db);

  const formatVal = (amount: number, currency: string = baseCurrency) => {
    if (isMasked) return '••••••';
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  };

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const holdingsWithValues = holdings.map((h) => {
    const isFD = h.category === 'FIXED_DEPOSIT';
    const effectiveMarketPrice = h.market_price > 0 ? h.market_price : h.avg_price;
    const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * effectiveMarketPrice;
    const costVal = isFD ? h.principal : h.quantity * h.avg_price;
    const baseVal = convertToBase(nativeVal, h.currency);
    const baseCost = convertToBase(costVal, h.currency);
    const gain = baseVal - baseCost;
    return {
      ...h,
      effectiveMarketPrice,
      nativeVal,
      baseVal,
      gain,
      gainPct: baseCost > 0 ? (gain / baseCost) * 100 : 0,
    };
  });

  const totalFinancialAssets = holdingsWithValues.reduce((sum, h) => sum + h.baseVal, 0);
  const totalRealEstate = properties.reduce((sum, p) => sum + convertToBase(p.current_price, p.currency), 0);
  const totalAssets = totalFinancialAssets + totalRealEstate;
  const totalLiabilities = liabilities.reduce((sum, l) => sum + convertToBase(l.remaining_balance, l.currency), 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const fullTimeline = getHistoricalPortfolioTimeline(db, holdings, properties, fxRates, baseCurrency, frequency);

  const filteredTimeline = (() => {
    if (range === 'ALL') return fullTimeline;
    const limit = range === '1Y' ? (frequency === 'YEARLY' ? 1 : 12) : range === '3Y' ? (frequency === 'YEARLY' ? 3 : 36) : (frequency === 'YEARLY' ? 5 : 60);
    return fullTimeline.slice(-limit);
  })();

  const chartWidth = 600;
  const chartHeight = 200;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 18;
  const padBottom = 26;
  const usableW = chartWidth - padLeft - padRight;
  const usableH = chartHeight - padTop - padBottom;

  const maxChartVal = Math.max(
    ...filteredTimeline.map((p) => Math.max(p.portfolioValue, p.investedCost)),
    1
  );

  const getPointCoords = (idx: number, val: number) => {
    const count = filteredTimeline.length;
    const x = count <= 1 ? padLeft + usableW / 2 : padLeft + (idx / (count - 1)) * usableW;
    const y = padTop + usableH - (val / maxChartVal) * usableH;
    return { x, y };
  };

  const valueCoords = filteredTimeline.map((pt, i) => getPointCoords(i, pt.portfolioValue));
  const costCoords = filteredTimeline.map((pt, i) => getPointCoords(i, pt.investedCost));

  const valueLinePath =
    valueCoords.length > 0
      ? valueCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      : '';

  const valueAreaPath =
    valueCoords.length > 1
      ? `${valueLinePath} L ${valueCoords[valueCoords.length - 1].x.toFixed(1)} ${(padTop + usableH).toFixed(1)} L ${valueCoords[0].x.toFixed(1)} ${(padTop + usableH).toFixed(1)} Z`
      : '';

  const costLinePath =
    costCoords.length > 0
      ? costCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      : '';

  const timelineStartDate = filteredTimeline[0]?.date ? `${filteredTimeline[0].date}-01` : '2000-01-01';
  const timelineEndDate = filteredTimeline[filteredTimeline.length - 1]?.date ? `${filteredTimeline[filteredTimeline.length - 1].date}-31` : '2099-12-31';

  const startMs = new Date(timelineStartDate).getTime();
  const endMs = new Date(timelineEndDate).getTime();
  const timeSpanMs = Math.max(1, endMs - startMs);

  const getTxXCoord = (txDateStr: string) => {
    const txMs = new Date(txDateStr.slice(0, 10)).getTime();
    const pct = Math.max(0, Math.min(1, (txMs - startMs) / timeSpanMs));
    return padLeft + pct * usableW;
  };

  const activePoint =
    hoverIdx !== null && filteredTimeline[hoverIdx]
      ? filteredTimeline[hoverIdx]
      : filteredTimeline[filteredTimeline.length - 1] || null;

  const assetBreakdown: Record<string, number> = {
    'Equities & Mutual Funds': holdingsWithValues
      .filter((h) => h.category !== 'FIXED_DEPOSIT')
      .reduce((s, h) => s + h.baseVal, 0),
    'Fixed Deposits & Savings': holdingsWithValues
      .filter((h) => h.category === 'FIXED_DEPOSIT')
      .reduce((s, h) => s + h.baseVal, 0),
    'Real Estate': totalRealEstate,
  };

  const sortedHoldings = [...holdingsWithValues].sort((a, b) => b.baseVal - a.baseVal);

  const currencyBreakdown: Record<string, number> = {};
  holdingsWithValues.forEach((h) => {
    currencyBreakdown[h.currency] = (currencyBreakdown[h.currency] || 0) + h.baseVal;
  });
  properties.forEach((p) => {
    currencyBreakdown[p.currency] = (currencyBreakdown[p.currency] || 0) + convertToBase(p.current_price, p.currency);
  });

  return (
    <div className="space-y-6">
      {/* Financial Health Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Net Worth</span>
          <div className="text-2xl font-extrabold mt-1 text-indigo-500">
            {formatVal(netWorth)}
          </div>
          <span className="text-[10px] opacity-60">Total Assets minus Liabilities</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Total Gross Assets</span>
          <div className="text-2xl font-extrabold mt-1 text-emerald-500 flex items-center gap-1">
            <ArrowUpRight className="w-5 h-5" /> {formatVal(totalAssets)}
          </div>
          <span className="text-[10px] opacity-60">Equities, FDs & Properties (Current Value)</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Total Liabilities</span>
          <div className="text-2xl font-extrabold mt-1 text-rose-500 flex items-center gap-1">
            <ArrowDownRight className="w-5 h-5" /> {formatVal(totalLiabilities)}
          </div>
          <span className="text-[10px] opacity-60">Mortgages & Loans</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Debt-to-Asset Ratio</span>
          <div className={`text-2xl font-extrabold mt-1 ${debtToAssetRatio > 50 ? 'text-rose-500' : 'text-indigo-500'}`}>
            {isMasked ? '•••%' : `${debtToAssetRatio.toFixed(1)}%`}
          </div>
          <span className="text-[10px] opacity-60">{debtToAssetRatio < 40 ? 'Healthy Leverage' : 'High Leverage'}</span>
        </div>
      </div>

      {/* Portfolio Growth Chart with Frequency Toggle */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <h2 className="font-bold text-base">Portfolio Growth Over Time</h2>
              </div>
              <p className="text-[11px] opacity-60">
                Reconstructed from transaction history with investment execution markers
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex gap-1 p-1 rounded-xl text-[10px] font-bold ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                {(['MONTHLY', 'YEARLY'] as FrequencyMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFrequency(mode)}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      frequency === mode ? 'bg-emerald-600 text-white shadow' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {mode === 'MONTHLY' ? 'Month-wise' : 'Year-wise'}
                  </button>
                ))}
              </div>

              <div className={`flex gap-1 p-1 rounded-xl text-[11px] font-bold ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                {(['1Y', '3Y', '5Y', 'ALL'] as TimeframeRange[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setRange(tf)}
                    className={`px-2 py-1 rounded-lg transition ${
                      range === tf ? 'bg-indigo-600 text-white shadow' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedTx ? (
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>
                  <b>{selectedTx.tx_type}</b>: {selectedTx.name} ({selectedTx.quantity} @ {selectedTx.price} {selectedTx.currency}) on {selectedTx.tx_date.slice(0, 10)}
                </span>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-[10px] underline font-bold">Close</button>
            </div>
          ) : activePoint ? (
            <div className={`flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 rounded-xl border text-xs ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <span className="opacity-60 text-[10px] uppercase font-bold block">Period</span>
                <span className="font-bold text-indigo-500">{activePoint.label}</span>
              </div>
              <div>
                <span className="opacity-60 text-[10px] uppercase font-bold block">Market Value</span>
                <span className="font-extrabold">{formatVal(activePoint.portfolioValue)}</span>
              </div>
              <div>
                <span className="opacity-60 text-[10px] uppercase font-bold block">Invested Capital</span>
                <span className="font-semibold text-emerald-500">{formatVal(activePoint.investedCost)}</span>
              </div>
              <div>
                <span className="opacity-60 text-[10px] uppercase font-bold block">Total Gain</span>
                {(() => {
                  const diff = activePoint.portfolioValue - activePoint.investedCost;
                  const pct = activePoint.investedCost > 0 ? (diff / activePoint.investedCost) * 100 : 0;
                  return (
                    <span className={`font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isMasked ? '••••••' : `${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString()} (${pct.toFixed(1)}%)`}
                    </span>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {filteredTimeline.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center opacity-60 text-xs space-y-2">
              <p>Import transaction CSVs to plot your investment timeline.</p>
              <button onClick={onGoToManage} className="text-indigo-500 font-semibold hover:underline flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Import Transactions
              </button>
            </div>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-52 overflow-visible"
                onMouseLeave={() => setHoverIdx(null)}
              >
                <defs>
                  <linearGradient id="nettoValueGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = padTop + usableH - ratio * usableH;
                  return (
                    <line
                      key={idx}
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke={isDark ? '#1e293b' : '#e2e8f0'}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  );
                })}

                {valueAreaPath && <path d={valueAreaPath} fill="url(#nettoValueGrad3)" />}

                {costLinePath && (
                  <path d={costLinePath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                )}

                {valueLinePath && (
                  <path d={valueLinePath} fill="none" stroke="#6366f1" strokeWidth="2.75" strokeLinecap="round" />
                )}

                {allTransactions.map((tx) => {
                  const txDateStr = tx.tx_date.slice(0, 10);
                  if (txDateStr < timelineStartDate || txDateStr > timelineEndDate) return null;
                  const x = getTxXCoord(txDateStr);
                  const isBuy = tx.tx_type === 'BUY';
                  return (
                    <g key={tx.id} className="cursor-pointer group" onClick={() => setSelectedTx(tx)}>
                      <circle
                        cx={x}
                        cy={chartHeight - 14}
                        r="3.5"
                        fill={isBuy ? '#10b981' : '#f43f5e'}
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth="1.5"
                      />
                      <title>{`${tx.tx_type}: ${tx.name} (${tx.quantity} @ ${tx.price}) on ${txDateStr}`}</title>
                    </g>
                  );
                })}

                {hoverIdx !== null && valueCoords[hoverIdx] && costCoords[hoverIdx] && (
                  <>
                    <line
                      x1={valueCoords[hoverIdx].x}
                      y1={padTop}
                      x2={valueCoords[hoverIdx].x}
                      y2={padTop + usableH}
                      stroke="#6366f1"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx={costCoords[hoverIdx].x} cy={costCoords[hoverIdx].y} r="4" fill="#10b981" />
                    <circle cx={valueCoords[hoverIdx].x} cy={valueCoords[hoverIdx].y} r="5" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
                  </>
                )}

                {filteredTimeline.map((pt, i) => {
                  const count = filteredTimeline.length;
                  const showLabel = i === 0 || i === count - 1 || (count > 4 && i === Math.floor(count / 2));
                  if (!showLabel) return null;
                  const { x } = valueCoords[i];
                  return (
                    <text
                      key={pt.date}
                      x={x}
                      y={chartHeight - 3}
                      textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
                      className="text-[9px] fill-current opacity-60"
                    >
                      {pt.label}
                    </text>
                  );
                })}

                {filteredTimeline.map((_, i) => {
                  const count = filteredTimeline.length;
                  const colW = usableW / Math.max(count, 1);
                  const x = valueCoords[i].x - colW / 2;
                  return (
                    <rect
                      key={i}
                      x={Math.max(0, x)}
                      y={0}
                      width={colW}
                      height={chartHeight - 20}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoverIdx(i)}
                    />
                  );
                })}
              </svg>

              <div className="flex flex-wrap justify-between items-center text-xs opacity-80 pt-1 gap-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-indigo-500 inline-block" /> Market Value</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-500 inline-block" /> Cost Basis</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Buy Time Marker</span>
                </div>
                <span className="text-[10px] opacity-60">{frequency === 'YEARLY' ? 'Yearly checkpoints' : 'Monthly checkpoints'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Asset Class Allocation */}
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-base">Gross Asset Allocation</h2>
          </div>

          <div className="space-y-4 pt-2">
            {totalAssets === 0 ? (
              <p className="text-xs opacity-60 text-center py-12">No assets recorded yet.</p>
            ) : (
              Object.entries(assetBreakdown).map(([category, val]) => {
                const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                return (
                  <div key={category} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{category}</span>
                      <span>{formatVal(val)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          category.includes('Real')
                            ? 'bg-amber-500'
                            : category.includes('Fixed')
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                        }`}
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
            <Layers className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-base">Stock & Fund Concentration (Top Holdings)</h2>
          </div>
          <span className="text-xs opacity-60">{sortedHoldings.length} Total Holdings</span>
        </div>

        <div className="space-y-3 pt-1">
          {sortedHoldings.length === 0 ? (
            <p className="text-xs opacity-60 text-center py-6">No stock or fund holdings imported yet.</p>
          ) : (
            sortedHoldings.slice(0, 10).map((h) => {
              const pct = totalAssets > 0 ? (h.baseVal / totalAssets) * 100 : 0;
              return (
                <div key={h.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="flex items-center gap-2">
                      <b className={isDark ? 'text-white' : 'text-slate-900'}>{h.name}</b>
                      <span className="opacity-60 text-[10px]">
                        ({h.symbol !== h.name ? `${h.symbol} • ` : ''}{h.broker})
                      </span>
                    </span>
                    <span>
                      {formatVal(h.baseVal)}{' '}
                      <b className="text-indigo-500">({pct.toFixed(1)}%)</b>
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
        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-sky-500" />
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
                      <span>{formatVal(val)} ({pct.toFixed(1)}%)</span>
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

        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-base">Fixed Deposit Maturities</h2>
          </div>
          <div className="space-y-2 text-xs">
            {holdingsWithValues.filter((h) => h.category === 'FIXED_DEPOSIT').length === 0 ? (
              <p className="text-xs opacity-60 text-center py-6">No Fixed Deposits recorded.</p>
            ) : (
              holdingsWithValues
                .filter((h) => h.category === 'FIXED_DEPOSIT')
                .map((fd) => (
                  <div
                    key={fd.id}
                    className={`p-3 rounded-xl border flex justify-between items-center ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fd.name}</span>
                      <p className="text-[10px] opacity-60">
                        {fd.broker} • {fd.interest_rate}% interest
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-500">{fd.maturity_date || 'No maturity date'}</span>
                      <p className="text-[10px] opacity-60">{formatVal(fd.baseVal)}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <h3 className="font-bold text-sm">Consolidated Portfolio Holdings (Live Valuation)</h3>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold">
            + Add or Edit Holdings
          </button>
        </div>
        <table className="w-full text-left text-xs">
          <thead className={`border-b uppercase tracking-wider ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            <tr>
              <th className="p-4">Broker / Bank</th>
              <th className="p-4">Fund / Stock Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Qty / Principal</th>
              <th className="p-4">Buy Avg vs Market Price</th>
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
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {h.name}
                      </span>
                      {h.symbol && h.symbol !== h.name && (
                        <span className="opacity-50 text-[10px] font-mono">ISIN/Ticker: {h.symbol}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isFD ? 'bg-emerald-500/15 text-emerald-500' : 'bg-indigo-500/15 text-indigo-500'
                        }`}
                      >
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD ? formatVal(h.principal, h.currency) : h.quantity.toLocaleString()}
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD ? (
                        `${h.interest_rate}%`
                      ) : (
                        <div>
                          <span className="font-semibold">
                            {isMasked ? '••••' : `${h.effectiveMarketPrice.toFixed(2)} ${h.currency}`}
                          </span>
                          <span className="block text-[10px] opacity-60">
                            Avg buy: {isMasked ? '••••' : `${h.avg_price.toFixed(2)} ${h.currency}`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className={`p-4 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatVal(h.baseVal)}
                    </td>
                    <td className={`p-4 text-right font-semibold ${h.gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isMasked ? '••••••' : `${h.gain >= 0 ? '+' : ''}${Math.round(h.gain).toLocaleString()} (${h.gainPct.toFixed(1)}%)`}
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
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">Real Estate & Properties</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold">
            + Add Property
          </button>
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
                <td colSpan={6} className="p-8 text-center opacity-60">
                  No properties added yet.
                </td>
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
                    <td className="p-4 opacity-80">
                      {p.buy_month}/{p.buy_year}
                    </td>
                    <td className="p-4 opacity-80">{formatVal(buyBase)}</td>
                    <td className="p-4 font-bold text-emerald-500">{formatVal(curBase)}</td>
                    <td className={`p-4 text-right font-semibold ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isMasked ? '••••••' : `${gain >= 0 ? '+' : ''}${Math.round(gain).toLocaleString()} (${gainPct.toFixed(1)}%)`}
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
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-500" />
            <h3 className="font-bold text-sm">Liabilities & Outstanding Loans</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold">
            + Add Liability
          </button>
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
                <td colSpan={5} className="p-8 text-center opacity-60">
                  No liabilities recorded yet.
                </td>
              </tr>
            ) : (
              liabilities.map((l) => {
                const remBase = convertToBase(l.remaining_balance, l.currency);
                const origBase = convertToBase(l.total_loan, l.currency);
                return (
                  <tr key={l.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="p-4 font-semibold">{l.name}</td>
                    <td className="p-4 uppercase text-[10px] font-bold">{l.liability_type}</td>
                    <td className="p-4 text-amber-500 font-semibold">{l.interest_rate}%</td>
                    <td className="p-4 opacity-80">{formatVal(origBase)}</td>
                    <td className="p-4 text-right font-bold text-rose-500">{formatVal(remBase)}</td>
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