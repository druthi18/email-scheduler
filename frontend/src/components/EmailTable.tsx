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
      <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-3">
          {isScheduled ? '⏰' : '✉️'}
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          {isScheduled ? 'No scheduled emails' : 'No sent emails'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {isScheduled 
            ? 'Emails waiting in the BullMQ queue will appear here. Click "+ Compose" to schedule one.' 
            : 'Emails that have been delivered or failed will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Email List Rows (Figma Spec) */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-24 h-4 bg-slate-200 rounded" />
                <div className="w-48 h-4 bg-slate-200 rounded" />
                <div className="flex-1 h-4 bg-slate-100 rounded" />
                <div className="w-16 h-4 bg-slate-200 rounded" />
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
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors text-xs">
                
                {/* Left: Recipient */}
                <div className="w-48 shrink-0 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">
                    {recipientList[0] ? recipientList[0][0].toUpperCase() : 'T'}
                  </div>
                  <span className="font-semibold text-slate-800 truncate" title={recipientList.join(', ')}>
                    To: {recipientDisplay}
                  </span>
                </div>

                {/* Middle: Badge + Subject + Snippet (Figma Layout) */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  {/* Status badge pill */}
                  {isScheduled ? (
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <span>⏰</span>
                      <span>{formatDate(job.scheduledAt)} | Scheduled</span>
                    </span>
                  ) : job.etherealPreviewUrl === 'REAL_EMAIL_DELIVERED' ? (
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span>✓</span>
                      <span>Delivered via Gmail</span>
                    </span>
                  ) : (
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span>✓</span>
                      <span>Sent (Ethereal)</span>
                    </span>
                  )}

                  {/* Subject & body snippet */}
                  <span className="truncate text-slate-600">
                    <strong className="text-slate-900 font-medium">{job.subject}</strong>
                    <span className="mx-1.5 text-slate-400">—</span>
                    <span className="text-slate-500">{truncate((job.body || '').replace(/<[^>]*>?/gm, ''), 70)}</span>
                  </span>
                </div>

                {/* Right: Date & Actions */}
                <div className="shrink-0 flex items-center gap-3 justify-end text-slate-400">
                  {/* Date */}
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {isScheduled ? formatDate(job.scheduledAt) : formatDate(job.sentAt || '')}
                  </span>

                  {/* Previews if sent */}
                  {!isScheduled && previewUrls.length > 0 && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {previewUrls.slice(0, 2).map(([recip, url], idx) => (
                        <a
                          key={recip}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition-colors"
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
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title="Cancel email">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          <span>Total: <strong>{pagination.total}</strong> emails</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              ← Prev
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
