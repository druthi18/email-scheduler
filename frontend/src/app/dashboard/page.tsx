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
import EmailDetailView from '@/components/EmailDetailView';
import ComposeModal from '@/components/ComposeModal';
import { Toast } from '@/components/ui';

type Tab = 'scheduled' | 'sent';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<EmailJob | null>(null);
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
      setToast({ message: '✅ Slack connected successfully! Rate limit alerts will now be sent to Slack.', type: 'success' });
      setUser(prev => prev ? { ...prev, hasSlack: true } : prev);
    } else if (searchParams.get('slack_error')) {
      setToast({ message: '❌ Failed to connect Slack.', type: 'error' });
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
      // stats non-critical
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

  // Auto-refresh every 20 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadScheduled();
      loadStats();
      if (activeTab === 'sent') loadSent();
    }, 20_000);
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#00a854] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayJobs = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled' ? scheduledJobs : sentJobs;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Header (Figma Screens 2, 3) */}
      <Header 
        user={user} 
        onUserUpdate={setUser} 
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (!q.trim()) setSearchResults(null);
        }}
        onSearchSubmit={() => handleSearch(searchQuery)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar (Figma Screens 2, 3) */}
        <aside className="w-68 border-r border-slate-200 bg-white p-6 flex flex-col justify-between shrink-0">
          <div>
            {/* User Account Selector Pill */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/70 mb-6 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.name || 'User'}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <span className="text-slate-400 text-xs">▼</span>
            </div>

            {/* "+ Compose" Button (Figma Screens 2, 3) */}
            <button
              onClick={() => { setSelectedJob(null); setComposeOpen(true); }}
              className="w-full py-3.5 px-5 rounded-full font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 mb-7 shadow-sm"
              style={{ 
                background: '#ffffff', 
                border: '1.5px solid #00a854',
                color: '#00a854',
                boxShadow: '0 2px 10px rgba(0, 168, 84, 0.15)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#00a854';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#00a854';
              }}>
              <span className="text-xl leading-none font-light">+</span>
              <span className="text-sm tracking-wide">Compose</span>
            </button>

            {/* Navigation Tabs (Figma Screens 2, 3) */}
            <nav className="space-y-1.5">
              <button
                onClick={() => { setActiveTab('scheduled'); setSelectedJob(null); setSearchResults(null); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'scheduled'
                    ? 'bg-[#e8f8f0] text-[#00a854]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-base">⏰</span>
                  <span>Scheduled</span>
                </div>
                {stats && stats.stats.scheduled > 0 && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'scheduled' ? 'bg-[#00a854] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {stats.stats.scheduled}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('sent'); setSelectedJob(null); setSearchResults(null); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'sent'
                    ? 'bg-[#e8f8f0] text-[#00a854]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-base">✉️</span>
                  <span>Sent</span>
                </div>
                {stats && stats.stats.sent > 0 && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'sent' ? 'bg-[#00a854] text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {stats.stats.sent}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Rate Limiting / Quota Monitor in Sidebar Footer */}
          {stats && stats.senderStats.length > 0 && (
            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Sender Quota</span>
                <span className="text-[#00a854]">
                  {stats.senderStats[0].currentHourCount}/{stats.senderStats[0].limit}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00a854] rounded-full transition-all"
                  style={{ width: `${Math.min((stats.senderStats[0].currentHourCount / stats.senderStats[0].limit) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Resets in {Math.ceil(stats.senderStats[0].resetInMs / 60000)}m • Sliding window
              </p>
            </div>
          )}
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* If an email is clicked, show Detail View (Figma Screen 4) */}
          {selectedJob ? (
            <EmailDetailView job={selectedJob} onBack={() => setSelectedJob(null)} />
          ) : (
            <div>
              {/* List Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 capitalize">
                    {searchResults !== null ? `Search Results (${searchResults.length})` : activeTab}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeTab === 'scheduled'
                      ? 'Emails scheduled in BullMQ queue waiting to trigger'
                      : 'Delivered campaigns via Gmail SMTP / Ethereal sandbox'}
                  </p>
                </div>

                <button
                  onClick={() => { activeTab === 'scheduled' ? loadScheduled() : loadSent(); loadStats(); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1.5 shadow-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Table / List View (Figma Screens 2, 3) */}
              <EmailTable
                jobs={displayJobs}
                loading={tableLoading}
                type={activeTab}
                onSelectJob={(job) => setSelectedJob(job)}
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
          )}
        </main>
      </div>

      {/* Compose Modal (Figma Screens 5, 6, 7) */}
      {composeOpen && (
        <ComposeModal
          senderEmail={user.email}
          onClose={() => setComposeOpen(false)}
          onSuccess={() => {
            loadScheduled();
            loadStats();
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DashboardContent />
    </Suspense>
  );
}
