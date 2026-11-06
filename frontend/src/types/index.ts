// ── API Response Types ──────────────────────────────────────────

export type EmailStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RATE_LIMITED'
  | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  slackTeamId?: string;
  slackWebhookUrl?: string;
  hasSlack: boolean;
  createdAt: string;
}

export interface EmailJob {
  id: string;
  subject: string;
  body?: string;
  sender: string;
  recipients: string[];
  scheduledAt: string;
  sentAt?: string;
  status: EmailStatus;
  hourlyLimit: number;
  delayBetweenMs: number;
  etherealPreviewUrl?: string;
  errorMessage?: string;
  createdAt: string;
  jobId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedEmailJobs {
  jobs: EmailJob[];
  pagination: Pagination;
}

export interface EmailStats {
  stats: {
    scheduled: number;
    sent: number;
    failed: number;
    rateLimited: number;
    total: number;
  };
  senderStats: Array<{
    sender: string;
    currentHourCount: number;
    limit: number;
    resetInMs: number;
  }>;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  sender: string;
  scheduledAt: string;
  hourlyLimit: number;
  delayBetweenMs: number;
}

export interface ScheduleEmailResponse {
  message: string;
  jobId: string;
  bullJobId: string;
  scheduledAt: string;
  recipientCount: number;
}

export interface SearchResult {
  total: number;
  page: number;
  size: number;
  results: Array<EmailJob & { id: string; score?: number }>;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
