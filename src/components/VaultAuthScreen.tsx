import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Upload,
  FolderOpen,
  Cloud,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AuthMode } from '../types';

interface VaultAuthScreenProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
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
  const [passInput, setPassInput] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [restoreBytes, setRestoreBytes] = useState<Uint8Array | null>(null);
  const [restoreName, setRestoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await onUnlockOrCreate(passInput, passConfirm, restoreBytes, restoreName);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Check your passphrase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Back Button */}
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition text-slate-300"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Overview
        </button>

        <div className="border border-slate-800 bg-slate-900/90 rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {authMode === 'RESTORE_RETURNING'
                  ? 'Restore Encrypted Vault'
                  : hasExistingVault
                  ? 'Unlock Netto Vault'
                  : 'Create Secure Vault'}
              </h2>
              <p className="text-xs opacity-60">
                {hasExistingVault
                  ? 'AES-256-GCM Local Encryption'
                  : 'Zero-Knowledge Client-Side SQLite'}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'RESTORE_RETURNING' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium opacity-80">Select Encrypted Vault File (.sqlite.enc)</label>
                <div className="flex gap-2">
                  <label className="flex-1 border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/50 p-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition">
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span className="truncate">{restoreName || 'Choose .sqlite.enc file'}</span>
                    <input
                      type="file"
                      accept=".enc"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setRestoreName(file.name);
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (evt.target?.result) {
                              setRestoreBytes(new Uint8Array(evt.target.result as ArrayBuffer));
                            }
                          };
                          reader.readAsArrayBuffer(file);
                        }
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onFetchGoogleDriveVault((bytes) => {
                        setRestoreBytes(bytes);
                        setRestoreName('Google_Drive_Backup.sqlite.enc');
                      })
                    }
                    className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Pull from Google Drive AppData"
                  >
                    <Cloud className="w-4 h-4" /> Drive
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium opacity-80">Master Passphrase</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 opacity-40" />
                <input
                  type="password"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {(!hasExistingVault || authMode === 'RESTORE_RETURNING') && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium opacity-80">Confirm Passphrase</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 opacity-40" />
                  <input
                    type="password"
                    value={passConfirm}
                    onChange={(e) => setPassConfirm(e.target.value)}
                    placeholder="Re-enter passphrase"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                'Processing Vault...'
              ) : authMode === 'RESTORE_RETURNING' ? (
                <>
                  <Upload className="w-4 h-4" /> Restore & Unlock Vault
                </>
              ) : hasExistingVault ? (
                <>
                  <ShieldCheck className="w-4 h-4" /> Unlock Vault
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Initialize Encrypted Vault
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap justify-between items-center text-xs opacity-70">
            {authMode !== 'RESTORE_RETURNING' && hasExistingVault && (
              <button
                onClick={() => setAuthMode('RESTORE_RETURNING')}
                className="text-indigo-400 hover:underline font-medium"
              >
                Restore from file or Cloud?
              </button>
            )}
            {authMode === 'RESTORE_RETURNING' && (
              <button
                onClick={() => setAuthMode('CREATE_OR_UNLOCK')}
                className="text-indigo-400 hover:underline font-medium"
              >
                Back to normal unlock
              </button>
            )}
            <button
              onClick={onResetLocalCache}
              className="text-rose-400 hover:underline font-medium ml-auto"
            >
              Reset local cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};