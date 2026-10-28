import React, { useState } from 'react';
import type { Database } from 'sql.js';
import { X, Sparkles, RotateCcw, PieChart } from 'lucide-react';
import {
  HoldingRow,
  GICS_SECTORS,
  GicsSector,
  SectorWeight,
} from '../../types';
import { getHoldingSectors, saveHoldingSectors } from '../../db/database';

interface SectorEditorModalProps {
  holding: HoldingRow;
  db: Database;
  isDark: boolean;
  onClose: () => void;
  onSaveVault?: () => Promise<void> | void;
}

const detectDefaultSectorWeights = (h: HoldingRow): SectorWeight[] => {
  const target = `${h.name || ''} ${h.symbol || ''}`.toLowerCase().replace(/[-_.,]/g, ' ');
  const single = (sector: GicsSector): SectorWeight[] => [{ sector, weight_pct: 100 }];

  if (target.includes('iwvl') || (target.includes('world') && target.includes('value'))) {
    return [
      { sector: 'Financials', weight_pct: 28.0 },
      { sector: 'Industrials', weight_pct: 15.0 },
      { sector: 'Healthcare', weight_pct: 14.0 },
      { sector: 'Technology', weight_pct: 10.5 },
      { sector: 'Consumer Staples', weight_pct: 9.0 },
      { sector: 'Energy', weight_pct: 8.5 },
      { sector: 'Communication Services', weight_pct: 6.0 },
      { sector: 'Utilities', weight_pct: 5.0 },
      { sector: 'Materials', weight_pct: 4.0 },
    ];
  }

  if (target.includes('spiltan') || target.includes('investmentbolag')) {
    return [
      { sector: 'Financials', weight_pct: 55.0 },
      { sector: 'Industrials', weight_pct: 32.0 },
      { sector: 'Healthcare', weight_pct: 7.0 },
      { sector: 'Technology', weight_pct: 6.0 },
    ];
  }

  if (target.match(/omx|sverige|sweden|avanza zero|plus alla bolag|norden|nordic/)) {
    return [
      { sector: 'Industrials', weight_pct: 39.5 },
      { sector: 'Financials', weight_pct: 26.5 },
      { sector: 'Technology', weight_pct: 9.5 },
      { sector: 'Healthcare', weight_pct: 8.0 },
      { sector: 'Consumer Discretionary', weight_pct: 7.5 },
      { sector: 'Materials', weight_pct: 5.0 },
      { sector: 'Communication Services', weight_pct: 4.0 },
    ];
  }

  if (target.match(/usa|s&p|sp500|nasdaq|qqq|spy/)) {
    return [
      { sector: 'Technology', weight_pct: 31.0 },
      { sector: 'Financials', weight_pct: 13.0 },
      { sector: 'Healthcare', weight_pct: 12.0 },
      { sector: 'Consumer Discretionary', weight_pct: 10.5 },
      { sector: 'Communication Services', weight_pct: 9.0 },
      { sector: 'Industrials', weight_pct: 8.5 },
      { sector: 'Consumer Staples', weight_pct: 6.0 },
      { sector: 'Energy', weight_pct: 4.0 },
      { sector: 'Utilities', weight_pct: 3.0 },
      { sector: 'Materials', weight_pct: 3.0 },
    ];
  }

  if (target.match(/nifty|sensex|india|bharat|parag parikh|mirae|axis|kotak|sbi|hdfc|icici|nippon|uti|quant|motilal/)) {
    return [
      { sector: 'Financials', weight_pct: 34.0 },
      { sector: 'Technology', weight_pct: 13.5 },
      { sector: 'Energy', weight_pct: 11.5 },
      { sector: 'Consumer Staples', weight_pct: 9.0 },
      { sector: 'Consumer Discretionary', weight_pct: 8.5 },
      { sector: 'Materials', weight_pct: 8.0 },
      { sector: 'Industrials', weight_pct: 6.5 },
      { sector: 'Healthcare', weight_pct: 4.5 },
      { sector: 'Utilities', weight_pct: 2.5 },
      { sector: 'Communication Services', weight_pct: 2.0 },
    ];
  }

  if (target.match(/global|world|msci|acwi|länsförsäkringar|storebrand|dnb|vanguard|ishares|amundi|xtrackers|fond|fund|etf|ucits|index/)) {
    return [
      { sector: 'Technology', weight_pct: 26.5 },
      { sector: 'Financials', weight_pct: 15.5 },
      { sector: 'Healthcare', weight_pct: 12.0 },
      { sector: 'Industrials', weight_pct: 11.0 },
      { sector: 'Consumer Discretionary', weight_pct: 10.5 },
      { sector: 'Communication Services', weight_pct: 8.5 },
      { sector: 'Consumer Staples', weight_pct: 6.5 },
      { sector: 'Energy', weight_pct: 4.0 },
      { sector: 'Materials', weight_pct: 3.0 },
      { sector: 'Utilities', weight_pct: 2.5 },
    ];
  }

  if (target.match(/tech|semiconductor|software|apple|aapl|microsoft|msft|nvidia|nvda|tcs|infosys|infy|ericsson|fortnox/)) {
    return single('Technology');
  }
  if (target.match(/bank|financial|investor|inve|industrivärden|seb|swedbank|handelsbanken|shb|nordea/)) {
    return single('Financials');
  }
  if (target.match(/health|pharma|astrazeneca|azn|novo|sun pharma|cipla/)) {
    return single('Healthcare');
  }
  if (target.match(/industrial|volvo|atlas copco|atco|sandvik|abb|assa abloy|saab|skanska/)) {
    return single('Industrials');
  }

  return single('Other / Unclassified');
};

