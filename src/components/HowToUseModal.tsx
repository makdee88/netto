import React, { useState } from 'react';
import {
  X,
  BookOpen,
  KeyRound,
  ShieldCheck,
  Building,
  CreditCard,
  FileSpreadsheet,
  UploadCloud,
  EyeOff,
  RefreshCw,
  Landmark,
  ArrowRight,
  Database,
  Lock,
  FileDown,
} from 'lucide-react';

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  onGetStarted?: () => void;
}

type SectionKey = 'OVERVIEW' | 'VAULT_SECURITY' | 'BROKER_IMPORTS' | 'FIXED_DEPOSITS' | 'REAL_ESTATE_LOANS' | 'SYNC_BACKUP';

export const HowToUseModal: React.FC<HowToUseModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  onGetStarted,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('OVERVIEW');
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div
        className={`w-full max-w-5xl h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">How Netto Works</h2>
              <p className="text-xs opacity-60">Architecture, Ledger Workflows &amp; Feature Clarifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-70 hover:opacity-100 hover:bg-slate-800/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar Navigation + Main Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar Tabs */}
          <nav
            className={`w-full md:w-64 p-3 md:border-r border-b md:border-b-0 space-y-1 text-xs shrink-0 overflow-x-auto md:overflow-y-auto ${
              isDark ? 'bg-slate-950/40 border-slate-800/40' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <button
              onClick={() => setActiveSection('OVERVIEW')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'OVERVIEW'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <Database className="w-4 h-4" /> Quick Start &amp; Core Idea
            </button>

            <button
              onClick={() => setActiveSection('VAULT_SECURITY')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'VAULT_SECURITY'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <KeyRound className="w-4 h-4" /> Vault Passphrase &amp; Privacy
            </button>

            <button
              onClick={() => setActiveSection('BROKER_IMPORTS')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'BROKER_IMPORTS'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Broker Imports (Stocks &amp; Funds)
            </button>

            <button
              onClick={() => setActiveSection('FIXED_DEPOSITS')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'FIXED_DEPOSITS'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <Landmark className="w-4 h-4" /> Fixed Deposits &amp; Quick Paste
            </button>

            <button
              onClick={() => setActiveSection('REAL_ESTATE_LOANS')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'REAL_ESTATE_LOANS'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <Building className="w-4 h-4" /> Real Estate &amp; Mortgages
            </button>

            <button
              onClick={() => setActiveSection('SYNC_BACKUP')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium transition text-left cursor-pointer ${
                activeSection === 'SYNC_BACKUP'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100 hover:bg-slate-800/20'
              }`}
            >
              <UploadCloud className="w-4 h-4" /> Drive Sync &amp; Backups
            </button>
          </nav>

          {/* Main Info Display */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 text-xs leading-relaxed">
            {/* 1. OVERVIEW */}
            {activeSection === 'OVERVIEW' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-indigo-400">What is Netto?</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    Netto is a zero-knowledge, encrypted personal wealth tracker designed for multi-asset investors. Unlike traditional finance apps, Netto never stores your financial balances or stock tickers on an unencrypted server. Everything runs locally in your browser using in-memory WebAssembly SQLite.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-indigo-400 font-bold mb-1 flex items-center gap-1.5">
                      <Lock className="w-4 h-4" /> 1. Client-Side Encryption
                    </div>
                    <p className="opacity-75">Your vault is encrypted with AES-256-GCM using your personal passphrase before touching disk or Google Drive.</p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                      <Database className="w-4 h-4" /> 2. Real SQL Database
                    </div>
                    <p className="opacity-75">Uses embedded SQLite (sql.js). It computes exact cost bases, realized P&amp;L, and compound interest using true relational queries.</p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-sky-400 font-bold mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> 3. Multi-Currency
                    </div>
                    <p className="opacity-75">Keep holdings in native currencies (SEK, USD, EUR, INR) while automatically converting net worth to your selected base view.</p>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-indigo-950/20 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-200'}`}>
                  <h4 className="font-bold text-indigo-400">Step-by-Step Workflow:</h4>
                  <ol className="list-decimal list-inside space-y-1 opacity-90 pl-1">
                    <li>Sign in with your Google account to enable encrypted sync.</li>
                    <li>Create your vault passphrase (do not lose this—it cannot be recovered).</li>
                    <li>Head to <strong>Manage Assets</strong> to import stock brokers, paste Fixed Deposits, and list properties.</li>
                    <li>Review your asset allocation, historical growth curves, and net worth on the <strong>Overview</strong> dashboard.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* 2. VAULT SECURITY */}
            {activeSection === 'VAULT_SECURITY' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-indigo-400">Zero-Knowledge Vault Security</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    How Netto ensures total privacy even if someone inspects your browser storage or intercepts network requests.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" /> Passphrase Derivation (PBKDF2)
                    </h4>
                    <p className="opacity-80">
                      Your master passphrase is never stored anywhere. Netto passes it through 100,000 rounds of PBKDF2 with SHA-256 and a random salt to generate a 256-bit encryption key. If you forget your passphrase, nobody (not even Netto administrators) can decrypt your data.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4" /> Privacy Masking Mode
                    </h4>
                    <p className="opacity-80">
                      Click the <strong>Privacy: ON / OFF</strong> toggle in the header bar whenever you are in public or screen-sharing. It masks all monetary balances, quantities, and loan amounts with `••••••` while keeping charts and allocation percentages visible.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                      <Lock className="w-4 h-4" /> Explicit Lock
                    </h4>
                    <p className="opacity-80">
                      Clicking the lock icon instantly flushes the decrypted SQLite database from browser memory, destroys the active session encryption key, and returns you to the Unlock screen.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. BROKER IMPORTS */}
            {activeSection === 'BROKER_IMPORTS' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-indigo-400">Broker Ledger Imports</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    Netto accepts raw broker statements and parses them into standardized buy/sell transaction rows.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="font-bold text-indigo-400 block mb-1">Avanza (Sweden)</span>
                      <p className="opacity-80">
                        Export your full history from <em>Mina sidor &gt; Kontosöversikt &gt; Historik &gt; Exportera</em>. Netto parses all buy orders, sell orders, dividends, and calculates running cost basis in SEK.
                      </p>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="font-bold text-indigo-400 block mb-1">Interactive Brokers (IBKR)</span>
                      <p className="opacity-80">
                        Go to <em>Performance &amp; Reports &gt; Statements &gt; Transaction History</em> and export as CSV. Handles multi-currency purchases (USD, EUR, SEK) and stock tickers.
                      </p>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="font-bold text-indigo-400 block mb-1">Zerodha (India)</span>
                      <p className="opacity-80">
                        Upload your multi-tab Excel (.xlsx) holdings report from Kite or Console. Automatically imports both Equity and Coin Mutual Funds.
                      </p>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="font-bold text-indigo-400 block mb-1">Kuvera (India - MFs)</span>
                      <p className="opacity-80">
                        Upload your Transaction Report CSV. Reads NAV, units, folio IDs, and execution history.
                      </p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-indigo-400 mb-1">Updating Stock &amp; Fund Market Prices</h4>
                    <p className="opacity-80">
                      Click the <strong>Prices</strong> button in the navigation header to fetch live quotes via the secure Netto proxy. You can also click the pencil icon (<span className="text-indigo-400 font-semibold">Edit</span>) beside any holding in the Manage table to override its market price manually.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. FIXED DEPOSITS */}
            {activeSection === 'FIXED_DEPOSITS' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-emerald-400">Fixed Deposits &amp; Term Accounts</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    Track cash lockups across traditional banks (SBAB, SEB, HDFC, SBI) with live compound interest calculation.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4" /> Auto-Accrued Valuation
                    </h4>
                    <p className="opacity-80">
                      Netto continuously accrues compound interest up to the current day based on your deposit's start date, rate, and frequency (Monthly, Quarterly, or Annual). Once a deposit reaches its maturity date, compounding halts automatically and marks the deposit as <strong>Matured</strong>.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4" /> Quick Paste from Excel / Banking Tables
                    </h4>
                    <p className="opacity-80 mb-2">
                      Instead of typing every term certificate manually, open your bank's deposit overview or Excel sheet, copy the rows, and click <strong>Quick Paste from Excel / Web</strong>.
                    </p>
                    <div className="font-mono text-[11px] p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300">
                      SBAB &nbsp;&nbsp; 1Y Fasträntekonto &nbsp;&nbsp; 100000 &nbsp;&nbsp; 3.75 &nbsp;&nbsp; SEK &nbsp;&nbsp; 2026-01-15 &nbsp;&nbsp; 2027-01-15
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. REAL ESTATE & LOANS */}
            {activeSection === 'REAL_ESTATE_LOANS' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-sky-400">Real Estate &amp; Liabilities (Mortgages)</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    Measure your actual net worth by factoring in physical properties alongside outstanding debts and amortizations.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                      <Building className="w-4 h-4" /> Real Estate Properties
                    </h4>
                    <p className="opacity-80">
                      Record apartments, houses, or land with purchase cost, acquisition month/year, and current estimated valuation. Use the inline <strong>Edit</strong> button in the Real Estate table whenever you receive an updated property appraisal.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" /> Mortgages &amp; Liabilities
                    </h4>
                    <p className="opacity-80">
                      Track original loans and remaining principal balances. Liabilities are subtracted from your total asset pool to compute true net worth. Whenever you make an amortization payment, click <strong>Edit</strong> to update your remaining balance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. SYNC & BACKUPS */}
            {activeSection === 'SYNC_BACKUP' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-indigo-400">Encrypted Backups &amp; Google Drive Sync</h3>
                  <p className="opacity-80 mt-1.5 text-sm">
                    Keep your ledger backed up across devices without giving third parties access to your data.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4" /> Google Drive AppData Sync
                    </h4>
                    <p className="opacity-80">
                      Clicking <strong>Save to Drive</strong> sends your AES-256 encrypted vault to your private Google Drive `appDataFolder`. Only the Netto app running with your passphrase can read it—it doesn't clutter your regular Google Drive files.
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <FileDown className="w-4 h-4" /> Standalone File Backups (.sqlite.enc)
                    </h4>
                    <p className="opacity-80">
                      Click <strong>Backup File</strong> anytime to download a physical copy of your encrypted vault. You can move this file to a USB stick, email it to yourself, or use it on another computer under <em>Restore from File</em>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/40 bg-slate-950/20">
          <span className="text-[11px] opacity-60">
            Netto Client-Side Architecture • Zero Tracking • AES-256 Vault
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 hover:opacity-100 transition cursor-pointer"
            >
              Close
            </button>
            {onGetStarted && (
              <button
                onClick={() => {
                  onClose();
                  onGetStarted();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition cursor-pointer"
              >
                Launch Vault <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};