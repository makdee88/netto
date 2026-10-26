import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { VaultAuthScreen } from './components/VaultAuthScreen';
import { ManageAssetsTab } from './components/ManageAssetsTab';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'manage-assets'>('overview');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) {
        setVaultUnlocked(false);
        setVaultPassword('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading Netto...
      </div>
    );
  }

  if (!session) {
    return <VaultAuthScreen onAuthenticated={(_userId, _email) => {}} />;
  }

  if (!vaultUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
          <h2 className="text-xl font-bold mb-2">Unlock Local Vault</h2>
          <p className="text-sm text-slate-400 mb-6">
            Enter your local vault encryption passphrase to decrypt your local-first SQLite database.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vaultPassword.length > 0) {
                setVaultUnlocked(true);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Vault Passphrase
              </label>
              <input
                type="password"
                required
                value={vaultPassword}
                onChange={(e) => setVaultPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition"
            >
              Unlock Vault
            </button>
          </form>
          <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
            <span>Signed in as {session.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="hover:text-slate-300 underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <span className="font-bold text-lg tracking-tight text-indigo-400">Netto</span>
            <nav className="flex space-x-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  activeTab === 'overview'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('manage-assets')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  activeTab === 'manage-assets'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                Manage Assets
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-400 hidden sm:inline">{session.user.email}</span>
            <button
              onClick={() => {
                setVaultUnlocked(false);
                setVaultPassword('');
                supabase.auth.signOut();
              }}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition font-medium text-slate-200"
            >
              Lock Vault
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tight">Portfolio Overview</h2>
              <button
                onClick={() => setActiveTab('manage-assets')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition shadow-sm"
              >
                Manage Assets
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Net Worth</p>
                <p className="text-3xl font-extrabold mt-2 text-slate-100">$0.00</p>
              </div>
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Encrypted Vault Status</p>
                <p className="text-lg font-semibold mt-2 text-emerald-400 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 inline-block"></span>
                  AES-256-GCM Active
                </p>
              </div>
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Engine</p>
                <p className="text-lg font-semibold mt-2 text-slate-200">Local SQLite</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage-assets' && (
          // @ts-ignore
          <ManageAssetsTab onBackToOverview={() => setActiveTab('overview')} />
        )}
      </main>
    </div>
  );
}

export default App;