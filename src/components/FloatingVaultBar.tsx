import React, { useState } from 'react';
import { Database as DbIcon, FolderPlus, LogOut, UserCheck, Trash2 } from 'lucide-react';

interface FloatingVaultBarProps {
  email: string;
  fullName?: string;
  isDark: boolean;
  activeVaultName: string;
  vaultList: string[];
  onSwitchVault: (name: string) => void;
  onCreateVaultSlot: (name: string) => void;
  onDeleteVaultSlot: (name: string) => void;
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
  onDeleteVaultSlot,
  onLogout,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const displayName = fullName || email.split('@')[0] || 'User';
  const isDefaultVault = activeVaultName === email;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onCreateVaultSlot(nameInput.trim());
    setNameInput('');
    setIsCreating(false);
  };

  const handleDelete = () => {
    if (isDefaultVault) return;
    if (
      confirm(
        `Are you sure you want to permanently delete vault "${activeVaultName}" and its local encrypted database?`
      )
    ) {
      onDeleteVaultSlot(activeVaultName);
    }
  };

  return (
    <aside
      aria-label="User and Vault Session"
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-xs transition whitespace-nowrap ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/60'
          : 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/30'
      }`}
    >
      {/* User Information */}
      <div className={`flex items-center gap-2 pr-3 border-r ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
        <div className={`p-1.5 rounded-full shrink-0 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
          <UserCheck className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold text-xs ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {displayName}
          </span>
          <span className={`text-[11px] max-w-[130px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={email}>
            ({email})
          </span>
        </div>
      </div>

      {/* Vault Switcher & Creator */}
      <div className={`flex items-center gap-2 pr-3 border-r ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
        <DbIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Vault:
        </span>

        {!isCreating ? (
          <div className="flex items-center gap-1.5">
            <select
              value={activeVaultName}
              onChange={(e) => onSwitchVault(e.target.value)}
              className={`px-2.5 py-1 rounded-xl border font-semibold text-xs cursor-pointer max-w-[150px] truncate transition ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
              title={`Active: ${activeVaultName}`}
            >
              {vaultList.map((vName) => (
                <option key={vName} value={vName}>
                  {vName === email ? `${vName} (Default)` : vName}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCreating(true)}
              className={`p-1.5 rounded-xl transition shrink-0 ${
                isDark
                  ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200'
              }`}
              title="Create new named vault"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>

            {!isDefaultVault && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition shrink-0"
                title={`Delete vault "${activeVaultName}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Vault name..."
              autoFocus
              className={`px-2 py-1 rounded-lg border text-xs w-28 ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-[11px]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className={`px-1.5 py-1 rounded-lg border opacity-75 hover:opacity-100 text-[11px] ${
                isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'
              }`}
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-semibold text-[11px] transition"
        title="Sign out of Supabase & lock database"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Logout</span>
      </button>
    </aside>
  );
};