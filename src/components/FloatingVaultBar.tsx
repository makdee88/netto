import React, { useState } from 'react';
import { Database as DbIcon, FolderPlus, LogOut, UserCheck } from 'lucide-react';

interface FloatingVaultBarProps {
  email: string;
  fullName?: string;
  isDark: boolean;
  activeVaultName: string;
  vaultList: string[];
  onSwitchVault: (name: string) => void;
  onCreateVaultSlot: (name: string) => void;
  onLogout: () => void;
}

export const FloatingVaultBar: React.FC<FloatingVaultBarProps> = ({
  email,
  fullName,
  isDark,
  activeVaultName,
  vaultList,
  onSwitchVault,
  onCreateVaultSlot,
  onLogout,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const displayName = fullName || email.split('@')[0] || 'User';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onCreateVaultSlot(nameInput.trim());
    setNameInput('');
    setIsCreating(false);
  };

  return (
    <aside
      aria-label="User and Vault Session"
      className={`fixed top-1/2 -translate-y-1/2 right-4 z-50 flex flex-col gap-3 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-xs transition max-w-[260px] ${
        isDark
          ? 'bg-slate-900/95 border-emerald-500/30 text-slate-200 shadow-black/60'
          : 'bg-white/95 border-emerald-500/40 text-slate-800 shadow-slate-300/60'
      }`}
    >
      {/* User Information */}
      <div className="flex items-start gap-2 pb-2.5 border-b border-slate-700/40">
        <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
          <UserCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
              Authenticated
            </span>
          </div>
          <p className="font-bold text-slate-100 text-xs truncate" title={displayName}>
            {displayName}
          </p>
          <p className="opacity-60 text-[10px] truncate" title={email}>
            {email}
          </p>
        </div>
      </div>

      {/* Vault Switcher & Creator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] opacity-75 font-semibold">
          <span className="flex items-center gap-1">
            <DbIcon className="w-3.5 h-3.5 text-indigo-400" /> Active Vault
          </span>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300"
              title="Create another vault slot"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>

        {!isCreating ? (
          <select
            value={activeVaultName}
            onChange={(e) => onSwitchVault(e.target.value)}
            className={`w-full px-2.5 py-1.5 rounded-xl border font-semibold text-xs cursor-pointer truncate ${
              isDark
                ? 'bg-slate-950 border-slate-700 text-white'
                : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
            title={`Active: ${activeVaultName}`}
          >
            {vaultList.map((vName) => (
              <option key={vName} value={vName}>
                {vName === email ? `${vName} (Default)` : vName}
              </option>
            ))}
          </select>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-1.5 pt-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Work, Family..."
              autoFocus
              className={`w-full px-2 py-1 rounded-lg border text-xs ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-[11px]"
              >
                Add Vault
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2 py-1 rounded-lg border border-slate-700 opacity-75 hover:opacity-100 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold text-[11px] transition"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign Out</span>
      </button>
    </aside>
  );
};