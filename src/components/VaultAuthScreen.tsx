import React, { useState } from 'react';
import { Lock, Upload, CloudDownload, Database as DbIcon, ChevronLeft, CheckCircle2 } from 'lucide-react';

export type AuthMode = 'CREATE_OR_UNLOCK' | 'RESTORE_RETURNING';

interface VaultAuthScreenProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  hasExistingVault: boolean;
  onBackToLanding: () => void;
  onUnlockOrCreate: (passphrase: string, confirmPassphrase: string, restoreBytes: Uint8Array | null, restoreName: string) => Promise<void>;
  onFetchGoogleDriveVault: (onLoaded: (bytes: Uint8Array) => void) => void;
  onResetLocalCache: () => void;
}

export const VaultAuthScreen: React.FC<VaultAuthScreenProps> = ({
  authMode,
  setAuthMode,
  hasExistingVault,
  onBackToLanding,
  onUnlockOrCreate,
  onFetchGoogleDriveVault,
  onResetLocalCache,
}) => {
  const [passInput, setPassInput] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [pendingRestoreBytes, setPendingRestoreBytes] = useState<Uint8Array | null>(null);
  const [pendingRestoreName, setPendingRestoreName] = useState('');
  const [authError, setAuthError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingRestoreBytes(new Uint8Array(reader.result as ArrayBuffer));
      setPendingRestoreName(file.name);
      setAuthError('');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await onUnlockOrCreate(passInput, passConfirm, pendingRestoreBytes, pendingRestoreName);
    } catch (err: any) {
      setAuthError(err.message || 'Decryption failed.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="max-w-lg w-full space-y-4">
        <button
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Netto Overview & Infographic
        </button>

        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('CREATE_OR_UNLOCK');
                setAuthError('');
              }}
              className={`py-2.5 rounded-lg transition ${
                authMode === 'CREATE_OR_UNLOCK' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {hasExistingVault ? 'Unlock Local Vault' : '1. New Encrypted Vault'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('RESTORE_RETURNING');
                setAuthError('');
              }}
              className={`py-2.5 rounded-lg transition ${
                authMode === 'RESTORE_RETURNING' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Returning User (Upload)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              {authMode === 'RESTORE_RETURNING' ? <Upload className="w-6 h-6" /> : <DbIcon className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {authMode === 'RESTORE_RETURNING'
                  ? 'Restore Your Encrypted Netto Vault'
                  : hasExistingVault
                  ? 'Unlock Your Local Netto Vault'
                  : 'Create Your Encrypted SQLite Database'}
              </h1>
              <p className="text-xs text-slate-400">
                {authMode === 'RESTORE_RETURNING'
                  ? 'Upload your .sqlite.enc file or fetch from Google Drive, then enter your passphrase.'
                  : 'Protected with client-side PBKDF2 + AES-256-GCM encryption.'}
              </p>
            </div>
          </div>

          {authMode === 'RESTORE_RETURNING' && (
            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                Step A: Choose where to load your encrypted database from
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-900/60 text-center transition">
                  <Upload className="w-5 h-5 text-indigo-400 mb-1.5" />
                  <span className="text-xs font-semibold text-white">Upload .sqlite.enc</span>
                  <span className="text-[10px] text-slate-400">From your computer</span>
                  <input type="file" accept=".enc,.sqlite" onChange={handleFileSelect} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    onFetchGoogleDriveVault((bytes) => {
                      setPendingRestoreBytes(bytes);
                      setPendingRestoreName('Google Drive Vault (netto_vault.sqlite.enc)');
                    })
                  }
                  className="flex flex-col items-center justify-center p-4 border border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-900/60 text-center transition"
                >
                  <CloudDownload className="w-5 h-5 text-emerald-400 mb-1.5" />
                  <span className="text-xs font-semibold text-white">Pull from Google Drive</span>
                  <span className="text-[10px] text-slate-400">1-Click Cloud Restore</span>
                </button>
              </div>

              {pendingRestoreName && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Ready to decrypt: <b>{pendingRestoreName}</b>
                  </span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">
                {authMode === 'RESTORE_RETURNING'
                  ? 'Step B: Enter Master Passphrase for This Backup'
                  : hasExistingVault
                  ? 'Enter Master Passphrase to Unlock'
                  : 'Set a Strong Master Encryption Passphrase'}
              </label>
              <input
                type="password"
                required
                placeholder="Enter passphrase (min 6 characters)..."
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>

            {authMode === 'CREATE_OR_UNLOCK' && !hasExistingVault && (
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
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none text-sm"
                />
              </div>
            )}

            {authError && <p className="text-xs text-rose-400 font-medium">{authError}</p>}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/25"
            >
              <Lock className="w-4 h-4" />
              {authMode === 'RESTORE_RETURNING'
                ? 'Decrypt & Restore Portfolio'
                : hasExistingVault
                ? 'Decrypt & Open Netto'
                : 'Create Encrypted SQLite Database'}
            </button>
          </form>

          {authMode === 'CREATE_OR_UNLOCK' && hasExistingVault && (
            <button
              type="button"
              onClick={onResetLocalCache}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Want to start a brand-new database instead? Reset local browser cache
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
