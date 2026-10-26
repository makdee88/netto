import React, { useEffect, useState } from 'react';
import type { Database } from 'sql.js';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  initDatabase,
  recordSnapshot,
  getProperties,
  getLiabilities,
  clearBrokerData,
} from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
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
} from 'lucide-react';

const THEME_KEY = 'netto_color_theme';
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
  const [csvSummary, setCsvSummary] = useState<CsvImportResult | null>(null);

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('SEK');
  const [fxRates, setFxRates] = useState<Record<string, number>>({
    SEK: 1,
    USD: 10.45,
    EUR: 11.35,
    INR: 0.125,
  });
  const [statusMsg, setStatusMsg] = useState<string>('Vault Locked');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const handleStepChange = (newStep: AppStep) => {
    setStep(newStep);
    sessionStorage.setItem('netto_active_step', newStep);
  };

  const handleTabChange = (tab: DashboardSubTab) => {
    setSubTab(tab);
    sessionStorage.setItem('netto_sub_tab', tab);
  };

  // 1. Initialize Theme & Supabase Auth Session
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

      if (event === 'SIGNED_IN' && currentSession) {
        handleStepChange('AUTH');
      }

      if (event === 'SIGNED_OUT' || !currentSession) {
        setDb(null);
        setPassphrase('');
        setHoldings([]);
        handleStepChange('LANDING');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const refreshHoldings = (database: Database) => {
    const stmt = database.prepare('SELECT * FROM holdings ORDER BY broker, name');
    const rows: HoldingRow[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
    stmt.free();
    setHoldings(rows);

    const totalAssets = rows.reduce((sum, h) => {
      const nativeVal =
        h.category === 'FIXED_DEPOSIT'
          ? h.principal
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
    _restoreName: string
  ) => {
    if (!session) throw new Error('Sign in required.');
    if (passInput.length < 6) throw new Error('Passphrase must be at least 6 characters.');

    if (authMode === 'RESTORE_RETURNING') {
      if (!restoreBytes) throw new Error('Select a .sqlite.enc file or pull from Google Drive first.');
      const decrypted = await decryptSqliteBytes(restoreBytes, passInput);
      const database = await initDatabase(decrypted);
      setPassphrase(passInput);
      setDb(database);
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
      setPassphrase(passInput);
      setDb(database);
      refreshHoldings(database);
      setStatusMsg(`Vault [${activeVaultName}] Unlocked`);
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

  // Floating Bar: Rendered whenever a session exists
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
        handleStepChange('AUTH');
      }}
      onLogout={async () => {
        setDb(null);
        setPassphrase('');
        await supabase.auth.signOut();
        handleStepChange('LANDING');
      }}
    />
  ) : null;

  // STEP 1: Landing Page (Always accessible if step is LANDING, logged in or not)
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

  // STEP 2A: Authentication Gate (If not signed into Supabase)
  if (!session) {
    return <AuthGateScreen isDark={isDark} onBackToLanding={() => handleStepChange('LANDING')} />;
  }

  // STEP 2B: Local Vault Password / Unlock / Create Screen
  if (step === 'AUTH' || !db) {
    return (
      <div className="relative">
        {floatingBar}
        <VaultAuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          hasExistingVault={hasExistingVault}
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
              setHasExistingVault(false);
              handleStepChange('AUTH');
            }
          }}
        />
      </div>
    );
  }

  // STEP 3: Dashboard Screen
  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {floatingBar}
      <header
        className={`max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-b ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={() => handleStepChange('LANDING')}
                className="text-xl font-bold tracking-tight cursor-pointer hover:text-indigo-400 transition"
                title="Go to Home"
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              subTab === 'OVERVIEW' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            onClick={() => handleTabChange('MANAGE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              subTab === 'MANAGE' ? 'bg-indigo-600 text-white shadow' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Manage Assets
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsMasked(!isMasked)}
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-semibold ${
              isMasked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-indigo-600 border-indigo-500 text-white'
            }`}
          >
            {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isMasked ? 'Privacy: ON' : 'Privacy: OFF'}</span>
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-lg border">
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
          <button
            onClick={() => setShowSecurityModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Privacy
          </button>
          <button
            onClick={() => setShowPassModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
          </button>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className="border rounded-lg px-3 py-1.5 text-xs font-semibold bg-transparent"
          >
            <option value="SEK">SEK (kr)</option>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <button
            onClick={async () => {
              const symbols = holdings
                .filter((h) => h.category === 'EQUITY')
                .map((h) => h.symbol);
              const vaultRes = db.exec("SELECT value FROM app_config WHERE key = 'vault_id'");
              const vaultId = (vaultRes[0]?.values[0]?.[0] as string) || 'anon';
              setStatusMsg('Fetching anonymous quotes via Cloudflare Edge...');
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
                setStatusMsg(
                  `Encrypting & uploading [netto_vault_${activeVaultName}.sqlite.enc]...`
                );
                const enc = await encryptSqliteBytes(db.export(), passphrase);
                setStatusMsg(await syncToGoogleDrive(token, enc, activeVaultName));
              })
            }
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Save to Drive
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
                  `Imported ${summary.newTransactionsAdded} txns • ${summary.holdingsUpdated} holdings`
                );
                setCsvSummary(summary);
              })
            }
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