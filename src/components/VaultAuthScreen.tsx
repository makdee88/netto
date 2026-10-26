import React, { useState } from 'react';
import { AuthMode } from '../types';
import {
  Lock,
  KeyRound,
  FileUp,
  CloudDownload,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

export interface VaultAuthScreenProps {
  authMode: AuthMode;
  setAuthMode: React.Dispatch<React.SetStateAction<AuthMode>>;
  hasExistingVault: boolean;
  onBackToLanding: () => void;
  onUnlockOrCreate: (
    passInput: string,
    passConfirm: string,
    restoreBytes: Uint8Array | null,
    restoreName: string
  ) => Promise<void>;
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
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [restoreBytes, setRestoreBytes] = useState<Uint8Array | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCreatingNew = authMode === 'CREATE_OR_UNLOCK' && !hasExistingVault;
  const isUnlocking = authMode === 'CREATE_OR_UNLOCK' && hasExistingVault;
  const isRestoring = authMode === 'RESTORE_RETURNING';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      setRestoreBytes(new Uint8Array(buffer));
      setRestoreFileName(file.name);
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to read encrypted file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await onUnlockOrCreate(
        passphrase,
        passphraseConfirm,
        restoreBytes,
        restoreFileName
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <div className="flex gap-1 text-[11px] font-semibold bg-slate-950 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode('CREATE_OR_UNLOCK');
              }}
              className={`px-3 py-1 rounded-lg transition ${
                !isRestoring
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {hasExistingVault ? 'Unlock' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode('RESTORE_RETURNING');
              }}
              className={`px-3 py-1 rounded-lg transition ${
                isRestoring
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Restore
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {isCreatingNew ? (
                <KeyRound className="w-5 h-5" />
              ) : isRestoring ? (
                <FileUp className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {isCreatingNew
                ? 'Create Encrypted Vault'
                : isRestoring
                ? 'Restore Vault Backup'
                : 'Unlock Netto Vault'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isCreatingNew
              ? 'Choose a strong passphrase. All assets are locally encrypted in browser storage via AES-256-GCM.'
              : isRestoring
              ? 'Load your .sqlite.enc file or pull from Google Drive, then enter your passphrase.'
              : 'Enter your passphrase to decrypt your local SQLite ledger.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isRestoring && (
          <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer transition">
                <FileUp className="w-4 h-4 text-indigo-400" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".enc,.sqlite.enc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  onFetchGoogleDriveVault((bytes: Uint8Array) => {
                    setRestoreBytes(bytes);
                    setRestoreFileName('Google Drive Backup');
                    setErrorMsg(null);
                  })
                }
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition"
              >
                <CloudDownload className="w-4 h-4 text-emerald-400" />
                <span>Google Drive</span>
              </button>
            </div>

            {restoreFileName && (
              <p className="text-xs text-emerald-400 font-medium text-center">
                Loaded: {restoreFileName}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Vault Passphrase
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {isCreatingNew && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Confirm Passphrase
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passphraseConfirm}
                onChange={(e) => setPassphraseConfirm(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            {loading
              ? 'Processing...'
              : isCreatingNew
              ? 'Initialize & Encrypt Vault'
              : isRestoring
              ? 'Decrypt & Restore Vault'
              : 'Unlock Vault'}
          </button>
        </form>

        {hasExistingVault && (
          <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Local encrypted cache detected
            </span>
            <button
              type="button"
              onClick={onResetLocalCache}
              className="flex items-center gap-1 hover:text-rose-400 transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset Cache
            </button>
          </div>
        )}
      </div>
    </div>
  );
};