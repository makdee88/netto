import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  Cloud,
  FileSpreadsheet,
  Coins,
  ArrowRight,
  Sun,
  Moon,
  Github,
  Heart,
  Mail,
  Globe,
  CheckCircle2,
  FileText,
  KeyRound,
  EyeOff,
  X,
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
  const isDark = theme === 'dark';
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | null>(null);

  // Direct hash routing for Google Cloud Console verification (/#privacy, /#terms)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#privacy') setActiveLegalModal('privacy');
      else if (hash === '#terms') setActiveLegalModal('terms');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const closeLegalModal = () => {
    setActiveLegalModal(null);
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
    }
  };

  const features = [
    {
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      title: 'Zero-Knowledge AES-256',
      description:
        'Your master passphrase encrypts the entire SQLite ledger client-side using PBKDF2 (100,000 rounds) and AES-256-GCM. Plain-text data never leaves your browser.',
    },
    {
      icon: <Cloud className="w-5 h-5 text-indigo-400" />,
      title: 'Google Drive AppData Sync',
      description:
        'Sync encrypted vault snapshots directly to Google Drive’s private AppData space. Isolated from other files and accessible only by you.',
    },
    {
      icon: <Database className="w-5 h-5 text-sky-400" />,
      title: 'Multi-Vault Isolation',
      description:
        'Separate distinct financial profiles—such as personal, family, and investments—into isolated encrypted vaults with unique passphrases.',
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5 text-teal-400" />,
      title: 'Automated CSV Parsers',
      description:
        'Import portfolios directly from broker CSV exports (Avanza, Zerodha, and more) with auto-deduplication and FX conversion.',
    },
    {
      icon: <EyeOff className="w-5 h-5 text-amber-400" />,
      title: 'Privacy Screening Mode',
      description:
        'Review balances in public or over screen-shares with real-time numeric masking and confidential overview states.',
    },
    {
      icon: <Coins className="w-5 h-5 text-rose-400" />,
      title: 'Multi-Currency & Net Worth',
      description:
        'Consolidate equities, fixed deposits, real estate, and liabilities across SEK, EUR, USD, and INR with real-time exchange rates.',
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Navigation */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          isDark
            ? 'bg-slate-950/80 border-slate-800/80'
            : 'bg-white/80 border-slate-200'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">netto</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              v2.0 Beta
            </span>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-5 text-xs font-semibold opacity-80">
              <a href="#features" className="hover:opacity-100 transition">
                Features
              </a>
              <a href="#architecture" className="hover:opacity-100 transition">
                Architecture
              </a>
              <button
                onClick={() => setActiveLegalModal('privacy')}
                className="hover:opacity-100 transition"
              >
                Privacy Policy
              </button>
              <a href="#support" className="hover:opacity-100 transition">
                Support
              </a>
            </nav>

            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition ${
                isDark
                  ? 'border-slate-800 hover:bg-slate-900 text-yellow-400'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onLaunchCreateOrUnlock}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition"
            >
              <span>{hasExistingVault ? 'Unlock Vault' : 'Open Vault'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-6 bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Local-First Private Asset Management</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight sm:leading-tight mb-6">
          Total visibility into your net worth.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
            Zero cloud exposure.
          </span>
        </h1>

        <p
          className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          Netto pairs a local encrypted SQLite database running in your browser with optional,
          private Google Drive AppData sync. No analytics trackers, no backend database storing
          your finances, and no third-party data profiling.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onLaunchCreateOrUnlock}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition"
          >
            <span>{hasExistingVault ? 'Unlock Existing Vault' : 'Create Free Vault'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onLaunchRestore}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl border font-bold text-sm transition hover:scale-[1.02] active:scale-[0.98] ${
              isDark
                ? 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
            }`}
          >
            <span>Restore Backup</span>
          </button>
        </div>
      </section>

      {/* Symmetric Feature Grid */}
      <section id="features" className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
            Engineered for Sovereign Privacy
          </h2>
          <p className={`text-xs sm:text-sm max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Every architectural choice puts data ownership and verifiable encryption first.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className={`flex flex-col justify-between p-6 rounded-3xl border transition shadow-sm hover:shadow-md ${
                isDark
                  ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-5 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800'
                      : 'bg-slate-50 border-slate-200 shadow-inner'
                  }`}
                >
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold mb-2.5 tracking-tight">{feat.title}</h3>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {feat.description}
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-dashed opacity-40 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Client-Side Only
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture Verification Breakdown */}
      <section
        id="architecture"
        className={`px-6 py-16 border-y ${
          isDark ? 'bg-slate-900/30 border-slate-800/80' : 'bg-slate-100/60 border-slate-200'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Zero Data Access Guarantee
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3 mb-2">
              How Google Drive Synchronization Works
            </h2>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Netto requests strictly scoped access to maintain zero awareness of your file contents.
            </p>
          </div>

          <div
            className={`p-6 sm:p-8 rounded-3xl border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Scope: drive.appdata only</h4>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Netto requests access solely to its own hidden, sandboxed application directory in
                  your Google Drive. It cannot list, inspect, or modify your personal documents,
                  photos, or folders.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Encrypted Before Transmission</h4>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  The binary payload transferred to Google Drive is an AES-256-GCM ciphertext blob.
                  Neither Google, Supabase, nor the application developers have access to your
                  passphrase or encryption keys.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Instant Revocation</h4>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  You can revoke Netto’s Google Drive permission at any time directly through your{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300"
                  >
                    Google Account Security Settings
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support / Sponsoring Section */}
      <section id="support" className="px-6 py-16 max-w-4xl mx-auto w-full text-center">
        <div className="p-8 rounded-3xl border relative overflow-hidden bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent border-indigo-500/20">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-400 mb-3">
            <Heart className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Support Netto Development</h2>
          <p className={`text-xs sm:text-sm max-w-md mx-auto mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Netto is open-source software built and maintained by Mainak Bhattacharya. If it brings
            value to your financial workflow, consider sponsoring the project on GitHub.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/makdee88/netto"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition"
            >
              <Github className="w-4 h-4 fill-current" />
              <span>View Source on GitHub</span>
            </a>
            <a
              href="https://makdee.713130.xyz/wordpress/"
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold text-xs transition ${
                isDark
                  ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200'
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Developer Website</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer & Direct Links for Google Verification */}
      <footer
        className={`mt-auto border-t text-xs py-10 px-6 ${
          isDark ? 'border-slate-800/80 bg-slate-950 text-slate-500' : 'border-slate-200 bg-white text-slate-600'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Netto Personal Finance</span>
            </div>
            <p className="text-[11px] opacity-75">
              Developed by{' '}
              <a
                href="https://makdee.713130.xyz/wordpress/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-400 hover:text-indigo-400 transition underline underline-offset-2"
              >
                Mainak Bhattacharya
              </a>{' '}
              • Open Source Client-First Software
            </p>
          </div>

          {/* Verification & Legal Direct Links */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium">
            <button
              onClick={() => setActiveLegalModal('privacy')}
              className="hover:text-indigo-400 transition underline underline-offset-4"
              id="privacy"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveLegalModal('terms')}
              className="hover:text-indigo-400 transition underline underline-offset-4"
              id="terms"
            >
              Terms of Service
            </button>
            <a
              href="mailto:m4mainak@gmail.com"
              className="flex items-center gap-1 hover:text-indigo-400 transition"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact</span>
            </a>
            <a
              href="https://github.com/makdee88/netto"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-indigo-400 transition"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Repository</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Legal & Privacy Policy Modal for Google Verification */}
      {activeLegalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`max-w-2xl w-full max-h-[85vh] flex flex-col border rounded-3xl p-6 sm:p-8 shadow-2xl relative ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/40">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">
                  {activeLegalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                </h3>
              </div>
              <button
                onClick={closeLegalModal}
                className="p-1.5 rounded-xl border border-transparent hover:border-slate-700 opacity-70 hover:opacity-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 text-xs leading-relaxed text-slate-400 pr-2">
              {activeLegalModal === 'privacy' ? (
                <>
                  <p className="font-semibold text-slate-200">
                    Last Updated: October 2026 • Effective Date: October 2026
                  </p>
                  <p>
                    Netto is an open-source, local-first asset management tool developed by{' '}
                    <strong className="text-slate-200">Mainak Bhattacharya</strong> (
                    <a
                      href="https://github.com/makdee88/netto"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      github.com/makdee88/netto
                    </a>
                    ). This Privacy Policy outlines how user data and Google user data are handled.
                  </p>

                  <h4 className="font-bold text-slate-200 text-sm pt-2">1. No Central Data Collection</h4>
                  <p>
                    Netto operates client-side inside your browser. The application maintains no remote
                    database servers collecting, processing, or tracking your personal financial records,
                    transaction histories, account balances, or net worth values.
                  </p>

                  <h4 className="font-bold text-slate-200 text-sm pt-2">2. Google User Data Policy & Scopes</h4>
                  <p>
                    When authenticating via Google or backing up to Google Drive, Netto requests access to:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <strong className="text-slate-300">userinfo.email & userinfo.profile:</strong> Used solely to establish your local session identifier and distinguish vault directories.
                    </li>
                    <li>
                      <strong className="text-slate-300">https://www.googleapis.com/auth/drive.appdata:</strong> Used solely to upload and download your own encrypted database snapshots (<code>netto_vault_*.sqlite.enc</code>) to your private Google Drive application folder.
                    </li>
                  </ul>
                  <p>
                    Netto does not read, modify, or transmit any Google Drive files outside of its own hidden AppData folder. We never sell, share, or transfer Google user data to third parties, nor do we use it for advertising purposes.
                  </p>

                  <h4 className="font-bold text-slate-200 text-sm pt-2">3. End-to-End Client Encryption</h4>
                  <p>
                    All database records are processed in memory using SQLite (via WebAssembly) and encrypted using AES-256-GCM prior to being saved in browser <code>localStorage</code> or synchronized with Google Drive. Your passphrase is never sent over any network.
                  </p>

                  <h4 className="font-bold text-slate-200 text-sm pt-2">4. Data Deletion & Revocation</h4>
                  <p>
                    You retain complete control of your data. You can delete your local encrypted cache at any time via the session switcher, and you can revoke Google OAuth permissions at any time via{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      Google Security Settings
                    </a>
                    .
                  </p>

                  <h4 className="font-bold text-slate-200 text-sm pt-2">5. Developer Contact</h4>
                  <p>
                    For questions, security disclosures, or verification inquiries:
                    <br />
                    <span className="font-medium text-slate-200">Mainak Bhattacharya</span> —{' '}
                    <a href="mailto:m4mainak@gmail.com" className="text-indigo-400 underline">
                      m4mainak@gmail.com
                    </a>
                    <br />
                    Personal Website:{' '}
                    <a
                      href="https://makdee.713130.xyz/wordpress/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      https://makdee.713130.xyz/wordpress/
                    </a>
                    <br />
                    Source Code:{' '}
                    <a
                      href="https://github.com/makdee88/netto"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      https://github.com/makdee88/netto
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-200">Last Updated: October 2026</p>
                  <h4 className="font-bold text-slate-200 text-sm">1. Terms of Use</h4>
                  <p>
                    Netto is open-source software provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;
                    basis without warranty of any kind. It is a client-side personal financial aggregation tool,
                    not a registered investment advisor or broker.
                  </p>
                  <h4 className="font-bold text-slate-200 text-sm pt-2">2. Passphrase Responsibility</h4>
                  <p>
                    Because Netto utilizes zero-knowledge client-side encryption, lost passphrases cannot be
                    recovered by the developer or any automated mechanism. Users are solely responsible for maintaining
                    secure backups of their encryption passphrases.
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/40 flex justify-end">
              <button
                onClick={closeLegalModal}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};