import React, { useEffect, useState } from 'react';
import type { Database } from 'sql.js';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { initDatabase, recordSnapshot, getProperties, getLiabilities, clearBrokerData } from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
import { syncToGoogleDrive, loadFromGoogleDrive } from './sync/googleDrive';
import { BrokerType, CsvImportResult, CurrencyCode, HoldingRow, AuthMode } from './types';
import { LandingPage } from './components/LandingPage';
import { VaultAuthScreen } from './components/VaultAuthScreen';
import { OverviewTab } from './components/OverviewTab';
import { ManageAssetsTab } from './components/ManageAssetsTab';
import { PrivacyArchitectureModal } from './components/PrivacyArchitectureModal';
import { ChangePassphraseModal } from './components/ChangePassphraseModal';
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
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Database as DbIcon,
  FolderPlus,
  Mail,
} from 'lucide-react';

const LEGACY_STORAGE_KEY = 'netto_encrypted_vault_v2';
const THEME_KEY = 'netto_color_theme';
const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

type AppStep = 'LANDING' | 'AUTH' | 'DASHBOARD';
type DashboardSubTab = 'OVERVIEW' | 'MANAGE';

// Helper to scope vaults per user email + vault name
const getVaultStorageKey = (userEmail: string, vaultName: string) =>
  `netto_vault_v2_${userEmail.toLowerCase().trim()}_${vaultName.trim()}`;

const getVaultListKey = (userEmail: string) =>
  `netto_vault_list_${userEmail.toLowerCase().trim()}`;

