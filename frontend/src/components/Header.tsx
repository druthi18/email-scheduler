'use client';

import { User } from '@/types';
import { logout, getSlackConnectUrl, disconnectSlack } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface HeaderProps {
  user: User;
  onUserUpdate?: (user: User) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: () => void;
}

export default function Header({ user, onUserUpdate, searchQuery = '', onSearchChange, onSearchSubmit }: HeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem('auth_token');
    router.push('/');
  };

  const handleSlackConnect = () => {
    window.open(getSlackConnectUrl(), '_blank', 'width=600,height=600');
  };

  const handleSlackDisconnect = async () => {
    setSlackLoading(true);
    try {
      await disconnectSlack();
      onUserUpdate?.({ ...user, hasSlack: false, slackTeamId: undefined, slackWebhookUrl: undefined });
    } finally {
      setSlackLoading(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-16">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 w-60">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-base shadow-sm"
            style={{ background: '#00a854' }}>
            O
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-900">
            ONE
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1">
            ReachInbox
          </span>
        </div>

        {/* Center Search Input (Figma Design) */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <svg 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by recipient, subject, or content..."
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearchSubmit?.()}
              className="w-full pl-11 pr-5 py-2.5 rounded-full text-sm bg-slate-50/80 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#00a854] shadow-xs transition-all"
            />
          </div>
        </div>

        {/* Right side status & Avatar */}
        <div className="flex items-center gap-3 w-60 justify-end">
          {/* BullMQ indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </div>

          {/* Queue link */}
          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            title="Open BullMQ Queue Dashboard"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
          </a>

          {/* Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-emerald-500/20"
              style={{ background: '#00a854' }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="font-semibold text-slate-900 truncate">{user.name || 'User'}</p>
                  <p className="text-slate-500 truncate">{user.email}</p>
                </div>
                
                {user.hasSlack ? (
                  <button
                    onClick={handleSlackDisconnect}
                    disabled={slackLoading}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2">
                    Disconnect Slack
                  </button>
                ) : (
                  <button
                    onClick={handleSlackConnect}
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    Connect Slack
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 border-t border-slate-100">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
