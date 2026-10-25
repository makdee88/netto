import React, { useEffect, useState } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, recordSnapshot, getProperties, getLiabilities } from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
import { syncToGoogleDrive, loadFromGoogleDrive } from './sync/googleDrive';
import { BrokerType, CsvImportResult, CurrencyCode, HoldingRow } from './types';
import { LandingPage } from './components/LandingPage';
import { VaultAuthScreen, AuthMode } from './components/VaultAuthScreen';
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
} from 'lucide-react';

const STORAGE_KEY = 'netto_encrypted_vault_v2';
const THEME_KEY = 'netto_color_theme';
const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

type AppStep = 'LANDING' | 'AUTH' | 'DASHBOARD';
type DashboardSubTab = 'OVERVIEW' | 'MANAGE';

export default function App() {
  const [step, setStep] = useState<AppStep>(() => {
    return (sessionStorage.getItem('netto_active_step') as AppStep) || (localStorage.getItem(STORAGE_KEY) ? 'AUTH' : 'LANDING');
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

  useEffect(() => {
    const vaultExists = Boolean(localStorage.getItem(STORAGE_KEY));
    setHasExistingVault(vaultExists);
    const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);
  }, []);

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
    localStorage.setItem(STORAGE_KEY, uint8ToBase64(encrypted));
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
    if (passInput.length < 6) throw new Error('Passphrase must be at least 6 characters.');

    if (authMode === 'RESTORE_RETURNING') {
      if (!restoreBytes) throw new Error('Select a .sqlite.enc file or pull from Google Drive first.');
      const decrypted = await decryptSqliteBytes(restoreBytes, passInput);
      const database = await initDatabase(decrypted);
      setPassphrase(passInput);
      setDb(database);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg(`Restored & Unlocked ${restoreName || 'Vault'}`);
      handleStepChange('DASHBOARD');
      return;
    }

    const savedBase64 = localStorage.getItem(STORAGE_KEY);
    if (savedBase64 && hasExistingVault) {
      const decrypted = await decryptSqliteBytes(base64ToUint8(savedBase64), passInput);
      const database = await initDatabase(decrypted);
      setPassphrase(passInput);
      setDb(database);
      refreshHoldings(database);
      setStatusMsg('Netto Vault Decrypted & Unlocked (AES-256-GCM)');
      handleStepChange('DASHBOARD');
    } else {
      if (passInput !== passConfirm) throw new Error('Passphrases do not match.');
      const database = await initDatabase();
      setPassphrase(passInput);
      setDb(database);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg('New Encrypted Netto Vault Created!');
      handleStepChange('DASHBOARD');
    }
  };

  const handleUpdatePassphrase = async (oldPass: string, newPass: string, confirmPass: string): Promise<string> => {
    if (oldPass !== passphrase) throw new Error('Current passphrase does not match active session.');
    if (newPass.length < 6) throw new Error('New passphrase must be at least 6 characters.');
    if (newPass !== confirmPass) throw new Error('New passphrases do not match.');
    if (!db) throw new Error('Database not initialized.');

    const newlyEncrypted = await encryptSqliteBytes(db.export(), newPass);
    localStorage.setItem(STORAGE_KEY, uint8ToBase64(newlyEncrypted));
    setPassphrase(newPass);

    if (googleToken) {
      await syncToGoogleDrive(googleToken, newlyEncrypted);
      return 'Passphrase updated & re-encrypted on Local Storage + Google Drive!';
    }
    return 'Passphrase updated and vault re-encrypted locally!';
  };

  if (step === 'LANDING') {
    return (
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
    );
  }

  if (step === 'AUTH' || !db) {
    return (
      <VaultAuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        hasExistingVault={hasExistingVault}
        onBackToLanding={() => handleStepChange('LANDING')}
        onUnlockOrCreate={handleUnlockOrCreate}
        onFetchGoogleDriveVault={(onLoaded) =>
          withGoogleAuth(async (token) => {
            const bytes = await loadFromGoogleDrive(token);
            if (bytes) onLoaded(bytes);
          })
        }
        onResetLocalCache={() => {
          if (confirm('Clear cached vault from this browser? Ensure you have your backup!')) {
            localStorage.removeItem(STORAGE_KEY);
            setHasExistingVault(false);
            handleStepChange('LANDING');
          }
        }}
      />
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
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
                AES-256 Unlocked
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
            title={isMasked ? 'Reveal Values (Privacy Mode ON)' : 'Mask Values (Privacy Mode OFF)'}
          >
            {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMasked ? 'Masked' : 'Visible'}</span>
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
                setStatusMsg('Encrypting & uploading to Google Drive...');
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

      <main className="max-w-7xl mx-auto p-6">
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