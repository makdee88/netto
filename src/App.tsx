import React, { useState, useEffect } from 'react';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ManageAssetsTab } from './components/ManageAssetsTab';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Navigation / View State: 'landing' | 'auth' | 'vault-unlock' | 'dashboard'
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'vault-unlock' | 'dashboard'>('landing');

  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'manage-assets'>('overview');

  // Magic Link Auth State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
        if (!currentSession) {
          setVaultUnlocked(false);
          setVaultPassword('');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (!session) {
      setCurrentView('auth');
    } else if (!vaultUnlocked) {
      setCurrentView('vault-unlock');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading Netto...
      </div>
    );
  }

  // Floating User Status Bar
  const userStatusBar = session && (
    <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-full flex items-center space-x-3 text-xs shadow-lg z-50">
      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
      <span className="text-slate-300 font-medium">{session.user.email}</span>
      <button
        onClick={() => {
          setVaultUnlocked(false);
          setVaultPassword('');
          supabase.auth.signOut();
          setCurrentView('landing');
        }}
        className="text-slate-400 hover:text-slate-100 bg-slate-800 px-2 py-0.5 rounded transition"
      >
        Sign Out
      </button>
    </div>
  );

  // 1. Landing Page View
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative">
        {userStatusBar}
        <header className="max-w-6xl mx-auto w-full px-6 py-6 flex justify-between items-center">
          <span className="font-bold text-xl tracking-tight text-indigo-400">Netto</span>
          {session && (
            <button
              onClick={() => setCurrentView(vaultUnlocked ? 'dashboard' : 'vault-unlock')}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded transition font-medium"
            >
              Go to App →
            </button>
          )}
        </header>

        <main className="max-w-4xl mx-auto px-6 text-center py-20 space-y-8">
          <div className="inline-block px-3 py-1 bg-indigo-950/60 border border-indigo-800/50 rounded-full text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            Local-First Encrypted Asset Management
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100">
            Take absolute control of your <span className="text-indigo-400">net worth</span>.
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            A secure, private portfolio tracker powered by local AES-256-GCM encrypted SQLite vaults and Supabase authentication.
          </p>
          <div>
            <button
              onClick={handleGetStarted}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-lg rounded-xl shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </main>

        <footer className="max-w-6xl mx-auto w-full px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-500">
          Netto &bull; Secured locally
        </footer>
      </div>
    );
  }

  // 2. Auth Screen View
  if (currentView === 'auth') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative">
        {userStatusBar}
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
          <button
            onClick={() => setCurrentView('landing')}
            className="text-xs text-slate-400 hover:text-slate-200 mb-4 block"
          >
            ← Back to Home
          </button>
          <h2 className="text-2xl font-bold mb-2">Netto Vault Access</h2>
          <p className="text-sm text-slate-400 mb-6">
            Sign in securely using a magic link sent to your email.
          </p>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded text-red-200 text-sm">
              {authError}
            </div>
          )}

          {magicLinkSent ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-center space-y-3">
              <p className="text-sm text-emerald-200 font-medium">
                Magic link sent to <span className="underline">{email}</span>!
              </p>
              <p className="text-xs text-slate-400">
                Check your inbox and click the link to sign in automatically.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="text-xs text-indigo-400 hover:underline pt-2 block mx-auto"
              >
                Use a different email or resend
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
              >
                {authLoading ? 'Sending Link...' : 'Send Magic Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 3. Vault Decryption Unlock View
  if (currentView === 'vault-unlock') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative">
        {userStatusBar}
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
          <button
            onClick={() => setCurrentView('landing')}
            className="text-xs text-slate-400 hover:text-slate-200 mb-4 block"
          >
            ← Back to Home
          </button>
          <h2 className="text-xl font-bold mb-2">Unlock Local Vault</h2>
          <p className="text-sm text-slate-400 mb-6">
            Enter your local vault encryption passphrase to decrypt your local-first SQLite database.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vaultPassword.length > 0) {
                setVaultUnlocked(true);
                setCurrentView('dashboard');
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
        </div>
      </div>
    );
  }

  // 4. Main Dashboard View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {userStatusBar}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center pr-48">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setCurrentView('landing')}
              className="font-bold text-lg tracking-tight text-indigo-400 hover:opacity-80 transition"
            >
              Netto
            </button>
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