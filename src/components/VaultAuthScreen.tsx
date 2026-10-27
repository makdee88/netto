import React, { useState, useRef } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  FolderOpen,
  ArrowLeft,
  CloudDownload,
  Trash2,
  Eye,
  EyeOff,
  BookOpen,
} from 'lucide-react';
import { AuthMode } from '../types';
import { HowToUseModal } from './HowToUseModal';

interface VaultAuthScreenProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  hasExistingVault: boolean;
  theme: 'dark' | 'light';
  userEmail: string;
  activeVaultName: string;
  onBackToLanding: () => void;
  onUnlockOrCreate: (
    passphrase: string,
    passphraseConfirm: string,
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
  theme,
  userEmail,
  activeVaultName,
  onBackToLanding,
  onUnlockOrCreate,
  onFetchGoogleDriveVault,
  onResetLocalCache,
}) => {
  const isDark = theme === 'dark';

  const [passphrase, setPassphrase] = useState<string>('');
  const [passphraseConfirm, setPassphraseConfirm] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [restoreBytes, setRestoreBytes] = useState<Uint8Array | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHowToUse, setShowHowToUse] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isUnlock = hasExistingVault && authMode === 'CREATE_OR_UNLOCK';
  const isCreate = !hasExistingVault && authMode === 'CREATE_OR_UNLOCK';
  const isRestore = authMode === 'RESTORE_RETURNING';

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      setRestoreBytes(new Uint8Array(buffer));
      setRestoreFileName(file.name);
      setErrorMessage('');
    } catch (err: any) {
      setErrorMessage(`Failed to read backup file: ${err?.message || err}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await onUnlockOrCreate(passphrase, passphraseConfirm, restoreBytes, restoreFileName);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Check your passphrase.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header navigation & title */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 text-xs font-semibold opacity-75 hover:opacity-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </button>
          <span className="text-[11px] font-mono opacity-60">
            {userEmail ? `${userEmail}` : 'Guest Session'}
          </span>
        </div>

        {/* Vault Card */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Vault Status Icon */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl border ${
                  isUnlock
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : isCreate
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                }`}
              >
                {isUnlock ? <Lock className="w-6 h-6" /> : isCreate ? <KeyRound className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {isUnlock ? 'Unlock Vault' : isCreate ? 'Initialize New Vault' : 'Restore Vault'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-950/30 border border-slate-800 text-indigo-400">
                    {activeVaultName}
                  </span>
                  <span className="text-[10px] opacity-60">AES-256-GCM</span>
                </div>
              </div>
            </div>

            {hasExistingVault && (
              <button
                type="button"
                onClick={onResetLocalCache}
                className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Clear cached vault slot"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-slate-950/20 p-1 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('CREATE_OR_UNLOCK');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                authMode === 'CREATE_OR_UNLOCK'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {hasExistingVault ? 'Unlock' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('RESTORE_RETURNING');
                setErrorMessage('');
              }}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                authMode === 'RESTORE_RETURNING'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              Restore Backup
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Restore File Pickers */}
            {isRestore && (
              <div className="space-y-3 pb-2 border-b border-slate-800/40">
                <label className="block font-semibold opacity-80">Select Vault Backup (.sqlite.enc)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                      isDark ? 'border-slate-800 bg-slate-950/50 hover:bg-slate-950' : 'border-slate-300 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      onFetchGoogleDriveVault((bytes) => {
                        setRestoreBytes(bytes);
                        setRestoreFileName(`gdrive_${activeVaultName}.sqlite.enc`);
                      });
                    }}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                      isDark ? 'border-slate-800 bg-slate-950/50 hover:bg-slate-950' : 'border-slate-300 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <CloudDownload className="w-4 h-4 text-emerald-400" />
                    <span>Google Drive</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".enc, .sqlite, .db, application/octet-stream"
                  onChange={handleFileSelected}
                  className="hidden"
                />

                {restoreFileName && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{restoreFileName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Passphrase Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold opacity-80">
                  {isUnlock ? 'Vault Passphrase' : isCreate ? 'Create Master Passphrase' : 'Vault Encryption Passphrase'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="opacity-60 hover:opacity-100 transition p-0.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Minimum 6 characters"
                className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-100'
                    : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900'
                }`}
              />
            </div>

            {/* Confirm Passphrase for Brand New Vault */}
            {isCreate && (
              <div className="space-y-1">
                <label className="font-semibold opacity-80">Confirm Master Passphrase</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder="Repeat master passphrase"
                  className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-100'
                      : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900'
                  }`}
                />
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isLoading || (isRestore && !restoreBytes)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Cryptographic Handshake...</span>
                </>
              ) : isUnlock ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Vault</span>
                </>
              ) : isCreate ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Create Encrypted Vault</span>
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4" />
                  <span>Decrypt &amp; Restore Vault</span>
                </>
              )}
            </button>
          </form>

          {/* Educational helper link to trigger HowToUseModal */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setShowHowToUse(true)}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 opacity-80 hover:opacity-100 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>How does vault encryption &amp; restore work?</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded How To Use Modal */}
      <HowToUseModal
        isOpen={showHowToUse}
        onClose={() => setShowHowToUse(false)}
        theme={theme}
      />
    </div>
  );
};