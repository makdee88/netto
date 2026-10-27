import React, { useEffect, useState, useCallback } from 'react';
import type { Database } from 'sql.js';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  initSectorTable,
  initDatabase,
  recordSnapshot,
  getProperties,
  getLiabilities,
  clearBrokerData,
  updatePropertyValuation,
  updateLiabilityBalance,
  updateHoldingValuation,
  refreshFdHoldingsValuations,
} from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
  downloadEncryptedBlob,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
import { saveBulkFdsToDb } from './parsers/fdImporter';
import { syncToGoogleDrive, loadFromGoogleDrive } from './sync/googleDrive';
import { CsvImportResult, CurrencyCode, HoldingRow, AuthMode } from './types';

import { LandingPage } from './components/LandingPage';
import { VaultAuthScreen } from './components/VaultAuthScreen';
import { AuthGateScreen } from './components/AuthGateScreen';
import { FloatingVaultBar } from './components/FloatingVaultBar';
import { OverviewTab } from './components/OverviewTab';
import { ManageAssetsTab } from './components/ManageAssetsTab';
import { PrivacyArchitectureModal } from './components/PrivacyArchitectureModal';
import { ChangePassphraseModal } from './components/ChangePassphraseModal';
import { CsvImportSummaryModal } from './components/CsvImportSummaryModal';
import { HowToUseModal } from './components/HowToUseModal';
import { useVaultManager, getVaultListKey } from './hooks/useVaultManager';

import {
  ShieldCheck,
  CloudUpload,
  RefreshCw,
  Info,
  KeyRound,
  Sun,
  Moon,
  LayoutDashboard,
  PlusCircle,
  Eye,
  EyeOff,
  FileDown,
  Lock,
  CheckCircle,
  BookOpen,
} from 'lucide-react';

const THEME_KEY = 'netto_color_theme';
const GDRIVE_TOKEN_KEY = 'netto_gdrive_token';
const SESSION_PASS_PREFIX = 'netto_active_pass_';
const GOOGLE_CLIENT_ID =
  ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) ||
  'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