export default function App() {
  // Supabase Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginName, setLoginName] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState<boolean>(false);

  // Multi-Database State (Scoped per logged-in user)
  const [vaultList, setVaultList] = useState<string[]>(['Personal']);
  const [activeVaultName, setActiveVaultName] = useState<string>(() => {
    return sessionStorage.getItem('netto_active_vault_name') || 'Personal';
  });
  const [isCreatingNewVaultName, setIsCreatingNewVaultName] = useState<boolean>(false);
  const [newVaultNameInput, setNewVaultNameInput] = useState<string>('');

  const [step, setStep] = useState<AppStep>(() => {
    return (sessionStorage.getItem('netto_active_step') as AppStep) || 'LANDING';
  });
  const [subTab, setSubTab] = useState<DashboardSubTab>(() => {
    return (sessionStorage.getItem('netto_sub_tab') as DashboardSubTab) || 'OVERVIEW';
  });
  const [authMode, setAuthMode] = useState<AuthMode>('CREATE_OR_UNLOCK');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Privacy Mask State (Masked by default)
  const [isMasked, setIsMasked] = useState<boolean>(true);

  const [db, setDb] = useState<Database | null>(null);
  const [passphrase, setPassphrase] = useState<string>('');
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showPassModal, setShowPassModal] = useState<boolean>(false);

  const [csvSummary, setCsvSummary] = useState<CsvImportResult | null>(null);

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('SEK');
  const [fxRates, setFxRates] = useState<Record<string, number>>({ SEK: 1, USD: 10.45, EUR: 11.35, INR: 0.125 });
  const [statusMsg, setStatusMsg] = useState<string>('Vault Locked');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // 1. Initialize Theme & Supabase Session
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession && window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setStep('AUTH');
        sessionStorage.setItem('netto_active_step', 'AUTH');
      }
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
        if (!currentSession) {
          setDb(null);
          setPassphrase('');
          setHoldings([]);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load User's Database List & Check if Active Vault Exists
  useEffect(() => {
    const userEmail = session?.user?.email;
    if (!userEmail) {
      setHasExistingVault(Boolean(localStorage.getItem(LEGACY_STORAGE_KEY)));
      return;
    }

    const listKey = getVaultListKey(userEmail);
    const savedListRaw = localStorage.getItem(listKey);
    let list: string[] = savedListRaw ? JSON.parse(savedListRaw) : ['Personal'];

    // Migrate any pre-existing legacy vault into the user's "Personal" vault automatically
    const legacyVault = localStorage.getItem(LEGACY_STORAGE_KEY);
    const personalKey = getVaultStorageKey(userEmail, 'Personal');
    if (legacyVault && !localStorage.getItem(personalKey)) {
      localStorage.setItem(personalKey, legacyVault);
    }

    if (list.length === 0) list = ['Personal'];
    setVaultList(list);

    const currentVault = list.includes(activeVaultName) ? activeVaultName : list[0];
    if (currentVault !== activeVaultName) {
      setActiveVaultName(currentVault);
      sessionStorage.setItem('netto_active_vault_name', currentVault);
    }

    const activeKey = getVaultStorageKey(userEmail, currentVault);
    setHasExistingVault(Boolean(localStorage.getItem(activeKey)));
  }, [session, activeVaultName]);

  const activeStorageKey = session?.user?.email
    ? getVaultStorageKey(session.user.email, activeVaultName)
    : LEGACY_STORAGE_KEY;

  const handleStepChange = (newStep: AppStep) => {
    setStep(newStep);
    sessionStorage.setItem('netto_active_step', newStep);
  };

  const handleTabChange = (tab: DashboardSubTab) => {
    setSubTab(tab);
    sessionStorage.setItem('netto_sub_tab', tab);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
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

  const handleCreateNewVaultSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newVaultNameInput.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleaned || !session?.user?.email) return;

    const updatedList = Array.from(new Set([...vaultList, cleaned]));
    setVaultList(updatedList);
    localStorage.setItem(getVaultListKey(session.user.email), JSON.stringify(updatedList));

    setNewVaultNameInput('');
    setIsCreatingNewVaultName(false);
    handleSwitchVault(cleaned);
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: loginName,
        },
      },
    });

    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  const refreshHoldings = (database: Database) => {
    const stmt = database.prepare('SELECT * FROM holdings ORDER BY broker, name');
    const rows: HoldingRow[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
    stmt.free();
    setHoldings(rows);

    const totalAssets = rows.reduce((sum, h) => {
      const nativeVal = h.category === 'FIXED_DEPOSIT' ? h.principal : h.quantity * (h.market_price > 0 ? h.market_price : h.avg_price);
      const inSek = nativeVal * (fxRates[h.currency] || 1);
      return sum + inSek / (fxRates[baseCurrency] || 1);
    }, 0);

    const properties = getProperties(database);
    const totalProps = properties.reduce((sum, p) => {
      const inSek = p.current_price * (fxRates[p.currency] || 1);
      return sum + inSek / (fxRates[baseCurrency] || 1);
    }, 0);

    const liabilities = getLiabilities(database);
    const totalLiabs = liabilities.reduce((sum, l) => {
      const inSek = l.remaining_balance * (fxRates[l.currency] || 1);
      return sum + inSek / (fxRates[baseCurrency] || 1);
    }, 0);

    recordSnapshot(database, totalAssets + totalProps, totalLiabs);
  };

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

  const withGoogleAuth = (action: (token: string) => Promise<void>) => {
    if (googleToken) {
      action(googleToken);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setStatusMsg('Google Auth library not ready');
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: async (res) => {
        if (res.access_token) {
          setGoogleToken(res.access_token);
          await action(res.access_token);
        }
      },
    });
    client.requestAccessToken();
  };

  const handleUnlockOrCreate = async (
    passInput: string,
    passConfirm: string,
    restoreBytes: Uint8Array | null,
    restoreName: string
  ) => {
    if (!session) throw new Error('You must be logged in to unlock or create a database.');
    if (passInput.length < 6) throw new Error('Passphrase must be at least 6 characters.');

    if (authMode === 'RESTORE_RETURNING') {
      if (!restoreBytes) throw new Error('Select a .sqlite.enc file or pull from Google Drive first.');
      const decrypted = await decryptSqliteBytes(restoreBytes, passInput);
      const database = await initDatabase(decrypted);
      setPassphrase(passInput);
      setDb(database);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg(`Restored & Unlocked [${activeVaultName}]`);
      handleStepChange('DASHBOARD');
      return;
    }

    const savedBase64 = localStorage.getItem(activeStorageKey);
    if (savedBase64 && hasExistingVault) {
      const decrypted = await decryptSqliteBytes(base64ToUint8(savedBase64), passInput);
      const database = await initDatabase(decrypted);
      setPassphrase(passInput);
      setDb(database);
      refreshHoldings(database);
      setStatusMsg(`Vault [${activeVaultName}] Unlocked (AES-256-GCM)`);
      handleStepChange('DASHBOARD');
    } else {
      if (passInput !== passConfirm) throw new Error('Passphrases do not match.');
      const database = await initDatabase();
      setPassphrase(passInput);
      setDb(database);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg(`New Vault [${activeVaultName}] Created!`);
      handleStepChange('DASHBOARD');
    }
  };

  const handleUpdatePassphrase = async (oldPass: string, newPass: string, confirmPass: string): Promise<string> => {
    if (oldPass !== passphrase) throw new Error('Current passphrase does not match active session.');
    if (newPass.length < 6) throw new Error('New passphrase must be at least 6 characters.');
    if (newPass !== confirmPass) throw new Error('New passphrases do not match.');
    if (!db) throw new Error('Database not initialized.');

    const newlyEncrypted = await encryptSqliteBytes(db.export(), newPass);
    localStorage.setItem(activeStorageKey, uint8ToBase64(newlyEncrypted));
    setPassphrase(newPass);

    if (googleToken) {
      await syncToGoogleDrive(googleToken, newlyEncrypted);
      return `Passphrase updated & re-encrypted for [${activeVaultName}] on Local Storage + Google Drive!`;
    }
    return `Passphrase updated and vault [${activeVaultName}] re-encrypted locally!`;
  };

  const isDark = theme === 'dark';

  // Floating Login & Multi-Database Bar (Visible across all screens when logged in)
  const floatingUserBar = session ? (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-wrap items-center gap-2.5 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-xs transition ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-200'
          : 'bg-white/95 border-slate-300 text-slate-800'
      }`}
    >
      {/* Logged-In User Identity */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-700/40">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-indigo-400">{session.user.email}</span>
      </div>

      {/* Multi-Database Selector / Creator */}
      <div className="flex items-center gap-1.5">
        <DbIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="opacity-70">DB:</span>
        {!isCreatingNewVaultName ? (
          <>
            <select
              value={activeVaultName}
              onChange={(e) => handleSwitchVault(e.target.value)}
              className={`px-2 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-900'
              }`}
              title="Switch active database vault"
            >
              {vaultList.map((vName) => (
                <option key={vName} value={vName}>
                  {vName} ({session.user.email?.split('@')[0]})
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsCreatingNewVaultName(true)}
              className="p-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
              title="Create a new named database vault"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <form onSubmit={handleCreateNewVaultSlot} className="flex items-center gap-1">
            <input
              type="text"
              value={newVaultNameInput}
              onChange={(e) => setNewVaultNameInput(e.target.value)}
              placeholder="e.g. Family, ISK..."
              autoFocus
              className={`px-2 py-0.5 rounded border text-xs w-28 ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNewVaultName(false)}
              className="px-1.5 py-0.5 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Sign Out Button */}
      <button
        onClick={async () => {
          setDb(null);
          setPassphrase('');
          await supabase.auth.signOut();
          handleStepChange('LANDING');
        }}
        className="flex items-center gap-1 pl-2 border-l border-slate-700/40 text-rose-400 hover:text-rose-300 font-semibold transition"
        title="Sign out of Supabase & lock database"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Logout</span>
      </button>
    </div>
  ) : null;

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Initializing Netto...
      </div>
    );
  }

  // STEP 1: Original Landing Page Kept Intact
  if (step === 'LANDING') {
    return (
      <>
        {floatingUserBar}
        <LandingPage
          hasExistingVault={hasExistingVault}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLaunchCreateOrUnlock={() => {
            setAuthMode('CREATE_OR_UNLOCK');
            handleStepChange('AUTH');
          }}
          onLaunchRestore={() => {
            setAuthMode('RESTORE_RETURNING');
            handleStepChange('AUTH');
          }}
        />
      </>
    );
  }

  // STEP 2A: Mandatory Supabase Login Gate (if user clicked Get Started but is not logged in)
  if (!session) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Sign In Required</h2>
            </div>
            <button
              onClick={() => handleStepChange('LANDING')}
              className="text-xs opacity-70 hover:opacity-100 underline"
            >
              ← Back
            </button>
          </div>

          <p className="text-xs opacity-75 leading-relaxed">
            Please sign in with your email before creating or unlocking your encrypted SQLite database vaults.
          </p>

          {authError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-200 text-xs">
              {authError}
            </div>
          )}

          {magicLinkSent ? (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-emerald-400">
                Magic Link Sent!
              </p>
              <p className="text-xs opacity-80">
                Check <span className="font-semibold underline">{loginEmail}</span> and click the login link to continue to your vault.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="text-xs text-indigo-400 hover:underline pt-2 block mx-auto"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="John Doe"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg transition disabled:opacity-50"
              >
                {authLoading ? 'Sending Magic Link...' : 'Send Login Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // STEP 2B: Original VaultAuthScreen Kept Intact (Once Logged In)
  if (step === 'AUTH' || !db) {
    return (
      <>
        {floatingUserBar}
        <VaultAuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          hasExistingVault={hasExistingVault}
          onBackToLanding={() => handleStepChange('LANDING')}
          onUnlockOrCreate={handleUnlockOrCreate}
          onFetchGoogleDriveVault={(onLoaded: (bytes: Uint8Array) => void) =>
            withGoogleAuth(async (token) => {
              const bytes = await loadFromGoogleDrive(token);
              if (bytes) onLoaded(bytes);
            })
          }
          onResetLocalCache={() => {
            if (confirm(`Clear cached vault [${activeVaultName}] for ${session.user.email} from this browser? Ensure you have your backup!`)) {
              localStorage.removeItem(activeStorageKey);
              setHasExistingVault(false);
              handleStepChange('LANDING');
            }
          }}
        />
      </>
    );
  }

  // STEP 3: Original Dashboard Kept Intact
  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {floatingUserBar}
      <header className={`max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-b ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={() => handleStepChange('LANDING')}
                className="text-xl font-bold tracking-tight cursor-pointer hover:text-indigo-400 transition"
                title="View Landing Page"
              >
                netto
              </h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-medium">
                {activeVaultName} • AES-256 Unlocked
              </span>
            </div>
            <p className="text-xs opacity-75">{statusMsg}</p>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-950/20 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => handleTabChange('OVERVIEW')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${subTab === 'OVERVIEW' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview & Analytics
          </button>
          <button
            onClick={() => handleTabChange('MANAGE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${subTab === 'MANAGE' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Manage & Import Assets
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Privacy Mask Toggle Button */}
          <button
            onClick={() => setIsMasked(!isMasked)}
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-semibold ${
              isMasked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-indigo-600 border-indigo-500 text-white shadow'
            }`}
            title={isMasked ? 'Click to reveal hidden values' : 'Click to hide values (Privacy Mode)'}
          >
            {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isMasked ? 'Privacy Mode: ON' : 'Privacy Mode: OFF'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-700'}`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSecurityModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Privacy
          </button>
          <button
            onClick={() => setShowPassModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
          </button>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
          >
            <option value="SEK">SEK (kr)</option>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <button
            onClick={async () => {
              const symbols = holdings.filter((h) => h.category === 'EQUITY').map((h) => h.symbol);
              const vaultRes = db.exec("SELECT value FROM app_config WHERE key = 'vault_id'");
              const vaultId = (vaultRes[0]?.values[0]?.[0] as string) || 'anon';
              setStatusMsg('Fetching anonymous quotes via Cloudflare Edge...');
              try {
                const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, {
                  headers: { 'X-Vault-Id': vaultId, 'X-Base-Currency': baseCurrency },
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (data.fxRates) setFxRates(data.fxRates);
                if (data.quotes) {
                  db.run('BEGIN TRANSACTION');
                  for (const [sym, price] of Object.entries(data.quotes)) {
                    if (Number(price) > 0) {
                      db.run('UPDATE holdings SET market_price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?', [
                        Number(price),
                        sym,
                      ]);
                    }
                  }
                  db.run('COMMIT');
                  await persistEncryptedVault(db);
                }
                setStatusMsg('Live market prices & FX updated!');
              } catch {
                setStatusMsg('Using cached/CSV prices');
              }
            }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Prices
          </button>
          <button
            onClick={() =>
              withGoogleAuth(async (token) => {
                setStatusMsg(`Encrypting & uploading [${activeVaultName}] to Google Drive...`);
                const enc = await encryptSqliteBytes(db.export(), passphrase);
                setStatusMsg(await syncToGoogleDrive(token, enc));
              })
            }
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Save to Google Drive
          </button>
        </div>
      </header>

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
            onCsvImport={(file, broker) =>
              importBrokerCsv(file, broker, db, async (summary) => {
                await persistEncryptedVault(db);
                setStatusMsg(
                  `Imported ${summary.newTransactionsAdded} new txns (${summary.duplicateTransactionsSkipped} duplicates skipped) • ${summary.holdingsUpdated} holdings`
                );
                setCsvSummary(summary);
              })
            }
            onClearBroker={async (brokerName) => {
              clearBrokerData(db, brokerName);
              await persistEncryptedVault(db);
              refreshHoldings(db);
              setStatusMsg(`Cleared all transaction history & holdings for ${brokerName}`);
            }}
            onAddFD={async (fd) => {
              db.run(
                `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date)
                 VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(broker, symbol) DO UPDATE SET
                   principal = excluded.principal,
                   interest_rate = excluded.interest_rate,
                   maturity_date = excluded.maturity_date`,
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
              setStatusMsg(`Saved Fixed Deposit: ${fd.name}`);
            }}
            onAddProperty={async (p) => {
              db.run(
                `INSERT INTO properties (name, property_type, currency, buy_price, buy_month, buy_year, current_price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [p.name, p.property_type, p.currency, p.buy_price, p.buy_month, p.buy_year, p.current_price]
              );
              await persistEncryptedVault(db);
              setStatusMsg(`Saved Property: ${p.name}`);
            }}
            onAddLiability={async (l) => {
              db.run(
                `INSERT INTO liabilities (name, liability_type, currency, total_loan, remaining_balance, interest_rate) VALUES (?, ?, ?, ?, ?, ?)`,
                [l.name, l.liability_type, l.currency, l.total_loan, l.remaining_balance, l.interest_rate]
              );
              await persistEncryptedVault(db);
              setStatusMsg(`Saved Liability: ${l.name}`);
            }}
            onDeleteHolding={async (id) => {
              const res = db.exec('SELECT broker, symbol FROM holdings WHERE id = ?', [id]);
              if (res[0]?.values?.[0]) {
                const [b, s] = res[0].values[0];
                db.run('DELETE FROM transactions WHERE broker = ? AND symbol = ?', [b, s]);
              }
              db.run('DELETE FROM holdings WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Asset and its transaction history deleted');
            }}
            onDeleteProperty={async (id) => {
              db.run('DELETE FROM properties WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Property deleted successfully');
            }}
            onDeleteLiability={async (id) => {
              db.run('DELETE FROM liabilities WHERE id = ?', [id]);
              await persistEncryptedVault(db);
              setStatusMsg('Liability deleted successfully');
            }}
          />
        )}
      </main>

      {csvSummary && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`max-w-md w-full border rounded-3xl p-6 space-y-5 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold">CSV Import Successful!</h3>
                <p className="text-xs opacity-70">
                  {csvSummary.mode === 'TRANSACTIONS'
                    ? 'Transactions saved to SQLite ledger & net holdings recalculated.'
                    : 'Holdings snapshot updated in your vault.'}
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between">
                <span className="opacity-70">Broker / Platform:</span>
                <span className="font-bold text-indigo-500">{csvSummary.broker}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">CSV Rows Scanned:</span>
                <span className="font-semibold">{csvSummary.totalRowsRead} rows</span>
              </div>
              {csvSummary.mode === 'TRANSACTIONS' && (
                <>
                  <div className="flex justify-between">
                    <span className="opacity-70">New Transactions Added:</span>
                    <span className="font-bold text-emerald-500">+{csvSummary.newTransactionsAdded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Duplicates Safely Skipped:</span>
                    <span className="font-semibold opacity-80">{csvSummary.duplicateTransactionsSkipped}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-800/40">
                <span className="opacity-70 font-medium">Active Net Holdings:</span>
                <span className="font-bold text-indigo-500">{csvSummary.holdingsUpdated} assets</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCsvSummary(null)}
                className={`flex-1 py-3 rounded-xl font-semibold text-xs border transition ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 hover:bg-slate-200'}`}
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={() => {
                  setCsvSummary(null);
                  handleTabChange('OVERVIEW');
                }}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center gap-1.5 transition"
              >
                View Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showSecurityModal && <PrivacyArchitectureModal onClose={() => setShowSecurityModal(false)} />}
      {showPassModal && (
        <ChangePassphraseModal
          onClose={() => setShowPassModal(false)}
          onUpdatePassphrase={handleUpdatePassphrase}
        />
      )}
    </div>
  );
}