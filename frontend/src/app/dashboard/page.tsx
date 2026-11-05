'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchScheduledEmails,
  fetchSentEmails,
  fetchEmailStats,
  searchEmails,
} from '@/lib/api';
import { User, EmailJob, Pagination, EmailStats } from '@/types';
import Header from '@/components/Header';
import EmailTable from '@/components/EmailTable';
import ComposeModal from '@/components/ComposeModal';
import { Button, Skeleton, Toast } from '@/components/ui';

type Tab = 'scheduled' | 'sent';

function StatsCard({
  label, value, color, icon, subtitle,
}: {
  label: string; value: number; color: string; icon: string; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl p-6 flex items-center gap-5 fade-in group transition-all duration-300 hover:-translate-y-1"
      style={{ 
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.01) 100%), var(--bg-card)', 
        border: '1px solid var(--border)',
        borderTop: `3px solid ${color}`,
        boxShadow: '0 8px 30px -4px rgba(0, 0, 0, 0.45)'
      }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{ 
          background: color + '15', 
          border: `1px solid ${color}33`,
          boxShadow: `0 0 20px ${color}1a`
        }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-black mt-1 tracking-tight" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1 truncate font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [scheduledPagination, setScheduledPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [sentPagination, setSentPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [tableLoading, setTableLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailJob[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    const token = searchParams.get('token') || localStorage.getItem('auth_token');
    if (!token) {
      router.push('/');
      return;
    }
    if (searchParams.get('token')) {
      localStorage.setItem('auth_token', token);
    }

    fetchCurrentUser()
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem('auth_token');
        router.push('/');
      })
      .finally(() => setAuthLoading(false));
  }, [router, searchParams]);

  // Handle Slack connection callback
  useEffect(() => {
    if (searchParams.get('slack_connected') === 'true') {
      setToast({ message: '✅ Slack connected successfully! Rate limit alerts will now be sent to your Slack.', type: 'success' });
      setUser(prev => prev ? { ...prev, hasSlack: true } : prev);
    } else if (searchParams.get('slack_error')) {
      setToast({ message: '❌ Failed to connect Slack. Please try again.', type: 'error' });
    }
  }, [searchParams]);

  // ── Data Fetching ─────────────────────────────────────────────
  const loadScheduled = useCallback(async (page = 1) => {
    setTableLoading(true);
    try {
      const data = await fetchScheduledEmails(page);
      setScheduledJobs(data.jobs);
      setScheduledPagination(data.pagination);
    } finally {
      setTableLoading(false);
    }
  }, []);

  const loadSent = useCallback(async (page = 1) => {
    setTableLoading(true);
    try {
      const data = await fetchSentEmails(page);
      setSentJobs(data.jobs);
      setSentPagination(data.pagination);
    } finally {
      setTableLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchEmailStats();
      setStats(data);
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadScheduled();
    loadStats();
  }, [user, loadScheduled, loadStats]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'sent') loadSent();
    else loadScheduled();
  }, [activeTab, user, loadSent, loadScheduled]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadScheduled();
      loadStats();
      if (activeTab === 'sent') loadSent();
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, activeTab, loadScheduled, loadSent, loadStats]);

  // ── Search ────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchEmails({ q });
      setSearchResults(results.results as EmailJob[]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults(null);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(searchQuery);
  };

  // ── Render ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayJobs = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled' ? scheduledJobs : sentJobs;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Header user={user} onUserUpdate={setUser} />

      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'var(--gradient-glow)', zIndex: 0 }} />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-12 space-y-9">
        {/* Page title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 fade-in">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Email Dashboard
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                BullMQ Active
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Manage your scheduled email campaigns, persistent Redis queues, and delivery logs
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatsCard label="Scheduled" value={stats.stats.scheduled} color="#6366f1" icon="⏰" subtitle="Waiting in BullMQ queue" />
            <StatsCard label="Sent" value={stats.stats.sent} color="#10b981" icon="✉️" subtitle="Delivered via Ethereal SMTP" />
            <StatsCard label="Failed" value={stats.stats.failed} color="#ef4444" icon="❌" subtitle="Bounce / delivery errors" />
            <StatsCard label="Rate Limited" value={stats.stats.rateLimited} color="#f59e0b" icon="⏱️" subtitle="Rescheduled to next hour" />
          </div>
        )}

        {/* Sender rate limit monitor */}
        {stats && stats.senderStats.length > 0 && (
          <div className="p-6 rounded-2xl fade-in"
            style={{ 
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, rgba(255, 255, 255, 0) 100%), var(--bg-card)', 
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px -4px rgba(0, 0, 0, 0.4)'
            }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  SMTP Provider Quota Monitor
                </p>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full text-slate-400 bg-white/5 border border-white/5 font-medium">
                  Hourly Sliding Window
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Auto-reschedules without dropping jobs • Multi-worker safe
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {stats.senderStats.map((s) => {
                const percentage = Math.min((s.currentHourCount / s.limit) * 100, 100);
                const isNearLimit = percentage >= 80;
                const minutesLeft = Math.ceil(s.resetInMs / 60_000);

                return (
                  <div key={s.sender} className="p-4 rounded-xl flex flex-col gap-2.5"
                    style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[220px]" title={s.sender}>
                        {s.sender}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-200">
                          {s.currentHourCount} <span className="text-slate-500 font-normal">/ {s.limit} emails</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                          {minutesLeft}m left
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full overflow-hidden bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          background: isNearLimit 
                            ? 'linear-gradient(90deg, #f59e0b, #ef4444)' 
                            : 'var(--gradient-primary)',
                          boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign Management Toolbar & Table section */}
        <div className="space-y-6 pt-2">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Segmented Tabs */}
            <div className="flex p-1.5 rounded-xl gap-1" 
              style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)'
              }}>
              {(['scheduled', 'sent'] as Tab[]).map((tab) => {
                const isActive = activeTab === tab;
                const count = tab === 'scheduled' ? stats?.stats.scheduled : stats?.stats.sent;

                return (
                  <button
                    key={tab}
                    id={`tab-${tab}`}
                    onClick={() => { setActiveTab(tab); setSearchResults(null); setSearchQuery(''); }}
                    className="relative px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2"
                    style={{
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      background: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                      border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                      boxShadow: isActive ? '0 2px 12px rgba(99,102,241,0.25)' : 'none'
                    }}>
                    <span>{tab === 'scheduled' ? '⏰ Scheduled' : '✉️ Sent'}</span>
                    {count !== undefined && count > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full"
                        style={{ 
                          background: isActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)', 
                          color: isActive ? '#c7d2fe' : 'var(--text-muted)' 
                        }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                id="email-search"
                type="text"
                placeholder="Search emails or leads..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className="form-input text-xs pr-14"
                style={{ 
                  width: '100%',
                  minWidth: '220px', 
                  paddingLeft: '34px',
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: 'var(--border)'
                }}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2"
                width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300">
                  ×
                </button>
              )}
              {searchLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--text-muted)" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-primary-light)" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 bg-white/5 px-1 py-0.5 rounded border border-white/5 pointer-events-none">
                  ↵
                </span>
              )}
            </div>

            {/* Refresh */}
            <Button
              id="refresh-btn"
              variant="secondary"
              size="sm"
              onClick={() => { activeTab === 'scheduled' ? loadScheduled() : loadSent(); loadStats(); }}
              style={{ background: 'rgba(255, 255, 255, 0.03)', borderColor: 'var(--border)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {/* Compose */}
            <button
              id="compose-btn"
              onClick={() => setComposeOpen(true)}
              className="btn btn-primary text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Compose New Email
            </button>
          </div>
        </div>

        {/* Search results indicator */}
        {searchResults !== null && (
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{searchResults.length}</strong> search results for "{searchQuery}"
            </p>
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="text-xs underline"
              style={{ color: 'var(--accent-primary-light)' }}>
              Clear search
            </button>
          </div>
        )}

          {/* Table */}
          <EmailTable
            jobs={displayJobs}
            loading={tableLoading}
            type={activeTab}
            onRefresh={() => { activeTab === 'scheduled' ? loadScheduled() : loadSent(); loadStats(); }}
            pagination={
              searchResults === null
                ? {
                  page: activeTab === 'scheduled' ? scheduledPagination.page : sentPagination.page,
                  totalPages: activeTab === 'scheduled' ? scheduledPagination.totalPages : sentPagination.totalPages,
                  total: activeTab === 'scheduled' ? scheduledPagination.total : sentPagination.total,
                  onPageChange: (p) => activeTab === 'scheduled' ? loadScheduled(p) : loadSent(p),
                }
                : undefined
            }
          />
        </div>
      </main>

      {/* Compose Modal */}
      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSuccess={() => { loadScheduled(); loadStats(); }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Skeleton className="w-16 h-16 rounded-2xl" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