type AppStep = 'LANDING' | 'AUTH' | 'DASHBOARD';
type DashboardSubTab = 'OVERVIEW' | 'MANAGE';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  const {
    vaultList,
    setVaultList,
    activeVaultName,
    setActiveVaultName,
    hasExistingVault,
    setHasExistingVault,
    activeStorageKey,
    createVaultSlot,
    deleteVaultSlot,
  } = useVaultManager(session);

  const [step, setStep] = useState<AppStep>(() => {
    return (sessionStorage.getItem('netto_active_step') as AppStep) || 'LANDING';
  });
  const [subTab, setSubTab] = useState<DashboardSubTab>(() => {
    return (sessionStorage.getItem('netto_sub_tab') as DashboardSubTab) || 'OVERVIEW';
  });
  const [authMode, setAuthMode] = useState<AuthMode>('CREATE_OR_UNLOCK');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isMasked, setIsMasked] = useState<boolean>(true);

  const [db, setDb] = useState<Database | null>(null);
  const [passphrase, setPassphrase] = useState<string>('');
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showPassModal, setShowPassModal] = useState<boolean>(false);
  const [showHowToUseModal, setShowHowToUseModal] = useState<boolean>(false);
  const [csvSummary, setCsvSummary] = useState<CsvImportResult | null>(null);

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('SEK');
  const [fxRates, setFxRates] = useState<Record<string, number>>({
    SEK: 1,
    USD: 10.45,
    EUR: 11.35,
    INR: 0.125,
  });
  const [statusMsg, setStatusMsg] = useState<string>('Vault Ready');
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return sessionStorage.getItem(GDRIVE_TOKEN_KEY);
  });

  const handleStepChange = (newStep: AppStep) => {
    setStep(newStep);
    sessionStorage.setItem('netto_active_step', newStep);
  };

  const handleTabChange = (tab: DashboardSubTab) => {
    setSubTab(tab);
    sessionStorage.setItem('netto_sub_tab', tab);
  };

  const refreshHoldings = useCallback(
    (database: Database) => {
      try {
        refreshFdHoldingsValuations(database);

        const stmt = database.prepare('SELECT * FROM holdings ORDER BY broker, name');
        const rows: HoldingRow[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
        stmt.free();
        setHoldings(rows);

        const totalAssets = rows.reduce((sum, h) => {
          const nativeVal =
            h.category === 'FIXED_DEPOSIT'
              ? h.market_price > 0
                ? h.market_price
                : h.principal
              : h.category === 'PENSION'
              ? h.market_price > 0
                ? h.market_price
                : h.principal || 0
              : h.quantity * (h.market_price > 0 ? h.market_price : h.avg_price);
          return sum + (nativeVal * (fxRates[h.currency] || 1)) / (fxRates[baseCurrency] || 1);
        }, 0);

        const properties = getProperties(database);
        const totalProps = properties.reduce(
          (sum, p) => sum + (p.current_price * (fxRates[p.currency] || 1)) / (fxRates[baseCurrency] || 1),
          0
        );
        const liabilities = getLiabilities(database);
        const totalLiabs = liabilities.reduce(
          (sum, l) =>
            sum + (l.remaining_balance * (fxRates[l.currency] || 1)) / (fxRates[baseCurrency] || 1),
          0
        );

        recordSnapshot(database, totalAssets + totalProps, totalLiabs);
      } catch (err) {
        console.error('Error refreshing holdings:', err);
      }
    },
    [baseCurrency, fxRates]
  );

  const persistEncryptedVault = async (database: Database, activePass = passphrase) => {
    const encrypted = await encryptSqliteBytes(database.export(), activePass);
    localStorage.setItem(activeStorageKey, uint8ToBase64(encrypted));
    if (session?.user?.email) {
      const updatedList = Array.from(new Set([...vaultList, activeVaultName]));
      setVaultList(updatedList);
      localStorage.setItem(getVaultListKey(session.user.email), JSON.stringify(updatedList));
    }
    refreshHoldings(database);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);

    const isOAuthRedirect =
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('code=');

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('[Netto Auth Error]:', error);
      if (data?.session) {
        setSession(data.session);

        if (data.session.provider_token) {
          setGoogleToken(data.session.provider_token);
          sessionStorage.setItem(GDRIVE_TOKEN_KEY, data.session.provider_token);
        }

        if (isOAuthRedirect) {
          window.history.replaceState({}, document.title, window.location.pathname);
          handleStepChange('AUTH');
        }
      }
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, currentSession: Session | null) => {
      setSession(currentSession);

      if (currentSession?.provider_token) {
        setGoogleToken(currentSession.provider_token);
        sessionStorage.setItem(GDRIVE_TOKEN_KEY, currentSession.provider_token);
      }

      if (event === 'SIGNED_IN' && currentSession) {
        setStep((prev) => {
          if (prev === 'DASHBOARD') return 'DASHBOARD';
          sessionStorage.setItem('netto_active_step', 'AUTH');
          return 'AUTH';
        });
      }

      if (event === 'SIGNED_OUT' || !currentSession) {
        setDb(null);
        setPassphrase('');
        setHoldings([]);
        setGoogleToken(null);
        sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
        sessionStorage.removeItem(SESSION_PASS_PREFIX + activeVaultName);
        handleStepChange('LANDING');
      }
    });

    return () => subscription.unsubscribe();
  }, [activeVaultName]);

  useEffect(() => {
    if (!db && session && activeStorageKey) {
      const cachedPass = sessionStorage.getItem(SESSION_PASS_PREFIX + activeVaultName);
      const savedBase64 = localStorage.getItem(activeStorageKey);

      if (cachedPass && savedBase64) {
        decryptSqliteBytes(base64ToUint8(savedBase64), cachedPass)
          .then((decrypted) => initDatabase(decrypted))
          .then((database) => {
            initSectorTable(database);
            setPassphrase(cachedPass);
            setDb(database);
            refreshHoldings(database);
            setStatusMsg(`Vault [${activeVaultName}] active`);
          })
          .catch((err) => {
            console.warn('Session pass expired or invalid:', err);
            sessionStorage.removeItem(SESSION_PASS_PREFIX + activeVaultName);
          });
      }
    }
  }, [db, session, activeStorageKey, activeVaultName, refreshHoldings]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const handleExplicitLock = () => {
    setDb(null);
    setPassphrase('');
    setHoldings([]);
    sessionStorage.removeItem(SESSION_PASS_PREFIX + activeVaultName);
    setStatusMsg(`Vault [${activeVaultName}] locked`);
    handleStepChange('AUTH');
  };

  const handleSwitchVault = (newVaultName: string) => {
    if (newVaultName === activeVaultName) return;
    setDb(null);
    setPassphrase('');
    setHoldings([]);
    setActiveVaultName(newVaultName);
    sessionStorage.setItem('netto_active_vault_name', newVaultName);
    setAuthMode('CREATE_OR_UNLOCK');
    handleStepChange('AUTH');
  };

  const withGoogleAuth = async (action: (token: string) => Promise<void>) => {
    const requestFreshToken = () => {
      if (!window.google?.accounts?.oauth2) {
        alert(
          'Google Identity Services library is not loaded. Ensure accounts.google.com/gsi/client is included in index.html.'
        );
        setStatusMsg('Google Auth client unavailable');
        return;
      }

      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.appdata',
          callback: async (res: any) => {
            if (res.error) {
              console.error('Google token error:', res);
              alert(`Google Drive permission error: ${res.error_description || res.error}`);
              setStatusMsg('Google Drive access rejected');
              return;
            }
            if (res.access_token) {
              setGoogleToken(res.access_token);
              sessionStorage.setItem(GDRIVE_TOKEN_KEY, res.access_token);
              try {
                await action(res.access_token);
              } catch (innerErr: any) {
                console.error('Action failed with fresh token:', innerErr);
                alert(`Drive operation failed: ${innerErr?.message || innerErr}`);
              }
            }
          },
        });

        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        console.error('Failed to trigger Google Token Client:', err);
        alert(`Google Auth Error: ${err?.message || err}`);
      }
    };

    const token =
      googleToken ||
      session?.provider_token ||
      sessionStorage.getItem(GDRIVE_TOKEN_KEY);

    if (token) {
      try {
        await action(token);
        return;
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        if (errMsg.includes('INSUFFICIENT_PERMISSIONS') || errMsg.includes('403') || errMsg.includes('401')) {
          console.warn('Cached token lacks Drive permissions. Requesting explicit consent...', err);
          sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
          setGoogleToken(null);
          requestFreshToken();
          return;
        }
        console.error('Drive action error:', err);
        alert(`Drive error: ${errMsg}`);
        return;
      }
    }

    requestFreshToken();
  };

  const handleUnlockOrCreate = async (
    passInput: string,
    passConfirm: string,
    restoreBytes: Uint8Array | null,
    _restoreName: string
  ) => {
    if (!session) throw new Error('Sign in required.');
    if (passInput.length < 6) throw new Error('Passphrase must be at least 6 characters.');

    if (authMode === 'RESTORE_RETURNING') {
      if (!restoreBytes) throw new Error('Select a .sqlite.enc file or pull from Google Drive first.');
      const decrypted = await decryptSqliteBytes(restoreBytes, passInput);
      const database = await initDatabase(decrypted);
      initSectorTable(database);
      setPassphrase(passInput);
      setDb(database);
      sessionStorage.setItem(SESSION_PASS_PREFIX + activeVaultName, passInput);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg(`Restored [${activeVaultName}]`);
      handleStepChange('DASHBOARD');
      return;
    }

    const savedBase64 = localStorage.getItem(activeStorageKey);
    if (savedBase64 && hasExistingVault) {
      const decrypted = await decryptSqliteBytes(base64ToUint8(savedBase64), passInput);
      const database = await initDatabase(decrypted);
      initSectorTable(database);
      setPassphrase(passInput);
      setDb(database);
      sessionStorage.setItem(SESSION_PASS_PREFIX + activeVaultName, passInput);
      refreshHoldings(database);
      setStatusMsg(`Vault [${activeVaultName}] Unlocked`);
      handleStepChange('DASHBOARD');
    } else {
      if (passInput !== passConfirm) throw new Error('Passphrases do not match.');
      const database = await initDatabase();
      initSectorTable(database);
      setPassphrase(passInput);
      setDb(database);
      sessionStorage.setItem(SESSION_PASS_PREFIX + activeVaultName, passInput);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg(`New Vault [${activeVaultName}] Created!`);
      handleStepChange('DASHBOARD');
    }
  };

  const handleSignOut = async () => {
    try {
      setDb(null);
      setPassphrase('');
      setHoldings([]);
      setSession(null);
      setGoogleToken(null);
      sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_PASS_PREFIX + activeVaultName);
      sessionStorage.removeItem('netto_active_step');

      await supabase.auth.signOut({ scope: 'local' });
      handleStepChange('LANDING');
      setStatusMsg('Logged out');
    } catch (err) {
      console.error('Logout error:', err);
      handleStepChange('LANDING');
    }
  };

  const isDark = theme === 'dark';

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Initializing Netto...
      </div>
    );
  }

  const userEmail = session?.user?.email || '';
  const userFullName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : '');

  const floatingBar = session ? (
    <FloatingVaultBar
      email={userEmail}
      fullName={userFullName}
      isDark={isDark}
      activeVaultName={activeVaultName}
      vaultList={vaultList}
      onSwitchVault={handleSwitchVault}
      onCreateVaultSlot={(name) => {
        createVaultSlot(name);
        handleSwitchVault(name);
      }}
      onDeleteVaultSlot={(name) => {
        deleteVaultSlot(name);
        setDb(null);
        setPassphrase('');
        setHoldings([]);
        sessionStorage.removeItem(SESSION_PASS_PREFIX + name);
        handleStepChange('AUTH');
      }}
      onLogout={handleSignOut}
    />
  ) : null;

  if (step === 'LANDING') {
    return (
      <>
        {floatingBar}
        <LandingPage
          hasExistingVault={hasExistingVault}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLaunchCreateOrUnlock={() => {
            setAuthMode('CREATE_OR_UNLOCK');
            handleStepChange(db ? 'DASHBOARD' : 'AUTH');
          }}
          onLaunchRestore={() => {
            setAuthMode('RESTORE_RETURNING');
            handleStepChange('AUTH');
          }}
        />
      </>
    );
  }

  if (!session) {
    return <AuthGateScreen isDark={isDark} onBackToLanding={() => handleStepChange('LANDING')} />;
  }

  if (step === 'AUTH' || !db) {
    return (
      <div className="relative">
        {floatingBar}
        <VaultAuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          hasExistingVault={hasExistingVault}
          theme={theme}
          userEmail={userEmail}
          activeVaultName={activeVaultName}
          onBackToLanding={() => handleStepChange('LANDING')}
          onUnlockOrCreate={handleUnlockOrCreate}
          onFetchGoogleDriveVault={(onLoaded: (bytes: Uint8Array) => void) =>
            withGoogleAuth(async (token) => {
              const bytes = await loadFromGoogleDrive(token, activeVaultName);
              if (bytes) onLoaded(bytes);
            })
          }
          onResetLocalCache={() => {
            if (confirm(`Clear cached vault [${activeVaultName}]?`)) {
              localStorage.removeItem(activeStorageKey);
              sessionStorage.removeItem(SESSION_PASS_PREFIX + activeVaultName);
              setHasExistingVault(false);
              handleStepChange('AUTH');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {floatingBar}

      {/* Two-Line Balanced Dashboard Header */}
      <header
        className={`max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3 border-b ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white shadow-sm'
        }`}
      >
        {/* ========================================================= */}
        {/* LINE 1: Branding (Left) <---> Navigation Tabs (Right)     */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  onClick={() => handleStepChange('LANDING')}
                  className="text-lg font-bold tracking-tight cursor-pointer hover:text-indigo-400 transition"
                  title="Go to Landing Page"
                >
                  netto
                </h1>
                <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  {activeVaultName}
                </span>
              </div>
              <p className="text-[11px] opacity-70 leading-none mt-0.5">{statusMsg}</p>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-950/20 p-1 rounded-xl text-xs font-semibold border border-slate-800/40">
            <button
              onClick={() => handleTabChange('OVERVIEW')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                subTab === 'OVERVIEW' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Overview
            </button>
            <button
              onClick={() => handleTabChange('MANAGE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                subTab === 'MANAGE' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Manage Assets
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LINE 2: Action Buttons (Left) <---> Info & Controls (Right)*/}
        {/* ========================================================= */}
        <div className="w-full flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/30">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                const symbols = holdings
                  .filter((h) => h.category === 'EQUITY')
                  .map((h) => h.symbol);
                const vaultRes = db.exec("SELECT value FROM app_config WHERE key = 'vault_id'");
                const vaultId = (vaultRes[0]?.values[0]?.[0] as string) || 'anon';
                setStatusMsg('Fetching quotes...');
                try {
                  const res = await fetch(
                    `/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
                    {
                      headers: {
                        'X-Vault-Id': vaultId,
                        'X-Base-Currency': baseCurrency,
                      },
                    }
                  );
                  if (!res.ok) throw new Error();
                  const data = await res.json();
                  if (data.fxRates) setFxRates(data.fxRates);
                  if (data.quotes) {
                    db.run('BEGIN TRANSACTION');
                    for (const [sym, price] of Object.entries(data.quotes)) {
                      if (Number(price) > 0) {
                        db.run(
                          'UPDATE holdings SET market_price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?',
                          [Number(price), sym]
                        );
                      }
                    }
                    db.run('COMMIT');
                    await persistEncryptedVault(db);
                  }
                  setStatusMsg('Live market prices updated!');
                } catch {
                  setStatusMsg('Using cached prices');
                }
              }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition"
              title="Fetch latest stock quotes & exchange rates"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Prices
            </button>

            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
              className="border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold bg-transparent cursor-pointer"
              title="Display currency"
            >
              <option value="SEK">SEK (kr)</option>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>

            <button
              onClick={() =>
                withGoogleAuth(async (token) => {
                  setStatusMsg(`Syncing to Google Drive AppData...`);
                  const enc = await encryptSqliteBytes(db.export(), passphrase);
                  const msg = await syncToGoogleDrive(token, enc, activeVaultName);
                  setStatusMsg(msg);
                })
              }
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow cursor-pointer transition"
              title="Save encrypted snapshot to Google Drive AppData"
            >
              <CloudUpload className="w-3.5 h-3.5" /> Save to Drive
            </button>

            <button
              onClick={async () => {
                if (!db) return;
                const enc = await encryptSqliteBytes(db.export(), passphrase);
                downloadEncryptedBlob(enc, activeVaultName);
                setStatusMsg('Encrypted backup exported!');
              }}
              className="flex items-center gap-1.5 border border-slate-700/70 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition"
              title="Download encrypted .sqlite.enc backup to local disk"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-400" /> Backup File
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsMasked(!isMasked)}
              className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                isMasked
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
              }`}
              title="Toggle Privacy Mask (hides values for screen sharing/public)"
            >
              {isMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isMasked ? 'Privacy: ON' : 'Privacy: OFF'}</span>
            </button>

            <button
              onClick={() => setShowHowToUseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
              title="How to Use & Documentation"
            >
              <BookOpen className="w-3.5 h-3.5" /> How to Use
            </button>

            <button
              onClick={() => setShowSecurityModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-700/60 opacity-80 hover:opacity-100 hover:bg-slate-800/40 transition cursor-pointer"
              title="Zero-Knowledge Architecture details"
            >
              <Info className="w-3.5 h-3.5 text-indigo-400" /> Info
            </button>

            <button
              onClick={() => setShowPassModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-700/60 opacity-80 hover:opacity-100 hover:bg-slate-800/40 transition cursor-pointer"
              title="Update your vault passphrase"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-700/60 opacity-80 hover:opacity-100 hover:bg-slate-800/40 transition cursor-pointer"
              title="Toggle Light/Dark Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            <button
              onClick={handleExplicitLock}
              className="p-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer ml-1"
              title="Lock Vault Now"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Confirmation Banner */}
      {csvSummary && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Import successful:</strong> Added {csvSummary.newTransactionsAdded} transactions and updated {csvSummary.holdingsUpdated} holdings.
              </span>
            </div>
            <button
              onClick={() => setCsvSummary(null)}
              className="text-emerald-400 hover:underline font-bold text-[11px] ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto p-6 pb-20">
        {subTab === 'OVERVIEW' ? (
          <OverviewTab
            db={db}
            holdings={holdings}
            baseCurrency={baseCurrency}
            fxRates={fxRates}
            theme={theme}
            isMasked={isMasked}
            onGoToManage={() => handleTabChange('MANAGE')}
            onOpenPrivacyModal={() => setShowSecurityModal(true)}
          />
        ) : (
          <ManageAssetsTab
            db={db}
            holdings={holdings}
            theme={theme}
            onBackToOverview={() => handleTabChange('OVERVIEW')}
            onSaveVault={async () => {
              if (db) {
                await persistEncryptedVault(db);
              }
            }}
            onCsvImport={(file, broker) => {
              return importBrokerCsv(file, broker, db, async (summary) => {
                await persistEncryptedVault(db);
                refreshHoldings(db);
                setCsvSummary(summary);
                setStatusMsg(
                  `Imported ${summary.newTransactionsAdded} txns • ${summary.holdingsUpdated} holdings`
                );
              });
            }}
            onClearBroker={async (bName) => {
              clearBrokerData(db, bName);
              await persistEncryptedVault(db);
              refreshHoldings(db);
              setStatusMsg(`Cleared history for ${bName}`);
            }}
            onAddFD={async (fd) => {
              db.run(
                `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date)
                 VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(broker, symbol) DO UPDATE SET principal = excluded.principal`,
                [
                  fd.broker,
                  fd.symbol,
                  fd.name,
                  fd.currency,
                  fd.principal,
                  fd.interest_rate,
                  fd.compounding_freq,
                  fd.start_date,
                  fd.maturity_date,
                ]
              );
              await persistEncryptedVault(db);
              setStatusMsg(`Saved FD: ${fd.name}`);
            }}
            onAddBulkFDs={async (items) => {
              saveBulkFdsToDb(db, items);
              await persistEncryptedVault(db);
              refreshHoldings(db);
              setStatusMsg(`Bulk saved ${items.length} Fixed Deposits!`);
            }}
            onAddProperty={async (p) => {
              db.run(
                `INSERT INTO properties (name, property_type, currency, buy_price, buy_month, buy_year, current_price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  p.name,
                  p.property_type,
                  p.currency,
                  p.buy_price,
                  p.buy_month,
                  p.buy_year,
                  p.current_price,
                ]
              );
              await persistEncryptedVault(db);
              setStatusMsg(`Saved Property: ${p.name}`);
            }}
            onAddLiability={async (l) => {
              db.run(
                `INSERT INTO liabilities (name, liability_type, currency, total_loan, remaining_balance, interest_rate) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  l.name,
                  l.liability_type,
                  l.currency,
                  l.total_loan,
                  l.remaining_balance,
                  l.interest_rate,
                ]
              );
              await persistEncryptedVault(db);
              setStatusMsg(`Saved Liability: ${l.name}`);
            }}
            onAddPension={async (p: {
              broker: string;
              name: string;
              currency: CurrencyCode;
              valuation: number;
            }) => {
              db.run(
                `INSERT INTO holdings (broker, category, symbol, name, currency, quantity, avg_price, market_price, principal)
                VALUES (?, 'PENSION', ?, ?, ?, 1, ?, ?, ?)
                ON CONFLICT(broker, symbol) DO UPDATE SET market_price = excluded.market_price, updated_at = CURRENT_TIMESTAMP`,
                [
                  p.broker,
                  `PENSION_${p.broker}_${p.name}`.replace(/\s+/g, '_').toUpperCase(),
                  p.name,
                  p.currency,
                  p.valuation,
                  p.valuation,
                  p.valuation,
                ]
              );
              await persistEncryptedVault(db);
              refreshHoldings(db);
              setStatusMsg(`Saved Pension: ${p.name}`);
            }}
            onUpdatePropertyValuation={async (id, currentPrice) => {
              updatePropertyValuation(db, id, currentPrice);
              await persistEncryptedVault(db);
              setStatusMsg('Property valuation updated');
            }}
            onUpdateLiabilityBalance={async (id, remainingBalance) => {
              updateLiabilityBalance(db, id, remainingBalance);
              await persistEncryptedVault(db);
              setStatusMsg('Liability balance updated');
            }}
            onUpdateHoldingValuation={async (id, marketPrice) => {
              updateHoldingValuation(db, id, marketPrice);
              await persistEncryptedVault(db);
              setStatusMsg('Asset valuation updated');
            }}
            onDeleteHolding={async (id) => {
              db.run('DELETE FROM holdings WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Asset deleted');
            }}
            onDeleteProperty={async (id) => {
              db.run('DELETE FROM properties WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Property deleted');
            }}
            onDeleteLiability={async (id) => {
              db.run('DELETE FROM liabilities WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Liability deleted');
            }}
          />
        )}
      </main>

      {/* CSV Confirmation Modal Popup */}
      {csvSummary && (
        <CsvImportSummaryModal
          summary={csvSummary}
          isDark={isDark}
          onClose={() => setCsvSummary(null)}
        />
      )}

      {/* How To Use Guide Modal */}
      {showHowToUseModal && (
        <HowToUseModal
          isOpen={showHowToUseModal}
          onClose={() => setShowHowToUseModal(false)}
          theme={theme}
        />
      )}

      {showSecurityModal && (
        <PrivacyArchitectureModal onClose={() => setShowSecurityModal(false)} />
      )}

      {showPassModal && (
        <ChangePassphraseModal
          onClose={() => setShowPassModal(false)}
          onUpdatePassphrase={async (oldPass, newPass, confirmPass) => {
            if (oldPass !== passphrase) throw new Error('Incorrect current passphrase.');
            if (newPass.length < 6) throw new Error('Passphrase must be >= 6 chars.');
            if (newPass !== confirmPass) throw new Error('Passphrases do not match.');
            if (!db) throw new Error('No DB loaded.');
            const newlyEncrypted = await encryptSqliteBytes(db.export(), newPass);
            localStorage.setItem(activeStorageKey, uint8ToBase64(newlyEncrypted));
            setPassphrase(newPass);
            sessionStorage.setItem(SESSION_PASS_PREFIX + activeVaultName, newPass);
            if (googleToken) {
              await syncToGoogleDrive(googleToken, newlyEncrypted, activeVaultName);
            }
            return 'Passphrase updated successfully!';
          }}
        />
      )}
    </div>
  );
}