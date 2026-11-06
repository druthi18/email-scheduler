'use client';

import { EmailJob } from '@/types';

interface EmailDetailViewProps {
  job: EmailJob;
  onBack: () => void;
}

export default function EmailDetailView({ job, onBack }: EmailDetailViewProps) {
  const recipients = Array.isArray(job.recipients) ? job.recipients : [];
  
  // Parse previews if available
  let previewUrls: [string, string][] = [];
  if (job.etherealPreviewUrl && job.etherealPreviewUrl !== 'REAL_EMAIL_DELIVERED') {
    try {
      if (job.etherealPreviewUrl.startsWith('{')) {
        previewUrls = Object.entries(JSON.parse(job.etherealPreviewUrl));
      } else {
        previewUrls = [[recipients[0] || 'email', job.etherealPreviewUrl]];
      }
    } catch {
      previewUrls = [['email', job.etherealPreviewUrl]];
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Top Header with Back button (Figma Screen 4) */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{job.subject}</span>
              <span className="text-xs font-mono font-normal text-slate-400">| ID: {job.id.slice(0, 8)}</span>
            </h2>
          </div>
        </div>

        {/* Status indicator */}
        <div>
          {job.status === 'SENT' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Sent & Delivered
            </span>
          ) : job.status === 'SCHEDULED' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              ⏰ Scheduled in BullMQ Queue
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
              {job.status}
            </span>
          )}
        </div>
      </div>

      {/* Email metadata */}
      <div className="p-6 border-b border-slate-100 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
          {job.sender ? job.sender[0].toUpperCase() : 'S'}
        </div>
        <div className="flex-1 min-w-0 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 text-sm">
              {job.sender.split('@')[0]}
              <span className="font-normal text-slate-500 ml-2">&lt;{job.sender}&gt;</span>
            </p>
            <span className="text-slate-400">
              {new Date(job.sentAt || job.scheduledAt).toLocaleString()}
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            <strong className="text-slate-600">To:</strong> {recipients.join(', ')}
          </p>
        </div>
      </div>

      {/* Email Body */}
      <div className="p-8 text-sm text-slate-800 leading-relaxed min-h-[220px]">
        <div 
          dangerouslySetInnerHTML={{ __html: (job.body || 'No content provided.').replace(/\n/g, '<br />') }} 
          className="prose max-w-none"
        />
      </div>

      {/* Previews / Attachments Footer (Figma Screen 4) */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-500">Delivery verification:</span>
          {job.etherealPreviewUrl === 'REAL_EMAIL_DELIVERED' ? (
            <span className="font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Delivered directly via Gmail SMTP to recipient's real inbox
            </span>
          ) : previewUrls.length > 0 ? (
            <div className="flex items-center gap-2">
              {previewUrls.map(([recip, url], idx) => (
                <a
                  key={recip}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg font-bold text-white shadow-sm flex items-center gap-1.5"
                  style={{ background: '#00a854' }}>
                  Open Ethereal Preview #{idx + 1} ({recip.split('@')[0]}) ↗
                </a>
              ))}
            </div>
          ) : (
            <span className="text-slate-400">Waiting for trigger time</span>
          )}
        </div>

        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-600">
          Back to List
        </button>
      </div>
    </div>
  );
}
