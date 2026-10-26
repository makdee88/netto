import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ShieldCheck, Mail, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

interface AuthGateScreenProps {
  isDark: boolean;
  onBackToLanding: () => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ isDark, onBackToLanding }) => {
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        // Request Google Drive appdata access directly during initial login
        scopes:
          provider === 'google'
            ? 'https://www.googleapis.com/auth/drive.appdata'
            : undefined,
        queryParams:
          provider === 'google'
            ? {
                access_type: 'offline',
                prompt: 'select_account', // Forces Google to show account selection on re-login
              }
            : undefined,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div
        className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl space-y-6 transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className={`flex items-center gap-1.5 text-xs font-medium transition ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Local-First Security
          </span>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Your Vault</h2>
          <p className={`text-xs leading-relaxed max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Sign in to access your multi-tenant encrypted SQLite vaults and sync backups directly with your Google Drive.
          </p>
        </div>

        {authError && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {magicLinkSent ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
            <Mail className="w-6 h-6 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-400">Magic Link Sent!</h3>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Check <span className="font-semibold text-indigo-400">{email}</span> for your login link.
            </p>
            <button
              onClick={() => setMagicLinkSent(false)}
              className="text-xs text-indigo-400 hover:underline pt-2 block mx-auto"
            >
              Try another email
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={authLoading}
                onClick={() => handleOAuthSignIn('google')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 border rounded-xl font-semibold text-xs transition disabled:opacity-50 ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                disabled={authLoading}
                onClick={() => handleOAuthSignIn('github')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 border rounded-xl font-semibold text-xs transition disabled:opacity-50 ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className={`flex-grow border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
              <span className={`flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Or continue with email
              </span>
              <div className={`flex-grow border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-sm'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Magic Link</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};