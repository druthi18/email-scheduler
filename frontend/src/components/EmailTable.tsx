'use client';

import { EmailJob } from '@/types';
import { StatusBadge, TableSkeleton, EmptyState, Button } from './ui';
import { cancelEmail } from '@/lib/api';
import { useState } from 'react';

interface EmailTableProps {
  jobs: EmailJob[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onRefresh: () => void;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export default function EmailTable({ jobs, loading, type, onRefresh, pagination }: EmailTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
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
      <EmptyState
        title={isScheduled ? 'No scheduled emails' : 'No sent emails'}
        description={
          isScheduled
            ? 'Your scheduled emails will appear here. Click "Compose New Email" to get started.'
            : 'Emails that have been sent or failed to send will appear here.'
        }
      />
    );
  }

  return (
    <div className="fade-in">
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Recipients</th>
              <th>Subject</th>
              <th>Sender</th>
              {isScheduled ? <th>Scheduled At</th> : <th>Sent At</th>}
              <th>Status</th>
              {!isScheduled && <th>Preview</th>}
              {isScheduled && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={isScheduled ? 6 : 6} />
            ) : (
              jobs.map((job) => {
                const recipientList = Array.isArray(job.recipients) ? job.recipients : [];
                const recipientDisplay = recipientList.length === 1
                  ? recipientList[0]
                  : `${recipientList[0]} +${recipientList.length - 1} more`;

                return (
                  <tr key={job.id}>
                    {/* Recipients */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-primary-light)' }}>
                          {String(recipientList.length).padStart(1, '0')}
                        </div>
                        <span className="text-sm" title={recipientList.join(', ')} style={{ color: 'var(--text-primary)' }}>
                          {truncate(recipientDisplay, 32)}
                        </span>
                      </div>
                    </td>

                    {/* Subject */}
                    <td>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {truncate(job.subject, 40)}
                      </span>
                    </td>

                    {/* Sender */}
                    <td>
                      <span className="text-xs px-2 py-1 rounded-md" 
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {truncate(job.sender, 24)}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {isScheduled ? formatDate(job.scheduledAt) : formatDate(job.sentAt || '')}
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={job.status} />
                    </td>

                    {/* Preview / Actions */}
                    {!isScheduled && (
                      <td>
                        {job.etherealPreviewUrl ? (
                          <a
                            href={job.etherealPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            id={`preview-${job.id}`}
                            className="btn btn-secondary btn-sm text-xs"
                            style={{ color: 'var(--accent-primary-light)' }}>
                            View →
                          </a>
                        ) : job.errorMessage ? (
                          <span className="text-xs" style={{ color: '#f87171' }} title={job.errorMessage}>
                            Error
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    )}

                    {isScheduled && (
                      <td>
                        {(job.status === 'SCHEDULED' || job.status === 'RATE_LIMITED') && (
                          <Button
                            id={`cancel-${job.id}`}
                            variant="danger"
                            size="sm"
                            loading={cancellingId === job.id}
                            onClick={() => handleCancel(job.id)}>
                            Cancel
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Total: <strong style={{ color: 'var(--text-secondary)' }}>{pagination.total}</strong> emails
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}>
              ← Prev
            </Button>
            <span className="flex items-center px-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
