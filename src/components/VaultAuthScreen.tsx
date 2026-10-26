import React, { useState } from 'react';
import { supabase } from '../supabase';

interface VaultAuthScreenProps {
  onAuthenticated: (userId: string, email: string) => void;
}

export const VaultAuthScreen: React.FC<VaultAuthScreenProps> = ({ onAuthenticated }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Send OTP to email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: {
          full_name: fullName, // Automatically inserted into your Supabase 'profiles' table via trigger
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
    }
  };

  // Step 2: Verify OTP code entered by user
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (data.user) {
      // Proceed to local vault decryption / overview screen
      onAuthenticated(data.user.id, data.user.email || email);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl text-slate-100">
      <h2 className="text-2xl font-bold mb-2">Netto Vault Access</h2>
      <p className="text-sm text-slate-400 mb-6">
        {step === 'email' 
          ? 'Enter your email to verify identity and unlock your local-first vault.' 
          : `Enter the 6-digit verification code sent to ${email}.`}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {step === 'email' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
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
            disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
          >
            {loading ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Verification Code (OTP)
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-center text-xl tracking-widest text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-medium rounded transition disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Unlock Vault'}
          </button>

          <button
            type="button"
            onClick={() => setStep('email')}
            className="w-full py-1 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
};