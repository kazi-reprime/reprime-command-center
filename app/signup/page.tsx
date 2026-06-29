'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invite token is missing from the URL.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to complete registration.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E3470] text-white font-sans p-6">
        <div className="max-w-md w-full bg-[#123e80] border border-red-500 rounded-lg p-8 shadow-xl text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Invalid Access Link</h2>
          <p className="text-gray-300">
            This signup page requires an invite token. Please click the custom registration link sent by your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E3470] font-sans p-6 text-white">
      <div className="max-w-md w-full bg-[#123e80]/80 backdrop-blur-md border border-[#FFCC33]/30 rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#FFCC33]">Command Center</h1>
          <p className="text-sm text-gray-300 mt-2">Activate your operator crew account</p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-700 text-red-300 text-sm rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center p-6 bg-green-950/40 border border-green-700 rounded-lg">
            <h3 className="text-xl font-bold text-green-400 mb-2">Account Activated!</h3>
            <p className="text-sm text-gray-300">
              Registration completed successfully. Redirecting you to login page...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#FFCC33] font-semibold mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#08224d] border border-[#FFCC33]/20 focus:border-[#FFCC33] rounded-lg px-4 py-2.5 text-sm outline-none transition"
                placeholder="you@reprime.com"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#FFCC33] font-semibold mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#08224d] border border-[#FFCC33]/20 focus:border-[#FFCC33] rounded-lg px-4 py-2.5 text-sm outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#FFCC33] font-semibold mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#08224d] border border-[#FFCC33]/20 focus:border-[#FFCC33] rounded-lg px-4 py-2.5 text-sm outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFCC33] hover:bg-[#ffe066] text-[#0E3470] font-bold rounded-lg py-3 text-sm transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Activating Account...' : 'Complete Activation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0E3470] text-white">
        <p className="text-sm">Loading signup details...</p>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
