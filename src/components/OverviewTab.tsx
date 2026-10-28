import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  PieChart,
  PlusCircle,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Globe2,
  Landmark,
  Layers,
  ShoppingBag,
  Activity,
  Sparkles,
  Bot, 
  Cpu,
} from 'lucide-react';
import {
  calculateFDCurrentValue,
  getProperties,
  getLiabilities,
  getHistoricalPortfolioTimeline,
  getAllTransactions,
  getAllHoldingSectors,
} from '../db/database';
import {
  CurrencyCode,
  HoldingRow,
  PropertyRow,
  LiabilityRow,
  TransactionRow,
  SectorWeight,
} from '../types';
import type { Database } from 'sql.js';
import { getHoldingAiExposure } from '../utils/aiExposure';

interface OverviewTabProps {
  db: Database;
  holdings: HoldingRow[];
  baseCurrency: CurrencyCode;
  fxRates: Record<string, number>;
  theme: 'dark' | 'light';
  isMasked: boolean;
  sectorVersion?: number;
  onAutoClassifySectors?: () => Promise<number>;
  onGoToManage: () => void;
  onOpenPrivacyModal?: () => void;
  onOpenHowToUse?: () => void;
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
  sectorVersion = 0,
  onAutoClassifySectors,
  onGoToManage,
}) => {
  const isDark = theme === 'dark';
  const [range, setRange] = useState<TimeframeRange>('ALL');
  const [frequency, setFrequency] = useState<FrequencyMode>('MONTHLY');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [classifyNotice, setClassifyNotice] = useState<string>('');
  const [selectedSectorHolding, setSelectedSectorHolding] = useState<string>('ALL');

  const properties: PropertyRow[] = useMemo(() => getProperties(db), [db, holdings]);
  const liabilities: LiabilityRow[] = useMemo(() => getLiabilities(db), [db, holdings]);
  const allTransactions: TransactionRow[] = useMemo(() => getAllTransactions(db), [db, holdings]);
  const sectorDatabaseMap = useMemo(
    () => getAllHoldingSectors(db),
    [db, holdings, sectorVersion]
  );

  const formatVal = (amount: number, currency: string = baseCurrency) => {
    if (isMasked) return '••••••';
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  };

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
  };

  const holdingsWithValues = useMemo(() => {
    return holdings.map((h) => {
      const isFD = h.category === 'FIXED_DEPOSIT';
      const effectiveMarketPrice = h.market_price > 0 ? h.market_price : h.avg_price;
      const nativeVal = isFD
        ? calculateFDCurrentValue(h)
        : h.category === 'PENSION'
        ? h.market_price > 0
          ? h.market_price
          : h.principal || 0
        : h.quantity * effectiveMarketPrice;
      const costVal = isFD
        ? h.principal
        : h.category === 'PENSION'
        ? h.principal || h.market_price || 0
        : h.quantity * h.avg_price;
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
  }, [holdings, fxRates, baseCurrency]);

  const totalFinancialAssets = holdingsWithValues.reduce((sum, h) => sum + h.baseVal, 0);
  const totalRealEstate = properties.reduce(
    (sum, p) => sum + convertToBase(p.current_price, p.currency),
    0
  );
  const totalAssets = totalFinancialAssets + totalRealEstate;
  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + convertToBase(l.remaining_balance, l.currency),
    0
  );
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // 1. 5-Way Segregated Asset Class Allocation
  const assetBreakdown: Record<string, number> = {
    'Individual Equities': holdingsWithValues
      .filter((h) => h.category === 'EQUITY')
      .reduce((s, h) => s + h.baseVal, 0),
    'Funds & ETFs': holdingsWithValues
      .filter((h) => h.category === 'MUTUAL_FUND')
      .reduce((s, h) => s + h.baseVal, 0),
    'Fixed Deposits & Savings': holdingsWithValues
      .filter((h) => h.category === 'FIXED_DEPOSIT')
      .reduce((s, h) => s + h.baseVal, 0),
    'Real Estate': totalRealEstate,
    'Pension & Retirement': holdingsWithValues
      .filter((h) => h.category === 'PENSION')
      .reduce((s, h) => s + h.baseVal, 0),
  };

  // 2. Broker / Institution Exposure Summary
  const brokerBreakdown = useMemo(() => {
    const summary: Record<string, number> = {};

    holdingsWithValues.forEach((h) => {
      const brokerKey = h.broker || 'Other';
      summary[brokerKey] = (summary[brokerKey] || 0) + h.baseVal;
    });

    if (totalRealEstate > 0) {
      summary['Real Estate'] = totalRealEstate;
    }

    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [holdingsWithValues, totalRealEstate]);

  const equityAndFundHoldings = useMemo(
    () => holdingsWithValues.filter((h) => h.category === 'EQUITY' || h.category === 'MUTUAL_FUND'),
    [holdingsWithValues]
  );

  // 3. Look-through Sector Allocation (Overall OR Single Fund/Stock)
  const { sectorSummary, totalEquityAndFundVal } = useMemo(() => {
    const summary: Record<string, number> = {};
    let totalVal = 0;

    const targetHoldings =
      selectedSectorHolding === 'ALL'
        ? equityAndFundHoldings
        : equityAndFundHoldings.filter((h) => h.symbol === selectedSectorHolding);

    targetHoldings.forEach((h) => {
      totalVal += h.baseVal;
      const weights = sectorDatabaseMap[h.symbol];

      if (weights && weights.length > 0) {
        weights.forEach((w: SectorWeight) => {
          const allocated = h.baseVal * (w.weight_pct / 100);
          summary[w.sector] = (summary[w.sector] || 0) + allocated;
        });
      } else {
        const fallback = 'Other / Unclassified';
        summary[fallback] = (summary[fallback] || 0) + h.baseVal;
      }
    });

    const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    return { sectorSummary: sorted, totalEquityAndFundVal: totalVal };
  }, [equityAndFundHoldings, sectorDatabaseMap, selectedSectorHolding]);

  const fullTimeline = getHistoricalPortfolioTimeline(
    db,
    holdings,
    properties,
    fxRates,
    baseCurrency,
    frequency
  );

  const filteredTimeline = (() => {
    if (range === 'ALL') return fullTimeline;
    const limit =
      range === '1Y'
        ? frequency === 'YEARLY'
          ? 1
          : 12
        : range === '3Y'
        ? frequency === 'YEARLY'
          ? 3
          : 36
        : frequency === 'YEARLY'
        ? 5
        : 60;
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
  const timelineEndDate = filteredTimeline[filteredTimeline.length - 1]?.date
    ? `${filteredTimeline[filteredTimeline.length - 1].date}-31`
    : '2099-12-31';

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

  const sortedHoldings = [...holdingsWithValues]
    .filter((h) => h.category !== 'PENSION' && h.category !== 'FIXED_DEPOSIT')
    .sort((a, b) => b.baseVal - a.baseVal);

  const currencyBreakdown: Record<string, number> = {};
  holdingsWithValues.forEach((h) => {
    currencyBreakdown[h.currency] = (currencyBreakdown[h.currency] || 0) + h.baseVal;
  });
  properties.forEach((p) => {
    currencyBreakdown[p.currency] =
      (currencyBreakdown[p.currency] || 0) + convertToBase(p.current_price, p.currency);
  });

  // Inside OverviewTab:
  const { totalAiCapital, aiExposurePct } = useMemo(() => {
    let aiCapital = 0;
    let totalEquityFundVal = 0;

    holdingsWithValues
      .filter((h) => h.category === 'EQUITY' || h.category === 'MUTUAL_FUND')
      .forEach((h) => {
        totalEquityFundVal += h.baseVal;
        const exposurePct = getHoldingAiExposure(h);
        aiCapital += h.baseVal * (exposurePct / 100);
      });

    const pct = totalEquityFundVal > 0 ? (aiCapital / totalEquityFundVal) * 100 : 0;
    return { totalAiCapital: aiCapital, aiExposurePct: pct };
  }, [holdingsWithValues]);

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
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
          <span className="text-[10px] opacity-60">Equities, FDs, Real Estate &amp; Pension</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Total Liabilities</span>
          <div className="text-2xl font-extrabold mt-1 text-rose-500 flex items-center gap-1">
            <ArrowDownRight className="w-5 h-5" /> {formatVal(totalLiabilities)}
          </div>
          <span className="text-[10px] opacity-60">Mortgages &amp; Outstanding Loans</span>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] uppercase tracking-wider opacity-60 font-semibold">Debt-to-Asset Ratio</span>
          <div className={`text-2xl font-extrabold mt-1 ${debtToAssetRatio > 50 ? 'text-rose-500' : 'text-indigo-500'}`}>
            {isMasked ? '•••%' : `${debtToAssetRatio.toFixed(1)}%`}
          </div>
          <span className="text-[10px] opacity-60">{debtToAssetRatio < 40 ? 'Healthy Leverage' : 'High Leverage'}</span>
        </div>
      </div>

      {/* 2. Growth Chart & 5-Way Segregated Asset Class Allocation */}
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
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
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
                    className={`px-2 py-1 rounded-lg transition cursor-pointer ${
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
              <button onClick={() => setSelectedTx(null)} className="text-[10px] underline font-bold cursor-pointer">
                Close
              </button>
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
              <button onClick={onGoToManage} className="text-indigo-500 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
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

        <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-base">Gross Asset Allocation</h2>
          </div>

          <div className="space-y-3 pt-1">
            {totalAssets === 0 ? (
              <p className="text-xs opacity-60 text-center py-12">No assets recorded yet.</p>
            ) : (
              Object.entries(assetBreakdown).map(([category, val]) => {
                const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                const colorClass = category.includes('Equities')
                  ? 'bg-blue-500'
                  : category.includes('Funds')
                  ? 'bg-indigo-500'
                  : category.includes('Fixed')
                  ? 'bg-emerald-500'
                  : category.includes('Real')
                  ? 'bg-amber-500'
                  : 'bg-purple-500';

                return (
                  <div key={category} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{category}</span>
                      <span>
                        {formatVal(val)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Broker & Institution Exposure */}
      <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-base">Broker &amp; Institution Exposure</h2>
          </div>
          <span className="text-xs opacity-60 font-mono">{brokerBreakdown.length} Institutions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {brokerBreakdown.map(([broker, val]) => {
            const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
            return (
              <div
                key={broker}
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs truncate" title={broker}>
                    {broker}
                  </span>
                  <span className="text-[10px] font-mono opacity-60">{pct.toFixed(1)}%</span>
                </div>
                <div className="font-mono font-extrabold text-sm text-indigo-400">
                  {formatVal(val)}
                </div>
                <div className={`w-full h-1.5 rounded-full mt-2 overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <div style={{ width: `${pct}%` }} className="h-full bg-indigo-500 rounded-full" />
                </div>
              </div>
            );
          })}

          {brokerBreakdown.length === 0 && (
            <div className="col-span-full text-center py-6 text-xs opacity-60">
              No institution data available.
            </div>
          )}
        </div>
      </div>

      {/* 4. Look-Through Sector Exposure Breakdown */}
      <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isDark ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-indigo-50/70 border-indigo-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Estimated AI &amp; Compute Exposure
                  </span>
                </div>
                <p className="text-[11px] opacity-70 mt-0.5">
                  Look-through weight across hyperscalers, chipmakers, and ETF underlying holdings
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-extrabold font-mono text-indigo-400">
                {isMasked ? '•••%' : `${aiExposurePct.toFixed(1)}%`}
              </div>
              <div className="text-[11px] font-mono opacity-60">
                {formatVal(totalAiCapital)}
              </div>
            </div>
          </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-base">Equity &amp; Fund Sector Exposure</h2>
            </div>
            <p className="text-[11px] opacity-60 mt-0.5">
              Look-through GICS sector weights across ETFs, mutual funds, and direct stocks
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classifyNotice && (
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {classifyNotice}
              </span>
            )}

            {/* Fund / Stock Filter Dropdown */}
            <select
              value={selectedSectorHolding}
              onChange={(e) => setSelectedSectorHolding(e.target.value)}
              className={`border rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
              title="Filter sector breakdown by specific fund or stock"
            >
              <option value="ALL">All Equities &amp; Funds ({equityAndFundHoldings.length})</option>
              {equityAndFundHoldings.map((h) => (
                <option key={h.id} value={h.symbol}>
                  {h.name} ({h.broker})
                </option>
              ))}
            </select>

            {onAutoClassifySectors && (
              <button
                type="button"
                disabled={isClassifying}
                onClick={async () => {
                  try {
                    setIsClassifying(true);
                    const count = await onAutoClassifySectors();
                    setClassifyNotice(`Classified ${count} assets!`);
                    setTimeout(() => setClassifyNotice(''), 3500);
                  } finally {
                    setIsClassifying(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow transition cursor-pointer"
                title="Verify and auto-classify all ETFs, mutual funds, and stocks"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isClassifying ? 'Classifying...' : 'Auto-Classify All'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 pt-1">
          {sectorSummary.map(([sector, val]) => {
            const pct = totalEquityAndFundVal > 0 ? (val / totalEquityAndFundVal) * 100 : 0;
            return (
              <div key={sector} className="space-y-1 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="truncate">{sector}</span>
                  <span className="font-mono">
                    {formatVal(val)} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}

          {sectorSummary.length === 0 && (
            <div className="col-span-full text-center py-6 text-xs opacity-60">
              No stock or fund holdings available to classify.
            </div>
          )}
        </div>
      </div>

      {/* 5. Stock / Fund Concentration (Top Holdings) */}
      <div className={`border p-6 rounded-2xl space-y-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-base">Stock &amp; Fund Concentration (Top Holdings)</h2>
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

      {/* 6. Additional Analytics Row: Multi-Currency & FD Maturities */}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-base">Upcoming FD Maturities</h2>
            </div>
            {holdings.filter((h) => h.category === 'FIXED_DEPOSIT' && h.maturity_date).length > 3 && (
              <button
                onClick={onGoToManage}
                className="text-[11px] text-indigo-500 hover:underline font-semibold cursor-pointer"
              >
                View all ({holdings.filter((h) => h.category === 'FIXED_DEPOSIT' && h.maturity_date).length})
              </button>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {holdings.filter((h) => h.category === 'FIXED_DEPOSIT' && h.maturity_date).length === 0 ? (
              <p className="text-xs opacity-60 text-center py-6">No Fixed Deposits recorded with maturity dates.</p>
            ) : (
              holdings
                .filter((h) => h.category === 'FIXED_DEPOSIT' && h.maturity_date)
                .sort((a, b) => (a.maturity_date || '').localeCompare(b.maturity_date || ''))
                .slice(0, 3)
                .map((fd) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isMatured = Boolean(fd.maturity_date && fd.maturity_date < today);
                  const daysRemaining = fd.maturity_date
                    ? Math.ceil((new Date(fd.maturity_date).getTime() - new Date().getTime()) / 86400000)
                    : 0;
                  const displayVal = fd.market_price && fd.market_price > 0 ? fd.market_price : fd.principal || 0;

                  return (
                    <div
                      key={fd.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>{fd.name}</span>
                        <div className="text-[10px] opacity-60 flex items-center gap-1.5 mt-0.5">
                          <span>{fd.broker}</span>
                          <span>•</span>
                          <span>Due: {fd.maturity_date}</span>
                          <span>•</span>
                          {isMatured ? (
                            <span className="text-emerald-500 font-bold">Matured</span>
                          ) : (
                            <span className="text-indigo-400 font-medium">{daysRemaining}d left</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-500 block">
                          {isMasked ? '••••••' : `${Math.round(displayVal).toLocaleString()} ${fd.currency}`}
                        </span>
                        <span className="text-[10px] opacity-60 font-mono">{fd.interest_rate}% p.a.</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* 7. Consolidated Portfolio Holdings Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <h3 className="font-bold text-sm">Consolidated Portfolio Holdings (Live Valuation)</h3>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold cursor-pointer">
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
                  No holdings found. Click <b>Manage &amp; Import Assets</b> above.
                </td>
              </tr>
            ) : (
              holdingsWithValues.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
                const isPension = h.category === 'PENSION';
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
                          isFD
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : isPension
                            ? 'bg-purple-500/15 text-purple-400'
                            : h.category === 'MUTUAL_FUND'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-indigo-500/15 text-indigo-500'
                        }`}
                      >
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD || isPension ? formatVal(h.principal || h.market_price, h.currency) : h.quantity.toLocaleString()}
                    </td>
                    <td className="p-4 opacity-90">
                      {isFD ? (
                        `${h.interest_rate}%`
                      ) : isPension ? (
                        <span className="font-semibold text-purple-400">
                          {isMasked ? '••••' : `${formatVal(h.effectiveMarketPrice, h.currency)}`}
                        </span>
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

      {/* 8. Properties Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">Real Estate &amp; Properties</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold cursor-pointer">
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

      {/* 9. Liabilities Table */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-500" />
            <h3 className="font-bold text-sm">Liabilities &amp; Outstanding Loans</h3>
          </div>
          <button onClick={onGoToManage} className="text-xs text-indigo-500 hover:underline font-semibold cursor-pointer">
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