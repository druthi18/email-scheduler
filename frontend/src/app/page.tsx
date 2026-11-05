'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getGoogleLoginUrl } from '@/lib/api';
import { Suspense } from 'react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" 
      style={{ background: 'var(--bg-primary)' }}>
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md mx-4 my-8 flex flex-col items-center">
        {/* Logo area */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 6L12 13L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            ReachInbox
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Email Scheduler Dashboard
          </p>
        </div>

        {/* Login card */}
        <div className="glass rounded-2xl p-8 w-full" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Schedule emails at scale with AI-powered workflows
          </p>

          {error && (
            <div className="mb-6 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              Authentication failed. Please try again.
            </div>
          )}

          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            className="btn btn-secondary w-full mb-4"
            style={{ padding: '14px 20px', fontSize: '15px', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Features list */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
              What you get
            </p>
            <ul className="space-y-3">
              {[
                { icon: '⚡', text: 'BullMQ-powered reliable scheduling' },
                { icon: '📊', text: 'Real-time queue visibility dashboard' },
                { icon: '🔒', text: 'Rate limiting with Slack alerts' },
                { icon: '🔍', text: 'Elasticsearch email search' },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="text-base">{feature.icon}</span>
                  {feature.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="skeleton w-16 h-16 rounded-2xl" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
