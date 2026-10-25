import React, { useEffect, useState } from 'react';
import type { Database } from 'sql.js';
import { initDatabase } from './db/database';
import {
  encryptSqliteBytes,
  decryptSqliteBytes,
  uint8ToBase64,
  base64ToUint8,
} from './crypto/vaultCrypto';
import { importBrokerCsv } from './parsers/csvImporter';
import { syncToGoogleDrive, loadFromGoogleDrive } from './sync/googleDrive';
import { BrokerType, CurrencyCode, HoldingRow } from './types';
import { LandingPage } from './components/LandingPage';
import { VaultAuthScreen, AuthMode } from './components/VaultAuthScreen';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { PrivacyArchitectureModal } from './components/PrivacyArchitectureModal';
import { ChangePassphraseModal } from './components/ChangePassphraseModal';

const DEFAULT_FX_TO_SEK: Record<string, number> = {
  SEK: 1,
  USD: 10.45,
  EUR: 11.35,
  INR: 0.125,
};

const STORAGE_KEY = 'netto_encrypted_vault_v2';
const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

type AppStep = 'LANDING' | 'AUTH' | 'DASHBOARD';

export default function App() {
  const [step, setStep] = useState<AppStep>('LANDING');
  const [authMode, setAuthMode] = useState<AuthMode>('CREATE_OR_UNLOCK');

  const [db, setDb] = useState<Database | null>(null);
  const [passphrase, setPassphrase] = useState<string>('');
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showPassModal, setShowPassModal] = useState<boolean>(false);

  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('SEK');
  const [fxRates, setFxRates] = useState<Record<string, number>>(DEFAULT_FX_TO_SEK);
  const [statusMsg, setStatusMsg] = useState<string>('Vault Locked');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    setHasExistingVault(Boolean(localStorage.getItem(STORAGE_KEY)));
  }, []);

  const refreshHoldings = (database: Database) => {
    const stmt = database.prepare('SELECT * FROM holdings ORDER BY broker, name');
    const rows: HoldingRow[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HoldingRow);
    stmt.free();
    setHoldings(rows);
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
      setStep('DASHBOARD');
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
      setStep('DASHBOARD');
    } else {
      if (passInput !== passConfirm) throw new Error('Passphrases do not match.');
      const database = await initDatabase();
      setPassphrase(passInput);
      setDb(database);
      await persistEncryptedVault(database, passInput);
      setHasExistingVault(true);
      setStatusMsg('New Encrypted Netto Vault Created!');
      setStep('DASHBOARD');
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
        onLaunchCreateOrUnlock={() => {
          setAuthMode('CREATE_OR_UNLOCK');
          setStep('AUTH');
        }}
        onLaunchRestore={() => {
          setAuthMode('RESTORE_RETURNING');
          setStep('AUTH');
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
        onBackToLanding={() => setStep('LANDING')}
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
          }
        }}
      />
    );
  }

  return (
    <>
      <PortfolioDashboard
        holdings={holdings}
        baseCurrency={baseCurrency}
        setBaseCurrency={setBaseCurrency}
        fxRates={fxRates}
        statusMsg={statusMsg}
        onGoLanding={() => setStep('LANDING')}
        onOpenPrivacyModal={() => setShowSecurityModal(true)}
        onOpenPassModal={() => setShowPassModal(true)}
        onSyncLivePrices={async () => {
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
        }}
        onDriveBackup={() =>
          withGoogleAuth(async (token) => {
            setStatusMsg('Encrypting & uploading to Google Drive...');
            const enc = await encryptSqliteBytes(db.export(), passphrase);
            setStatusMsg(await syncToGoogleDrive(token, enc));
          })
        }
        onDriveRestore={() =>
          withGoogleAuth(async (token) => {
            setStatusMsg('Downloading encrypted vault from Google Drive...');
            const enc = await loadFromGoogleDrive(token);
            if (!enc) return setStatusMsg('No vault found in Google Drive yet.');
            try {
              const dec = await decryptSqliteBytes(enc, passphrase);
              const restoredDb = await initDatabase(dec);
              setDb(restoredDb);
              await persistEncryptedVault(restoredDb, passphrase);
              setStatusMsg('Restored & Decrypted Netto Vault from Google Drive!');
            } catch {
              setStatusMsg('Drive file uses a different passphrase than current session.');
            }
          })
        }
        onDownloadEncryptedFile={async () => {
          const enc = await encryptSqliteBytes(db.export(), passphrase);
          const blob = new Blob([enc.buffer as ArrayBuffer], { type: 'application/octet-stream' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `netto_${new Date().toISOString().slice(0, 10)}.sqlite.enc`;
          a.click();
          setStatusMsg('Downloaded AES-256 Encrypted .sqlite.enc backup');
        }}
        onUploadEncryptedFile={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const dec = await decryptSqliteBytes(new Uint8Array(reader.result as ArrayBuffer), passphrase);
              const newDb = await initDatabase(dec);
              setDb(newDb);
              await persistEncryptedVault(newDb, passphrase);
              setStatusMsg(`Decrypted & loaded ${file.name}`);
            } catch {
              setStatusMsg('Failed to decrypt uploaded file with current passphrase.');
            }
          };
          reader.readAsArrayBuffer(file);
        }}
        onCsvImport={(file, broker) =>
          importBrokerCsv(file, broker, db, async (count) => {
            await persistEncryptedVault(db);
            setStatusMsg(`Upserted ${count} holdings from ${broker}`);
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
      />

      {showSecurityModal && <PrivacyArchitectureModal onClose={() => setShowSecurityModal(false)} />}
      {showPassModal && (
        <ChangePassphraseModal
          onClose={() => setShowPassModal(false)}
          onUpdatePassphrase={handleUpdatePassphrase}
        />
      )}
    </>
  );
}
