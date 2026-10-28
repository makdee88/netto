import React, { useState } from 'react';
import { X, ClipboardPaste, CheckCircle2 } from 'lucide-react';
import { parsePastedFdRows, ParsedFdItem } from '../../parsers/fdImporter';

interface FdPasteModalProps {
  isDark: boolean;
  onClose: () => void;
  onSave: (items: ParsedFdItem[]) => Promise<void> | void;
}

export const FdPasteModal: React.FC<FdPasteModalProps> = ({
  isDark,
  onClose,
  onSave,
}) => {
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [previewFdItems, setPreviewFdItems] = useState<ParsedFdItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleProcessPastedText = (text: string) => {
    setPastedRawText(text);
    const items = parsePastedFdRows(text);
    setPreviewFdItems(items);
  };

  const handleSaveBulk = async () => {
    if (previewFdItems.length === 0) return;
    try {
      setIsSaving(true);
      await onSave(previewFdItems);
      onClose();
    } catch (err: any) {
      alert(`Bulk save failed: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-4xl rounded-3xl p-6 sm:p-8 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
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
            onClick={onClose}
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
            <span className="font-mono text-emerald-400 font-bold">
              {previewFdItems.length} recognized
            </span>
          </div>
          <textarea
            rows={5}
            value={pastedRawText}
            onChange={(e) => handleProcessPastedText(e.target.value)}
            placeholder={
              'SBAB\tFasträntekonto 1Y\t100000\t3.75\tSEK\t2026-01-15\t2027-01-15\nHDFC\tTax Saver FD\t50000\t7.10\tINR\t2025-05-10\t2030-05-10'
            }
            className={`w-full p-3 rounded-2xl border font-mono text-xs outline-none ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-200'
                : 'bg-slate-50 border-slate-300'
            }`}
          />
        </div>

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
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={previewFdItems.length === 0 || isSaving}
            onClick={handleSaveBulk}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSaving ? 'Saving & Encrypting...' : `Save ${previewFdItems.length} Deposits`}
          </button>
        </div>
      </div>
    </div>
  );
};