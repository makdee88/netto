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
  UserCheck,
} from 'lucide-react';

export interface VaultAuthScreenProps {
  authMode: AuthMode;
  setAuthMode: React.Dispatch<React.SetStateAction<AuthMode>>;
  hasExistingVault: boolean;
  theme?: 'dark' | 'light';
  userEmail?: string;
  activeVaultName?: string;
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
  theme = 'dark',
  userEmail,
  activeVaultName,
  onBackToLanding,
  onUnlockOrCreate,
  onFetchGoogleDriveVault,
  onResetLocalCache,
}) => {
  const isDark = theme === 'dark';

  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [restoreBytes, setRestoreBytes] = useState<Uint8Array | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCreatingNew = authMode === 'CREATE_OR_UNLOCK' && !hasExistingVault;
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
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <div className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl space-y-6 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className={`flex items-center gap-1.5 text-xs font-medium transition ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <div className={`flex gap-1 text-[11px] font-semibold p-1 rounded-xl border ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode('CREATE_OR_UNLOCK');
              }}
              className={`px-3 py-1 rounded-lg transition ${
                !isRestoring
                  ? 'bg-indigo-600 text-white shadow'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
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
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Restore
            </button>
          </div>
        </div>

        {/* User Identity Banner */}
        {userEmail ? (
          <div className={`flex items-center justify-between p-3 rounded-2xl border text-xs shadow-inner ${
            isDark
              ? 'bg-slate-950 border-emerald-500/30'
              : 'bg-emerald-50/60 border-emerald-300'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <span className={`text-[10px] uppercase font-bold block leading-none ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                }`}>
                  Authenticated User
                </span>
                <span className={`font-semibold mt-0.5 block ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  {userEmail}
                </span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold border ${
              isDark
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/20'
                : 'bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}>
              {activeVaultName || 'Personal'}
            </span>
          </div>
        ) : null}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl border ${
              isDark
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200'
            }`}>
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
                ? `Create Vault [${activeVaultName || 'Personal'}]`
                : isRestoring
                ? `Restore Vault [${activeVaultName || 'Personal'}]`
                : `Unlock Vault [${activeVaultName || 'Personal'}]`}
            </h2>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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
          <div className={`space-y-3 p-4 border rounded-2xl ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                isDark
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
              }`}>
                <FileUp className="w-4 h-4 text-indigo-500" />
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                }`}
              >
                <CloudDownload className="w-4 h-4 text-emerald-500" />
                <span>Google Drive</span>
              </button>
            </div>

            {restoreFileName && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                Loaded: {restoreFileName}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Vault Passphrase
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="••••••••••••"
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-900 shadow-sm'
              }`}
            />
          </div>

          {isCreatingNew && (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Confirm Passphrase
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passphraseConfirm}
                onChange={(e) => setPassphraseConfirm(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-white border-slate-300 text-slate-900 shadow-sm'
                }`}
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
        {/* Inside VaultAuthScreen.tsx below the submit buttons */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowHowToUse(true)}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 opacity-80 hover:opacity-100 transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>How does vault encryption &amp; restore work?</span>
          </button>
        </div>

        {hasExistingVault && (
          <div className={`pt-2 border-t flex justify-between items-center text-[11px] ${
            isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
          }`}>
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" /> Local encrypted cache detected
            </span>
            <button
              type="button"
              onClick={onResetLocalCache}
              className="flex items-center gap-1 hover:text-rose-500 transition font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Reset Cache
            </button>
          </div>
        )}
      </div>
    </div>
  );
};