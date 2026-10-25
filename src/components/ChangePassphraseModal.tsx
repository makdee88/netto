import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';

interface ChangePassphraseModalProps {
  onClose: () => void;
  onUpdatePassphrase: (oldPass: string, newPass: string, confirmPass: string) => Promise<string>;
}

export const ChangePassphraseModal: React.FC<ChangePassphraseModalProps> = ({ onClose, onUpdatePassphrase }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const msg = await onUpdatePassphrase(oldPass, newPass, confirmPass);
      setSuccess(msg);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update passphrase.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Change Master Passphrase</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Current Passphrase</label>
            <input
              type="password"
              required
              placeholder="Enter current passphrase..."
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">New Passphrase</label>
            <input
              type="password"
              required
              placeholder="Enter new passphrase (min 6 chars)..."
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Confirm New Passphrase</label>
            <input
              type="password"
              required
              placeholder="Confirm new passphrase..."
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
            />
          </div>

          {error && <p className="text-rose-400 font-medium">{error}</p>}
          {success && <p className="text-emerald-400 font-medium">{success}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
  );
};
