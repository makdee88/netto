import React from 'react';
import { CsvImportResult } from '../types';
import { CheckCircle2, AlertTriangle, FileSpreadsheet, X } from 'lucide-react';

interface CsvImportSummaryModalProps {
  summary: CsvImportResult;
  isDark: boolean;
  onClose: () => void;
}

export const CsvImportSummaryModal: React.FC<CsvImportSummaryModalProps> = ({
  summary,
  isDark,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div
        className={`max-w-md w-full border rounded-3xl p-6 shadow-2xl relative ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl border border-transparent hover:border-slate-700 opacity-70 hover:opacity-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold">CSV Import Successful</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Broker ledger updated and encrypted
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 my-5">
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-70">Transactions Added</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              +{summary.newTransactionsAdded}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-[11px] font-semibold opacity-70">Holdings Recomputed</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {summary.holdingsUpdated}
            </div>
          </div>
        </div>

        {summary.duplicatesSkipped > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Skipped <strong>{summary.duplicatesSkipped}</strong> identical duplicate transactions.
            </span>
          </div>
        )}

        {summary.errors && summary.errors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-4 max-h-32 overflow-y-auto">
            <div className="font-bold mb-1">Warnings / Parse notes:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};