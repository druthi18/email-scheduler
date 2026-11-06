'use client';

import { EmailJob } from '@/types';
import { cancelEmail } from '@/lib/api';
import { useState } from 'react';

interface EmailTableProps {
  jobs: EmailJob[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onRefresh: () => void;
  onSelectJob?: (job: EmailJob) => void;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeRemaining(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return 'Triggering now...';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `in ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  return `in ${hr}h ${min % 60}m`;
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export default function EmailTable({ jobs, loading, type, onRefresh, onSelectJob, pagination }: EmailTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Cancel this scheduled email?')) return;
    setCancellingId(id);
    try {
      await cancelEmail(id);
      onRefresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  };

  const isScheduled = type === 'scheduled';

  if (!loading && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4 border border-emerald-100">
          {isScheduled ? '⏰' : '✉️'}
        </div>
        <h3 className="text-base font-bold text-slate-800">
          {isScheduled ? 'No scheduled emails' : 'No sent emails'}
        </h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          {isScheduled 
            ? 'Emails waiting in the BullMQ queue will appear here. Click "+ Compose" to schedule one.' 
            : 'Emails that have been delivered or failed will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Email List Rows (Figma Spec) */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 space-y-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 py-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full" />
                <div className="w-36 h-5 bg-slate-200 rounded" />
                <div className="w-48 h-5 bg-slate-200 rounded" />
                <div className="flex-1 h-5 bg-slate-100 rounded" />
                <div className="w-20 h-5 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          jobs.map((job) => {
            const recipientList = Array.isArray(job.recipients) ? job.recipients : [];
            const recipientDisplay = recipientList.length === 1
              ? recipientList[0]
              : `${recipientList[0]} (+${recipientList.length - 1})`;

            // Parse previews
            let previewUrls: [string, string][] = [];
            if (job.etherealPreviewUrl && job.etherealPreviewUrl !== 'REAL_EMAIL_DELIVERED') {
              try {
                if (job.etherealPreviewUrl.startsWith('{')) {
                  previewUrls = Object.entries(JSON.parse(job.etherealPreviewUrl));
                } else {
                  previewUrls = [[recipientList[0] || 'email', job.etherealPreviewUrl]];
                }
              } catch {
                previewUrls = [['email', job.etherealPreviewUrl]];
              }
            }

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob?.(job)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4.5 hover:bg-slate-50/90 cursor-pointer transition-colors text-sm">
                
                {/* Left: Recipient */}
                <div className="w-52 shrink-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                    {recipientList[0] ? recipientList[0][0].toUpperCase() : 'T'}
                  </div>
                  <span className="font-bold text-slate-800 truncate text-sm" title={recipientList.join(', ')}>
                    To: {recipientDisplay}
                  </span>
                </div>

                {/* Middle: Badge + Subject + Snippet (Figma Layout) */}
                <div className="flex-1 flex items-center gap-3.5 min-w-0">
                  {/* Status badge pill with live countdown timer */}
                  {isScheduled ? (
                    <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>{formatDate(job.scheduledAt)}</span>
                      <span className="bg-amber-200/80 px-2 py-0.5 rounded text-[11px] font-bold text-amber-950">
                        {getTimeRemaining(job.scheduledAt)}
                      </span>
                    </span>
                  ) : job.etherealPreviewUrl === 'REAL_EMAIL_DELIVERED' ? (
                    <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="font-bold">✓</span>
                      <span>Delivered via Gmail</span>
                    </span>
                  ) : (
                    <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="font-bold">✓</span>
                      <span>Sent (Ethereal)</span>
                    </span>
                  )}

                  {/* Subject & body snippet */}
                  <span className="truncate text-slate-600 text-sm">
                    <strong className="text-slate-900 font-bold">{job.subject}</strong>
                    <span className="mx-2 text-slate-300">—</span>
                    <span className="text-slate-500 font-normal">{truncate((job.body || '').replace(/<[^>]*>?/gm, ''), 80)}</span>
                  </span>
                </div>

                {/* Right: Date & Actions */}
                <div className="shrink-0 flex items-center gap-3.5 justify-end text-slate-400">
                  {/* Date */}
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    {isScheduled ? formatDate(job.scheduledAt) : formatDate(job.sentAt || '')}
                  </span>

                  {/* Previews if sent */}
                  {!isScheduled && previewUrls.length > 0 && (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      {previewUrls.slice(0, 2).map(([recip, url], idx) => (
                        <a
                          key={recip}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition-colors"
                          title={`Preview for ${recip}`}>
                          Preview #{idx + 1} ↗
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Cancel button if scheduled */}
                  {isScheduled && (
                    <button
                      onClick={(e) => handleCancel(e, job.id)}
                      disabled={cancellingId === job.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title="Cancel email">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
