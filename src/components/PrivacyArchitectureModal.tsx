import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PrivacyArchitectureModalProps {
  onClose: () => void;
}

export const PrivacyArchitectureModal: React.FC<PrivacyArchitectureModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">How Netto Protects Your Data</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-bold">
            ✕ Close
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            Netto uses a <b>Local-First, Zero-Knowledge Architecture</b>. Your SQLite database exists{' '}
            <b>only in your browser memory</b> and is encrypted before being saved anywhere.
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-3">Data Element</th>
                  <th className="p-3">Where It Lives</th>
                  <th className="p-3">Can Our Server Read It?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                <tr>
                  <td className="p-3 font-semibold text-white">Master Encryption Passphrase</td>
                  <td className="p-3">Browser RAM only (PBKDF2 100k SHA-256)</td>
                  <td className="p-3 text-emerald-400 font-semibold">NEVER leaves your device</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Quantities, Buy Prices, FD Principal & Net Worth</td>
                  <td className="p-3">AES-256-GCM Encrypted SQLite (Local / Your Google Drive)</td>
                  <td className="p-3 text-emerald-400 font-semibold">NO (100% Encrypted Client-Side)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Broker CSV Files (Avanza, Zerodha, IBKR)</td>
                  <td className="p-3">Parsed locally in browser via PapaParse</td>
                  <td className="p-3 text-emerald-400 font-semibold">NEVER uploaded to any server</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Anonymous Ticker Lookup & Vault UUID</td>
                  <td className="p-3">Stateless Cloudflare Worker (`/api/quotes`)</td>
                  <td className="p-3 text-amber-300">
                    Only sees anonymous ticker list (e.g. `INFY.NS, VOLV-B.ST`) to return market prices
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-emerald-400 pt-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Even if your `netto_vault.sqlite.enc` file is downloaded from your Google Drive, it cannot be opened
              without your Master Passphrase.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
