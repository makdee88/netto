import React, { useEffect, useState } from 'react';
import { Database } from 'sql.js';
import {
  ShieldCheck,
  Lock,
  CloudUpload,
  CloudDownload,
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  Landmark,
  Info,
  KeyRound,
  CheckCircle2,
  ServerOff,
} from 'lucide-react';
import { initDatabase, calculateFDCurrentValue } from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
import { syncToGoogleDrive, loadFromGoogleDrive } from './sync/googleDrive';
import { BrokerType, CurrencyCode, HoldingRow } from './types';

const DEFAULT_FX_TO_SEK: Record<string, number> = {
  SEK: 1,
  USD: 10.45,
  EUR: 11.35,
  INR: 0.125,
};

const STORAGE_KEY = 'netto_encrypted_vault_v2';
const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

export default function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [passphrase, setPassphrase] = useState<string>('');
  const [passInput, setPassInput] = useState<string>('');
  const [passConfirm, setPassConfirm] = useState<string>('');
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);

  // Change Passphrase Modal State
  const [showPassModal, setShowPassModal] = useState<boolean>(false);
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [newPassConfirm, setNewPassConfirm] = useState<string>('');
  const [passChangeError, setPassChangeError] = useState<string>('');
  const [passChangeSuccess, setPassChangeSuccess] = useState<string>('');

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('SEK');
  const [fxRates, setFxRates] = useState<Record<string, number>>(DEFAULT_FX_TO_SEK);
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>('AVANZA');
  const [statusMsg, setStatusMsg] = useState<string>('Vault Locked');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const [fdForm, setFdForm] = useState({
    broker: 'SBI Bank',
    symbol: 'FD-001',
    name: '5-Yr Fixed Deposit',
    currency: 'INR' as CurrencyCode,
    principal: 500000,
    interest_rate: 7.25,
    compounding_freq: 4,
    start_date: '2025-01-15',
    maturity_date: '2030-01-15',
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setHasExistingVault(Boolean(saved));
  }, []);

  const handleVaultUnlockOrCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (passInput.length < 6) {
      setAuthError('Passphrase must be at least 6 characters.');
      return;
    }

    const savedBase64 = localStorage.getItem(STORAGE_KEY);
    try {
      if (savedBase64) {
        const encryptedBytes = base64ToUint8(savedBase64);
        const decryptedBytes = await decryptSqliteBytes(encryptedBytes, passInput);
        const database = await initDatabase(decryptedBytes);
        setPassphrase(passInput);
        setDb(database);
        refreshHoldings(database);
        setStatusMsg('Netto Vault Decrypted & Unlocked (AES-256-GCM)');
      } else {
        if (passInput !== passConfirm) {
          setAuthError('Passphrases do not match.');
          return;
        }
        const database = await initDatabase();
        setPassphrase(passInput);
        setDb(database);
        await persistEncryptedVault(database, passInput);
        setHasExistingVault(true);
        setStatusMsg('New Encrypted Netto Vault Created!');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Decryption failed. Check your passphrase.');
    }
  };

  const handleChangePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError('');
    setPassChangeSuccess('');

    if (oldPassInput !== passphrase) {
      setPassChangeError('Current passphrase does not match your active session.');
      return;
    }
    if (newPassInput.length < 6) {
      setPassChangeError('New passphrase must be at least 6 characters.');
      return;
    }
    if (newPassInput !== newPassConfirm) {
      setPassChangeError('New passphrases do not match.');
      return;
    }

    try {
      if (!db) return;
      const rawBytes = db.export();
      const newlyEncrypted = await encryptSqliteBytes(rawBytes, newPassInput);
      localStorage.setItem(STORAGE_KEY, uint8ToBase64(newlyEncrypted));
      setPassphrase(newPassInput);
      setPassChangeSuccess('Passphrase updated and vault re-encrypted locally!');

      if (googleToken) {
        await syncToGoogleDrive(googleToken, newlyEncrypted);
        setPassChangeSuccess('Passphrase updated & re-encrypted on Local Storage + Google Drive!');
      }

      setTimeout(() => {
        setShowPassModal(false);
        setOldPassInput('');
        setNewPassInput('');
        setNewPassConfirm('');
        setPassChangeSuccess('');
      }, 2200);
    } catch (err: any) {
      setPassChangeError(err.message || 'Failed to re-encrypt vault.');
    }
  };

  const persistEncryptedVault = async (database: Database, activePass = passphrase) => {
    const rawBytes = database.export();
    const encrypted = await encryptSqliteBytes(rawBytes, activePass);
    localStorage.setItem(STORAGE_KEY, uint8ToBase64(encrypted));
    refreshHoldings(database);
  };

  const refreshHoldings = (database: Database) => {
    const stmt = database.prepare('SELECT * FROM holdings ORDER BY broker, name');
    const rows: HoldingRow[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
    stmt.free();
    setHoldings(rows);
  };

  const convertToBase = (amount: number, fromCurrency: string): number => {
    const inSek = amount * (fxRates[fromCurrency] || 1);
    return inSek / (fxRates[baseCurrency] || 1);
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

  const handleDriveBackup = () => {
    if (!db) return;
    withGoogleAuth(async (token) => {
      setStatusMsg('Encrypting & uploading to Google Drive...');
      const encryptedBytes = await encryptSqliteBytes(db.export(), passphrase);
      const msg = await syncToGoogleDrive(token, encryptedBytes);
      setStatusMsg(msg);
    });
  };

  const handleDriveRestore = () => {
    withGoogleAuth(async (token) => {
      setStatusMsg('Downloading encrypted vault from Google Drive...');
      const encryptedBytes = await loadFromGoogleDrive(token);
      if (!encryptedBytes) {
        setStatusMsg('No vault found in Google Drive yet.');
        return;
      }
      try {
        const decrypted = await decryptSqliteBytes(encryptedBytes, passphrase);
        const restoredDb = await initDatabase(decrypted);
        setDb(restoredDb);
        await persistEncryptedVault(restoredDb, passphrase);
        setStatusMsg('Restored & Decrypted Netto Vault from Google Drive!');
      } catch {
        setStatusMsg('Drive file uses a different passphrase than current session.');
      }
    });
  };

 const downloadEncryptedFile = async () => {
    if (!db) return;
    const encrypted = await encryptSqliteBytes(db.export(), passphrase);
    const blob = new Blob([encrypted.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `netto_${new Date().toISOString().slice(0, 10)}.sqlite.enc`;
    a.click();
    setStatusMsg('Downloaded AES-256 Encrypted .sqlite.enc backup');
  };

  const uploadEncryptedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const encrypted = new Uint8Array(reader.result as ArrayBuffer);
        const decrypted = await decryptSqliteBytes(encrypted, passphrase);
        const newDb = await initDatabase(decrypted);
        setDb(newDb);
        await persistEncryptedVault(newDb, passphrase);
        setStatusMsg(`Decrypted & loaded ${file.name}`);
      } catch {
        setStatusMsg('Failed to decrypt uploaded file with current passphrase.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    importBrokerCsv(file, selectedBroker, db, async (count) => {
      await persistEncryptedVault(db);
      setStatusMsg(`Upserted ${count} holdings from ${selectedBroker}`);
    });
  };

  const handleAddFD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    db.run(
      `INSERT INTO holdings (broker, category, symbol, name, currency, principal, interest_rate, compounding_freq, start_date, maturity_date)
       VALUES (?, 'FIXED_DEPOSIT', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(broker, symbol) DO UPDATE SET
         principal = excluded.principal,
         interest_rate = excluded.interest_rate,
         maturity_date = excluded.maturity_date`,
      [
        fdForm.broker,
        fdForm.symbol,
        fdForm.name,
        fdForm.currency,
        fdForm.principal,
        fdForm.interest_rate,
        fdForm.compounding_freq,
        fdForm.start_date,
        fdForm.maturity_date,
      ]
    );
    await persistEncryptedVault(db);
    setStatusMsg(`Saved Fixed Deposit: ${fdForm.name}`);
  };

  const syncLivePrices = async () => {
    if (!db) return;
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
          db.run('UPDATE holdings SET market_price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?', [
            Number(price),
            sym,
          ]);
        }
        db.run('COMMIT');
        await persistEncryptedVault(db);
      }
      setStatusMsg('Live market prices & FX updated!');
    } catch {
      setStatusMsg('Using cached/CSV prices');
    }
  };

  // --- SCREEN 1: FIRST-TIME ENCRYPTION SETUP OR VAULT UNLOCK ---
  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Netto Vault</h1>
              <p className="text-xs text-slate-400">Zero-Knowledge AES-256-GCM Encrypted SQLite</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" /> How Netto Protects Your Financial Privacy:
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your portfolio lives inside a private <b>SQLite database</b> directly in your browser. Your Master
              Passphrase derives a <b>256-bit AES key</b> via PBKDF2 (100,000 iterations). Neither our servers nor
              Google Drive ever see your passphrase or unencrypted holdings.
            </p>
          </div>

          <form onSubmit={handleVaultUnlockOrCreate} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">
                {hasExistingVault ? 'Enter Master Passphrase to Unlock' : 'Create Master Encryption Passphrase'}
              </label>
              <input
                type="password"
                required
                placeholder="Enter strong passphrase..."
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {!hasExistingVault && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">
                  Confirm Master Passphrase
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm passphrase..."
                  value={passConfirm}
                  onChange={(e) => setPassConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {authError && <p className="text-xs text-rose-400 font-medium">{authError}</p>}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {hasExistingVault ? 'Decrypt & Open Netto' : 'Initialize Encrypted Netto Vault'}
            </button>
          </form>

          {hasExistingVault && (
            <button
              onClick={() => {
                if (confirm('Reset local browser storage? Make sure you have your .sqlite.enc or Drive backup!')) {
                  localStorage.removeItem(STORAGE_KEY);
                  setHasExistingVault(false);
                }
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Reset local cache / Start fresh vault
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalNetWorth = holdings.reduce((sum, h) => {
    const nativeVal = h.category === 'FIXED_DEPOSIT' ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
    return sum + convertToBase(nativeVal, h.currency);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Navigation & Sync Bar */}
      <header className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">netto</h1>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                AES-256 Unlocked
              </span>
            </div>
            <p className="text-xs text-slate-400">{statusMsg}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSecurityModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" /> Privacy Architecture
          </button>

          <button
            onClick={() => setShowPassModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Passphrase
          </button>

          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            <option value="SEK">Base: SEK (kr)</option>
            <option value="INR">Base: INR (₹)</option>
            <option value="USD">Base: USD ($)</option>
            <option value="EUR">Base: EUR (€)</option>
          </select>

          <button
            onClick={syncLivePrices}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Live Prices
          </button>

          <button
            onClick={handleDriveBackup}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <CloudUpload className="w-3.5 h-3.5" /> Save to Drive
          </button>

          <button
            onClick={handleDriveRestore}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <CloudDownload className="w-3.5 h-3.5" /> Load Drive
          </button>

          <button
            onClick={downloadEncryptedFile}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> .sqlite.enc
          </button>

          <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Load File
            <input type="file" accept=".enc,.sqlite" onChange={uploadEncryptedFile} className="hidden" />
          </label>
        </div>
      </header>

      {/* Net Worth Hero Banner */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">
              Total Netto Worth
            </span>
            <div className="text-4xl font-extrabold text-white mt-2">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400">{baseCurrency}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Automatically converts Swedish Avanza (SEK), Indian Zerodha & Bank FDs (INR), and Interactive Brokers
            (USD/EUR) into {baseCurrency}.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <ServerOff className="w-4 h-4" /> Zero Server Storage Guarantee
          </div>
          <p className="text-slate-400 leading-relaxed">
            Your SQLite database runs in browser WebAssembly memory and is encrypted with <b>AES-256-GCM</b> before
            saving to your device or Google Drive.
          </p>
          <button
            onClick={() => setShowSecurityModal(true)}
            className="text-indigo-400 hover:underline font-medium inline-block pt-1"
          >
            Inspect Local vs. Server Data Breakdown →
          </button>
        </div>
      </div>

      {/* Action Cards: CSV Re-Import & Fixed Deposit Builder */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base text-white">Re-Import Broker CSV (Auto-Upsert)</h2>
          </div>
          <p className="text-xs text-slate-400">
            Select your broker and drop your latest positions export. Existing holdings update cleanly without
            duplicating rows.
          </p>
          <div className="flex flex-wrap gap-3 items-center pt-1">
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value as BrokerType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white"
            >
              <option value="AVANZA">Avanza (Sweden CSV)</option>
              <option value="ZERODHA">Zerodha Console (India CSV)</option>
              <option value="IBKR">Interactive Brokers (Global CSV)</option>
            </select>
            <input
              type="file"
              accept=".csv"
              onChange={onCsvSelect}
              className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />
          </div>
        </div>

        <form onSubmit={handleAddFD} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base text-white">Add / Update Fixed Deposit (Auto-Compounding)</h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Bank (e.g. SBI, SBAB)"
              value={fdForm.broker}
              onChange={(e) => setFdForm({ ...fdForm, broker: e.target.value })}
            />
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="FD Receipt ID"
              value={fdForm.symbol}
              onChange={(e) => setFdForm({ ...fdForm, symbol: e.target.value })}
            />
            <input
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Description"
              value={fdForm.name}
              onChange={(e) => setFdForm({ ...fdForm, name: e.target.value })}
            />
            <input
              type="number"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Principal"
              value={fdForm.principal}
              onChange={(e) => setFdForm({ ...fdForm, principal: Number(e.target.value) })}
            />
            <input
              type="number"
              step="0.01"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Annual Rate %"
              value={fdForm.interest_rate}
              onChange={(e) => setFdForm({ ...fdForm, interest_rate: Number(e.target.value) })}
            />
            <select
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.currency}
              onChange={(e) => setFdForm({ ...fdForm, currency: e.target.value as CurrencyCode })}
            >
              <option value="INR">INR (₹)</option>
              <option value="SEK">SEK (kr)</option>
              <option value="USD">USD ($)</option>
            </select>
            <input
              type="date"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.start_date}
              onChange={(e) => setFdForm({ ...fdForm, start_date: e.target.value })}
            />
            <input
              type="date"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              value={fdForm.maturity_date}
              onChange={(e) => setFdForm({ ...fdForm, maturity_date: e.target.value })}
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
            >
              Save FD
            </button>
          </div>
        </form>
      </div>

      {/* Holdings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="p-4">Broker / Bank</th>
              <th className="p-4">Asset</th>
              <th className="p-4">Category</th>
              <th className="p-4">Qty / Principal</th>
              <th className="p-4">Market Price / Rate</th>
              <th className="p-4">Current Native Value</th>
              <th className="p-4">Value ({baseCurrency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No holdings yet. Import a CSV from Avanza, Zerodha, or IBKR, or add a Fixed Deposit above.
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const isFD = h.category === 'FIXED_DEPOSIT';
                const nativeVal = isFD ? calculateFDCurrentValue(h) : h.quantity * h.market_price;
                const baseVal = convertToBase(nativeVal, h.currency);
                return (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-semibold text-white">{h.broker}</td>
                    <td className="p-4">
                      <span className="text-slate-100 font-medium">{h.name}</span>{' '}
                      <span className="text-slate-500">({h.symbol})</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isFD ? 'bg-emerald-500/15 text-emerald-300' : 'bg-indigo-500/15 text-indigo-300'
                        }`}
                      >
                        {h.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      {isFD ? `${h.principal.toLocaleString()} ${h.currency}` : h.quantity}
                    </td>
                    <td className="p-4 text-slate-300">
                      {isFD ? `${h.interest_rate}% (Since ${h.start_date})` : `${h.market_price} ${h.currency}`}
                    </td>
                    <td className="p-4 text-slate-200 font-medium">
                      {Math.round(nativeVal).toLocaleString()} {h.currency}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {Math.round(baseVal).toLocaleString()} {baseCurrency}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: Transparency & Privacy Architecture */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">How Netto Protects Your Data</h3>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                Netto uses a <b>Local-First, Zero-Knowledge Architecture</b>. Unlike traditional trackers that store
                your sensitive financial rows in a central company database, your SQLite database exists{' '}
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
                      <td className="p-3 font-semibold text-white">
                        Quantities, Buy Prices, FD Principal & Net Worth
                      </td>
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
      )}

      {/* Modal 2: Change Master Passphrase */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Change Master Passphrase</h3>
              </div>
              <button
                onClick={() => {
                  setShowPassModal(false);
                  setPassChangeError('');
                  setPassChangeSuccess('');
                }}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassphraseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Current Passphrase</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current passphrase..."
                  value={oldPassInput}
                  onChange={(e) => setOldPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Passphrase</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new passphrase (min 6 chars)..."
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Confirm New Passphrase</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new passphrase..."
                  value={newPassConfirm}
                  onChange={(e) => setNewPassConfirm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {passChangeError && <p className="text-rose-400 font-medium">{passChangeError}</p>}
              {passChangeSuccess && <p className="text-emerald-400 font-medium">{passChangeSuccess}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold"
                >
                  Update Passphrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
