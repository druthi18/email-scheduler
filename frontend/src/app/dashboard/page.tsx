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
  label, value, color, icon,
}: {
  label: string; value: number; color: string; icon: string;
}) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4 fade-in"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
        style={{ background: color + '1a', border: `1px solid ${color}33` }}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
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

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-8 fade-in">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Email Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage your scheduled and sent email campaigns
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatsCard label="Scheduled" value={stats.stats.scheduled} color="#6366f1" icon="⏰" />
            <StatsCard label="Sent" value={stats.stats.sent} color="#10b981" icon="✅" />
            <StatsCard label="Failed" value={stats.stats.failed} color="#ef4444" icon="❌" />
            <StatsCard label="Rate Limited" value={stats.stats.rateLimited} color="#f59e0b" icon="⏱️" />
          </div>
        )}

        {/* Sender rate limit info */}
        {stats && stats.senderStats.length > 0 && (
          <div className="mb-6 p-4 rounded-xl fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Sender Rate Limits (this hour)
            </p>
            <div className="flex flex-wrap gap-4">
              {stats.senderStats.map((s) => (
                <div key={s.sender} className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.sender}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((s.currentHourCount / s.limit) * 100, 100)}%`,
                          background: s.currentHourCount >= s.limit ? '#ef4444' : 'var(--gradient-primary)',
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.currentHourCount}/{s.limit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex p-1 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {(['scheduled', 'sent'] as Tab[]).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                onClick={() => { setActiveTab(tab); setSearchResults(null); setSearchQuery(''); }}
                className="relative px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: activeTab === tab ? 'var(--accent-primary-glow)' : 'transparent',
                  border: activeTab === tab ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                }}>
                {tab === 'scheduled' ? '⏰ Scheduled' : '✅ Sent'}
                {tab === 'scheduled' && stats?.stats.scheduled ? (
                  <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full"
                    style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                    {stats.stats.scheduled}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                id="email-search"
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className="form-input text-sm pr-10"
                style={{ width: '220px', paddingLeft: '36px' }}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2"
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--text-muted)" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-primary-light)" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Refresh */}
            <Button
              id="refresh-btn"
              variant="secondary"
              size="sm"
              onClick={() => { activeTab === 'scheduled' ? loadScheduled() : loadSent(); loadStats(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </Button>

            {/* Compose */}
            <Button
              id="compose-btn"
              variant="primary"
              size="sm"
              onClick={() => setComposeOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Compose New Email
            </Button>
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
