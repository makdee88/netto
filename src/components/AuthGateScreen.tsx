import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, CheckCircle2 } from 'lucide-react';

interface AuthGateScreenProps {
  isDark: boolean;
  onBackToLanding: () => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ isDark, onBackToLanding }) => {
  const [loginEmail, setLoginEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { emailRedirectTo: window.location.origin },
    });

    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`max-w-md w-full border rounded-3xl p-8 shadow-2xl space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">Sign In Required</h2>
          </div>
          <button onClick={onBackToLanding} className="text-xs opacity-70 hover:opacity-100 underline">
            ← Back
          </button>
        </div>

        <p className="text-xs opacity-75 leading-relaxed">
          Sign in to unlock or create your encrypted SQLite vaults.
        </p>

        {authError && (
          <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-200 text-xs">
            {authError}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={authLoading}
            onClick={() => handleOAuthSignIn('google')}
            className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-xs flex items-center justify-center gap-3 transition shadow-sm disabled:opacity-50 ${
              isDark ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-white' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={authLoading}
            onClick={() => handleOAuthSignIn('github')}
            className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-xs flex items-center justify-center gap-3 transition shadow-sm disabled:opacity-50 ${
              isDark ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-white' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800/80"></div>
          <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider font-semibold opacity-40">
            or with email
          </span>
          <div className="flex-grow border-t border-slate-800/80"></div>
        </div>

        {magicLinkSent ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2.5">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-emerald-400">Magic Link Sent!</p>
            <p className="text-[11px] opacity-80 leading-relaxed">
              Check <span className="font-semibold underline">{loginEmail}</span> and click the link to continue.
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="text-[11px] text-indigo-400 hover:underline pt-1 block mx-auto"
            >
              Use another method
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMagicLink} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-70 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-indigo-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition disabled:opacity-50"
            >
              {authLoading ? 'Sending Link...' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};