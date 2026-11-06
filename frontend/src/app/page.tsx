'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getGoogleLoginUrl } from '@/lib/api';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // If token is in URL (redirected from backend), store it and go to dashboard
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      router.push('/dashboard');
      return;
    }

    // If already has token, redirect to dashboard
    const existingToken = localStorage.getItem('auth_token');
    if (existingToken) {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  const handleGoogleLogin = () => {
    window.location.href = getGoogleLoginUrl();
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default fallback to Google OAuth for seamless assignment demo
    handleGoogleLogin();
  };

  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
      <div 
        className="w-full max-w-[420px] bg-white rounded-2xl p-8 sm:p-10 shadow-sm"
        style={{ border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-8">
          Login
        </h1>

        {error && (
          <div className="mb-5 p-3 rounded-lg text-xs bg-red-50 text-red-600 border border-red-200">
            Authentication failed. Please try again.
          </div>
        )}

        {/* Google Login button */}
        <button
          id="google-login-btn"
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{ 
            background: '#e8f8f0', 
            border: '1px solid #a7f3d0',
            color: '#047857' 
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#dcfce7')}
          onMouseLeave={e => (e.currentTarget.style.background = '#e8f8f0')}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Login with Google
        </button>

        {/* Divider */}
        <div className="relative my-7 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-3 text-xs text-slate-400 font-medium">
            or sign in with email
          </span>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email Id
            </label>
            <input
              type="email"
              required
              placeholder="e.g. user@reachinbox.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#00a854] transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#00a854] transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-sm"
            style={{ background: '#00a854' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#008f47')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00a854')}>
            Login
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400 mt-6">
          ReachInbox Cold Outreach Platform • Demo Instance
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginContent />
    </Suspense>
  );
}
