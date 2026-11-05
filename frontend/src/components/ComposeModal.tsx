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
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content">
          {/* Header */}
          <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Compose New Email</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Schedule emails to be sent at a specific time</p>
            </div>
            <button
              id="compose-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              ×
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Subject */}
            <Input
              id="email-subject"
              label="Subject"
              name="subject"
              placeholder="Enter email subject..."
              value={form.subject}
              onChange={handleChange}
              error={errors.subject}
            />

            {/* Body */}
            <Textarea
              id="email-body"
              label="Email Body"
              name="body"
              placeholder="Write your email content here..."
              value={form.body}
              onChange={handleChange}
              error={errors.body}
              rows={5}
            />

            {/* Sender */}
            <Input
              id="email-sender"
              label="Sender Email"
              name="sender"
              type="email"
              placeholder="sender@yourdomain.com"
              value={form.sender}
              onChange={handleChange}
              error={errors.sender}
              hint="Multiple senders are supported — each gets an isolated Ethereal account"
            />

            {/* Recipients */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Recipients
              </label>

              {/* File upload */}
              <label
                htmlFor="csv-upload"
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200"
                style={{ border: '1px dashed var(--border)', background: 'var(--bg-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--accent-primary-glow)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary-light)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Upload CSV or text file</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {recipientsFromFile > 0
                      ? `✅ ${recipientsFromFile} email addresses detected`
                      : 'Emails will be extracted automatically'}
                  </p>
                </div>
                <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>

              <Textarea
                id="recipients-text"
                name="recipients"
                placeholder="Or paste email addresses here, separated by commas or newlines..."
                value={rawRecipients}
                onChange={handleRecipientsChange}
                rows={3}
              />

              {recipients.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--accent-success)' }}>
                  ✅ {recipients.length} unique recipient{recipients.length !== 1 ? 's' : ''} detected
                </p>
              )}
              {errors.recipients && <p className="text-xs text-red-400">{errors.recipients}</p>}
            </div>

            {/* Schedule time */}
            <div>
              <Input
                id="schedule-time"
                label="Schedule Date & Time"
                name="scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={handleChange}
                error={errors.scheduledAt}
                min={minDatetime}
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Quick preset:</span>
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
                    className="text-xs px-2.5 py-1 rounded-md transition-colors"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced settings */}
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Advanced Settings
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="hourly-limit"
                  label="Emails/Hour Limit"
                  name="hourlyLimit"
                  type="number"
                  value={form.hourlyLimit}
                  onChange={handleChange}
                  min={1}
                  max={1000}
                  hint="Per sender rate limit"
                />
                <Input
                  id="delay-between"
                  label="Delay Between (ms)"
                  name="delayBetweenMs"
                  type="number"
                  value={form.delayBetweenMs}
                  onChange={handleChange}
                  min={0}
                  max={60000}
                  hint="Min 2000ms recommended"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                id="schedule-submit-btn"
                type="submit"
                variant="primary"
                className="flex-2"
                loading={loading}
                style={{ flex: 2 }}>
                {loading ? 'Scheduling...' : `Schedule ${recipients.length > 0 ? `(${recipients.length} recipients)` : 'Email'}`}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
