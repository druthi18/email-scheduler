'use client';

import { useState, useCallback } from 'react';
import { scheduleEmail, parseCSV } from '@/lib/api';
import { Button, Input, Textarea, Toast } from './ui';

interface ComposeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function ComposeModal({ onClose, onSuccess }: ComposeModalProps) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [form, setForm] = useState({
    subject: '',
    body: '',
    sender: '',
    scheduledAt: toLocalISOString(new Date(Date.now() + 2 * 60_000)),
    hourlyLimit: 50,
    delayBetweenMs: 2000,
  });
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawRecipients, setRawRecipients] = useState('');
  const [recipientsFromFile, setRecipientsFromFile] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleRecipientsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawRecipients(val);
    const parsed = parseCSV(val);
    setRecipients(parsed);
    setRecipientsFromFile(0);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setRecipients(parsed);
      setRecipientsFromFile(parsed.length);
      setRawRecipients('');
    };
    reader.readAsText(file);
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.subject.trim()) newErrors.subject = 'Subject is required';
    if (!form.body.trim()) newErrors.body = 'Body is required';
    if (!form.sender.trim()) newErrors.sender = 'Sender email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.sender)) newErrors.sender = 'Invalid email address';
    if (!form.scheduledAt) newErrors.scheduledAt = 'Schedule time is required';
    else if (new Date(form.scheduledAt) <= new Date()) newErrors.scheduledAt = 'Must be in the future';
    if (recipients.length === 0) newErrors.recipients = 'At least one recipient required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await scheduleEmail({
        subject: form.subject,
        body: form.body,
        recipients,
        sender: form.sender,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        hourlyLimit: Number(form.hourlyLimit),
        delayBetweenMs: Number(form.delayBetweenMs),
      });

      setToast({ message: `✅ Scheduled ${result.recipientCount} email(s) successfully!`, type: 'success' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      setToast({ message: (error as Error).message || 'Failed to schedule email', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Min datetime in local time
  const minDatetime = toLocalISOString(new Date());

  const setQuickTime = (minutes: number) => {
    const nextTime = new Date(Date.now() + minutes * 60_000);
    setForm(prev => ({ ...prev, scheduledAt: toLocalISOString(nextTime) }));
    if (errors.scheduledAt) setErrors(prev => ({ ...prev, scheduledAt: '' }));
  };

  return (
    <>
      <div className="modal-backdrop backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content overflow-hidden" 
          style={{ 
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--accent-primary)'
          }}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 15px rgba(99,102,241,0.35)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Compose New Campaign</h2>
                <p className="text-xs text-slate-400 mt-0.5">Schedule automated cold emails with BullMQ queue persistence</p>
              </div>
            </div>
            <button
              id="compose-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-all"
              style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}>
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Subject */}
            <Input
              id="email-subject"
              label="Subject"
              name="subject"
              placeholder="e.g. Scaling outreach with AI workflows..."
              value={form.subject}
              onChange={handleChange}
              error={errors.subject}
            />

            {/* Body */}
            <Textarea
              id="email-body"
              label="Email Body"
              name="body"
              placeholder="Write your email content here (HTML supported)..."
              value={form.body}
              onChange={handleChange}
              error={errors.body}
              rows={4}
            />

            {/* Sender */}
            <Input
              id="email-sender"
              label="Sender Email Address"
              name="sender"
              type="email"
              placeholder="e.g. founder@company.com"
              value={form.sender}
              onChange={handleChange}
              error={errors.sender}
              hint="Multiple senders are supported — each receives an isolated fake SMTP inbox"
            />

            {/* Recipients */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Target Recipients & Leads
                </label>
                {recipients.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ✓ {recipients.length} lead{recipients.length !== 1 ? 's' : ''} detected
                  </span>
                )}
              </div>

              {/* File upload dropzone */}
              <label
                htmlFor="csv-upload"
                className="flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200 group"
                style={{ 
                  border: '1.5px dashed var(--border)', 
                  background: 'rgba(255, 255, 255, 0.02)' 
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: 'var(--accent-primary-glow)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary-light)" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200">Upload CSV or Text Lead List</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {recipientsFromFile > 0
                      ? `✓ ${recipientsFromFile} email addresses parsed and deduplicated from file`
                      : 'Auto-extracts emails from columns or raw text'}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-white/5 text-slate-400 group-hover:text-white border border-white/5">
                  Browse
                </span>
                <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>

              <Textarea
                id="recipients-text"
                name="recipients"
                placeholder="Or paste email addresses directly (comma or newline separated)..."
                value={rawRecipients}
                onChange={handleRecipientsChange}
                rows={2}
              />
              {errors.recipients && <p className="text-xs text-red-400 font-medium">{errors.recipients}</p>}
            </div>

            {/* Schedule time */}
            <div>
              <Input
                id="schedule-time"
                label="Scheduled Start Date & Time"
                name="scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={handleChange}
                error={errors.scheduledAt}
                min={minDatetime}
              />
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[11px] font-medium text-slate-400">Quick preset:</span>
                {[
                  { label: '+2 mins', mins: 2 },
                  { label: '+5 mins', mins: 5 },
                  { label: '+15 mins', mins: 15 },
                  { label: '+1 hour', mins: 60 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setQuickTime(preset.mins)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md transition-all"
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      border: '1px solid var(--border)', 
                      color: 'var(--text-secondary)' 
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                      e.currentTarget.style.color = '#ffffff'; 
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; 
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.borderColor = 'var(--border)'; 
                      e.currentTarget.style.color = 'var(--text-secondary)'; 
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; 
                    }}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced settings */}
            <div className="p-4 rounded-xl" 
              style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Rate Limiting & Provider Throttling
                </p>
                <span className="text-[10px] text-slate-500 font-mono">BULLMQ LIMITER</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="hourly-limit"
                  label="Emails / Hour (Sender Limit)"
                  name="hourlyLimit"
                  type="number"
                  value={form.hourlyLimit}
                  onChange={handleChange}
                  min={1}
                  max={1000}
                  hint="Reschedules automatically on quota hit"
                />
                <Input
                  id="delay-between"
                  label="Delay Between Sends (ms)"
                  name="delayBetweenMs"
                  type="number"
                  value={form.delayBetweenMs}
                  onChange={handleChange}
                  min={0}
                  max={60000}
                  hint="Mimics real SMTP provider throttling"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1 text-xs py-2.5" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <button
                id="schedule-submit-btn"
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-2 text-xs font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                style={{ flex: 2 }}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Scheduling Queue...
                  </span>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
                    </svg>
                    Schedule Campaign {recipients.length > 0 ? `(${recipients.length} leads)` : ''}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
