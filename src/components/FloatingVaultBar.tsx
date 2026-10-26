import React, { useState } from 'react';
import { Database as DbIcon, FolderPlus, LogOut } from 'lucide-react';

interface FloatingVaultBarProps {
  email: string;
  isDark: boolean;
  activeVaultName: string;
  vaultList: string[];
  onSwitchVault: (name: string) => void;
  onCreateVaultSlot: (name: string) => void;
  onLogout: () => void;
}

export const FloatingVaultBar: React.FC<FloatingVaultBarProps> = ({
  email,
  isDark,
  activeVaultName,
  vaultList,
  onSwitchVault,
  onCreateVaultSlot,
  onLogout,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onCreateVaultSlot(nameInput.trim());
    setNameInput('');
    setIsCreating(false);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-wrap items-center gap-2.5 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-xs transition ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-200'
          : 'bg-white/95 border-slate-300 text-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 pr-2 border-r border-slate-700/40">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-indigo-400">{email}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <DbIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="opacity-70">DB:</span>
        {!isCreating ? (
          <>
            <select
              value={activeVaultName}
              onChange={(e) => onSwitchVault(e.target.value)}
              className={`px-2 py-1 rounded-lg border font-bold text-xs cursor-pointer ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
              }`}
            >
              {vaultList.map((vName) => (
                <option key={vName} value={vName}>
                  {vName}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsCreating(true)}
              className="p-1 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
              title="Create new named vault"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Tax, Family..."
              autoFocus
              className={`px-2 py-0.5 rounded border text-xs w-28 ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button type="submit" className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold">
              Add
            </button>
            <button type="button" onClick={() => setIsCreating(false)} className="px-1.5 py-0.5 opacity-70 hover:opacity-100">
              ✕
            </button>
          </form>
        )}
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-1 pl-2 border-l border-slate-700/40 text-rose-400 hover:text-rose-300 font-semibold transition"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Logout</span>
      </button>
    </div>
  );
};