import React from 'react';
import {
  ShieldCheck,
  Lock,
  Upload,
  ArrowRight,
  Globe2,
  Cpu,
  HardDrive,
  Sparkles,
  CheckCircle2,
  EyeOff,
  Layers,
} from 'lucide-react';

interface LandingPageProps {
  hasExistingVault: boolean;
  onLaunchCreateOrUnlock: () => void;
  onLaunchRestore: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  hasExistingVault,
  onLaunchCreateOrUnlock,
  onLaunchRestore,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center border-b border-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">netto</span>
          <span className="text-[11px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full">
            Zero-Knowledge Wealth Tracker
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLaunchRestore}
            className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2"
          >
            Returning User? Upload Vault
          </button>
          <button
            onClick={onLaunchCreateOrUnlock}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition"
          >
            {hasExistingVault ? 'Unlock Your Vault' : 'Launch Netto'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-14 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Track Stocks, ETFs & Fixed Deposits Across Countries in One Place
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Global Net Worth Tracking.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Zero Cloud Custody.
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
          Combine Swedish <b>Avanza</b>, Indian <b>Zerodha</b>, <b>Interactive Brokers</b>, and multi-currency{' '}
          <b>Bank Fixed Deposits</b> into a single live dashboard—powered by an AES-256 encrypted SQLite database that
          belongs strictly to you.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-8 md:p-10 space-y-8 shadow-2xl">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
              Interactive System Infographic
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white">How Netto Works Under the Hood</h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Unlike traditional apps that store your financial records on company servers, Netto executes the entire
              database engine inside your browser via WebAssembly.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
                  STEP 1 • INPUT
                </span>
                <Globe2 className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-bold text-white text-sm">Multi-Country Assets</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Import CSV exports from <b>Avanza (SEK)</b>, <b>Zerodha (INR)</b>, <b>IBKR (USD/EUR)</b>, or add
                compounding <b>Bank Fixed Deposits</b>.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">
                  STEP 2 • ENGINE
                </span>
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-white text-sm">In-Browser SQLite WASM</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your CSV files are parsed locally in RAM. A full relational <b>SQLite engine</b> computes compound
                interest and FX conversions offline.
              </p>
            </div>

            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                  STEP 3 • CRYPTO
                </span>
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white text-sm">AES-256-GCM Encryption</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your Master Passphrase derives a 256-bit key via <b>PBKDF2 (100,000 SHA-256 iterations)</b> to seal the
                raw SQLite binary into ciphertext.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                  STEP 4 • PORTABLE SYNC
                </span>
                <HardDrive className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-white text-sm">Your Drive or Local Disk</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Download your `.sqlite.enc` file or sync with 1 click to your private <b>Google Drive</b> hidden app
                folder. Resume on any device anytime.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                <EyeOff className="w-5 h-5" />
                <span>100% Client-Side (Never Seen by Netto Servers)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><b>Your Master Passphrase:</b> Stays in volatile browser RAM only.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><b>Share Quantities, Buy Prices & Net Worth:</b> Encrypted inside `.sqlite.enc`.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><b>Fixed Deposit Principals & Maturity Dates:</b> 100% local calculation.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-400 font-bold text-sm">
                <Layers className="w-5 h-5" />
                <span>Stateless Cloudflare Edge Proxy (`/api/quotes`)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                To fetch live stock prices and currency exchange rates without browser CORS blocks, your browser sends
                an <b>anonymous list of ticker symbols only</b> (e.g. `VOLV-B.ST, INFY.NS, USDSEK=X`).
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                GET /api/quotes?symbols=VOLV-B.ST,INFY.NS,AAPL
                <br />
                <span className="text-emerald-400">→ Returns market prices & FX rates. Zero user identity attached.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-3xl p-8 md:p-12 space-y-6 shadow-2xl">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Ready to Build Your Private Global Portfolio?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Proceed to initialize a brand-new AES-256 encrypted SQLite database in your browser, or upload an existing
            `.sqlite.enc` vault if you are returning.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              onClick={onLaunchCreateOrUnlock}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-7 py-4 rounded-xl shadow-xl shadow-indigo-600/30 transition text-sm"
            >
              <Lock className="w-4 h-4" />
              {hasExistingVault ? 'Proceed to Unlock Local Vault' : 'Proceed to Create Encrypted Database'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLaunchRestore}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-6 py-4 rounded-xl transition text-sm"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              Returning User? Upload / Restore Vault
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