export const SectorEditorModal: React.FC<SectorEditorModalProps> = ({
  holding,
  db,
  isDark,
  onClose,
  onSaveVault,
}) => {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [sectorWeights, setSectorWeights] = useState<Record<GicsSector, number>>(() => {
    const existing = getHoldingSectors(db, holding.symbol);
    const initialWeights = {} as Record<GicsSector, number>;
    GICS_SECTORS.forEach((s) => (initialWeights[s] = 0));

    const hasValidSaved =
      existing &&
      existing.length > 0 &&
      !(existing.length === 1 && existing[0].sector === 'Other / Unclassified');

    if (hasValidSaved) {
      existing.forEach((item: SectorWeight) => {
        if (item.sector) {
          initialWeights[item.sector as GicsSector] = Number(item.weight_pct) || 0;
        }
      });
    } else {
      const detected = detectDefaultSectorWeights(holding);
      detected.forEach((item: SectorWeight) => {
        initialWeights[item.sector as GicsSector] = Number(item.weight_pct) || 0;
      });
    }
    return initialWeights;
  });

  const totalSectorPct = Object.values(sectorWeights).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );

  const handleClearAll = () => {
    const empty = {} as Record<GicsSector, number>;
    GICS_SECTORS.forEach((s) => (empty[s] = 0));
    setSectorWeights(empty);
  };

  const handleAutoDetect = () => {
    const detected = detectDefaultSectorWeights(holding);
    const updated = {} as Record<GicsSector, number>;
    GICS_SECTORS.forEach((s) => (updated[s] = 0));
    detected.forEach((item: SectorWeight) => {
      updated[item.sector as GicsSector] = Number(item.weight_pct) || 0;
    });
    setSectorWeights(updated);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload: SectorWeight[] = Object.entries(sectorWeights)
        .filter(([_, weight]) => Number(weight) > 0)
        .map(([sec, weight]) => ({
          sector: sec as GicsSector,
          weight_pct: Number(weight),
        }));

      saveHoldingSectors(db, holding.symbol, payload);

      if (onSaveVault) {
        await onSaveVault();
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save sectors:', err);
      alert(`Error saving sector split: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-xl rounded-3xl p-6 shadow-2xl border space-y-4 max-h-[90vh] flex flex-col ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/20 pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-purple-400">
              <PieChart className="w-4 h-4" /> Sector Breakdown: {holding.name}
            </h3>
            <p className="text-[11px] opacity-70 font-mono mt-0.5">
              {holding.symbol} ({holding.broker}) • Total must equal 100%
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold opacity-60">
              Quick 100% Allocation or Auto-Detect:
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAutoDetect}
                className="flex items-center gap-1 text-[10px] text-purple-400 hover:underline font-bold cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Auto-Detect Benchmark
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1 text-[10px] text-rose-400 hover:underline font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset All to 0%
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GICS_SECTORS.slice(0, 6).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  const reset = {} as Record<GicsSector, number>;
                  GICS_SECTORS.forEach((s) => (reset[s] = s === sec ? 100 : 0));
                  setSectorWeights(reset);
                }}
                className="px-2 py-1 rounded-lg border border-slate-700/50 text-[10px] hover:bg-purple-600 hover:text-white transition cursor-pointer"
              >
                100% {sec}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-72">
          {GICS_SECTORS.map((sector) => (
            <div
              key={sector}
              className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className="font-medium">{sector}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={sectorWeights[sector] || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setSectorWeights((prev) => ({
                      ...prev,
                      [sector]: val,
                    }));
                  }}
                  className="w-16 px-2 py-1 rounded-lg border text-right font-mono text-xs bg-transparent"
                  placeholder="0"
                />
                <span className="font-mono opacity-60">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800/20 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span>Total Allocated:</span>
            <span
              className={
                Math.abs(totalSectorPct - 100) < 0.5 ? 'text-emerald-400' : 'text-rose-400'
              }
            >
              {totalSectorPct.toFixed(1)}% / 100%
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Math.abs(totalSectorPct - 100) > 0.5 || isSaving}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs shadow transition cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Sector Split'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};