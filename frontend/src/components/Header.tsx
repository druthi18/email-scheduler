'use client';

import { User } from '@/types';
import { logout, getSlackConnectUrl, disconnectSlack } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from './ui';

interface HeaderProps {
  user: User;
  onUserUpdate?: (user: User) => void;
}

export default function Header({ user, onUserUpdate }: HeaderProps) {
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
    <header className="glass sticky top-0 z-40 transition-all duration-300" 
      style={{ 
        borderBottom: '1px solid var(--border)', 
        borderTop: 'none', 
        borderLeft: 'none', 
        borderRight: 'none', 
        borderRadius: 0,
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
      }}>
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center relative group"
            style={{ 
              background: 'var(--gradient-primary)', 
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.45)' 
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 6L12 13L2 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight" 
              style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent' 
              }}>
              ReachInbox
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider" 
              style={{ 
                background: 'rgba(99, 102, 241, 0.15)', 
                color: '#818cf8', 
                border: '1px solid rgba(99, 102, 241, 0.3)' 
              }}>
              Scheduler
            </span>
          </div>

          {/* Engine Live Status Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ml-2"
            style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            BullMQ Live
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* Bull Board link */}
          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            id="bull-board-link"
            className="btn btn-secondary btn-sm flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ 
              color: 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)'
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
            <span className="hidden sm:inline">Queue Dashboard</span>
            <span className="sm:hidden">Queues</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </a>

          {/* Slack connect */}
          {user.hasSlack ? (
            <Button
              id="slack-disconnect-btn"
              variant="secondary"
              size="sm"
              loading={slackLoading}
              onClick={handleSlackDisconnect}
              style={{ 
                color: '#34d399', 
                background: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.3)', 
                fontSize: '12px' 
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Slack Connected
            </Button>
          ) : (
            <Button
              id="slack-connect-btn"
              variant="secondary"
              size="sm"
              onClick={handleSlackConnect}
              style={{ 
                fontSize: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'var(--border)'
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Connect Slack
            </Button>
          )}

          {/* User avatar / profile button */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-xl transition-all duration-200"
              style={{ 
                border: '1px solid var(--border)', 
                background: showDropdown ? 'var(--bg-card-hover)' : 'rgba(255, 255, 255, 0.03)' 
              }}>
              {user.avatar ? (
                <div className="relative">
                  <Image src={user.avatar} alt={user.name} width={28} height={28} className="rounded-lg ring-1 ring-white/10" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#07090e]" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ring-1 ring-white/10"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {user.name}
                </p>
                <p className="text-[11px] leading-none" style={{ color: 'var(--text-muted)' }}>{user.email.split('@')[0]}</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 glass rounded-xl overflow-hidden fade-in z-50"
                style={{ 
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                  border: '1px solid var(--border)'
                }}>
                <div className="p-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Account</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
                </div>
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="w-full text-left p-3 text-xs font-medium flex items-center gap-2 transition-colors duration-150"
                  style={{ color: '#f87171' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
