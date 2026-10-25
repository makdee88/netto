import React from 'react';
import {
  ShieldCheck,
  Lock,
  Upload,
  ArrowRight,
  Globe2,
  Cpu,
  Cloud,
  Sparkles,
  CheckCircle2,
  EyeOff,
  Sun,
  Moon,
} from 'lucide-react';

interface LandingPageProps {
  hasExistingVault: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onLaunchCreateOrUnlock: () => void;
  onLaunchRestore: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  hasExistingVault,
  theme,
  onToggleTheme,
  onLaunchCreateOrUnlock,
  onLaunchRestore,
}) => {
  isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <nav className={`max-w-7xl mx-auto px-6 py-5 flex justify-between items-center border-b ${isDark ? 'border-slate-900' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">netto</span>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>
            Private Wealth Tracker
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400' : 'bg-white border-slate-300 text-slate-700'}`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onLaunchRestore}
            className="text-xs font-semibold px-3 py-2 opacity-80 hover:opacity-100"
          >
            Returning User?
          </button>
          <button
            onClick={onLaunchCreateOrUnlock}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition"
          >
            {hasExistingVault ? 'Open Vault' : 'Get Started'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Track All Global Investments & Savings in One Place
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
          Your Complete Net Worth.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            No Corporate Cloud.
          </span>
        </h1>
        <p className={`max-w-2xl mx-auto text-base md:text-lg leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Seamlessly consolidate holdings from any broker worldwide and fixed-rate savings accounts across countries.
          Secured with bank-grade encryption stored exclusively in <b>your private Google Drive</b>.
        </p>
      </section>

      {/* Simple, Non-Technical Explainer Infographic */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className={`border rounded-3xl p-8 md:p-10 space-y-8 shadow-2xl ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
              Simple & Secure by Design
            </span>
            <h2 className="text-2xl md:text-3xl font-bold">How Your Privacy Is Protected</h2>
            <p className={`text-xs max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Netto has zero servers storing your financial records. Everything happens locally on your device.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className={`border rounded-2xl p-6 space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                  1. IMPORT
                </span>
                <Globe2 className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-bold text-sm">Universal Broker Imports</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Easily drop spreadsheet exports from any global investment platform or bank savings product. Data never
                leaves your browser tab.
              </p>
            </div>

            <div className={`border rounded-2xl p-6 space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                  2. LOCK
                </span>
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-sm">Your Password, Your Key</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                You choose a Master Passphrase. Netto locks your database into unreadable ciphertext. Without your
                password, nobody can open it.
              </p>
            </div>

            <div className={`border rounded-2xl p-6 space-y-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  3. SYNC
                </span>
                <Cloud className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-sm">Direct to Your Google Drive</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                With one click, your encrypted vault backs up automatically to <b>your own personal Google Drive</b>.
                Netto cannot access your other Google files.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-3xl p-8 md:p-12 space-y-6 shadow-2xl text-white">
          <h2 className="text-2xl md:text-3xl font-extrabold">Ready to Take Control of Your Net Worth?</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Takes 30 seconds to set up. Free, open, and private forever.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              onClick={onLaunchCreateOrUnlock}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-7 py-4 rounded-xl shadow-xl shadow-indigo-600/30 transition text-sm"
            >
              <Lock className="w-4 h-4" />
              {hasExistingVault ? 'Open Your Vault' : 'Create Encrypted Database'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLaunchRestore}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-6 py-4 rounded-xl transition text-sm"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              Restore from Backup
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};