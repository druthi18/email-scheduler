import {
  User,
  PaginatedEmailJobs,
  EmailStats,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
  SearchResult,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ── Auth ────────────────────────────────────────────────────────

export function getGoogleLoginUrl(): string {
  return `${API_URL}/auth/google`;
}

export async function fetchCurrentUser(): Promise<{ user: User }> {
  return apiFetch('/auth/me');
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
  localStorage.removeItem('auth_token');
}

// ── Emails ──────────────────────────────────────────────────────

export async function scheduleEmail(data: ScheduleEmailRequest): Promise<ScheduleEmailResponse> {
  return apiFetch('/api/emails/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchScheduledEmails(page = 1): Promise<PaginatedEmailJobs> {
  return apiFetch(`/api/emails/scheduled?page=${page}&limit=20`);
}

export async function fetchSentEmails(page = 1): Promise<PaginatedEmailJobs> {
  return apiFetch(`/api/emails/sent?page=${page}&limit=20`);
}

export async function fetchEmailStats(): Promise<EmailStats> {
  return apiFetch('/api/emails/stats');
}

export async function cancelEmail(id: string): Promise<void> {
  return apiFetch(`/api/emails/${id}`, { method: 'DELETE' });
}

// ── Search ──────────────────────────────────────────────────────

export async function searchEmails(params: {
  q?: string;
  status?: string;
  sender?: string;
  page?: number;
}): Promise<SearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.sender) qs.set('sender', params.sender);
  if (params.page) qs.set('page', String(params.page));
  return apiFetch(`/api/search?${qs.toString()}`);
}

// ── Slack ───────────────────────────────────────────────────────

export function getSlackConnectUrl(): string {
  return `${API_URL}/auth/slack`;
}

export async function disconnectSlack(): Promise<void> {
  return apiFetch('/auth/slack/disconnect', { method: 'DELETE' });
}

// ── Helpers ──────────────────────────────────────────────────────

export function parseRecipientsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)]; // deduplicate
}

export function parseCSV(csvContent: string): string[] {
  return parseRecipientsFromText(csvContent);
}
