'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { scheduleEmail, parseCSV } from '@/lib/api';
import { Toast } from './ui';

interface ComposeModalProps {
  onClose: () => void;
  onSuccess: () => void;
  senderEmail?: string;
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

export default function ComposeModal({ onClose, onSuccess, senderEmail = 'druthi180405@gmail.com' }: ComposeModalProps) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);

  // Default to 30 seconds from now for immediate testability
  const [form, setForm] = useState({
    subject: '',
    body: '',
    sender: senderEmail,
    scheduledAt: toLocalISOString(new Date(Date.now() + 30 * 1000)),
    hourlyLimit: 50,
    delayBetweenSec: 2,
  });

  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawRecipients, setRawRecipients] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowScheduleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleRecipientsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawRecipients(val);
    const parsed = parseCSV(val);
    setRecipients(parsed);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setRecipients(parsed);
      setRawRecipients(parsed.join(', '));
    };
    reader.readAsText(file);
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.subject.trim()) newErrors.subject = 'Subject is required';
    if (!form.body.trim()) newErrors.body = 'Body is required';
    if (recipients.length === 0) newErrors.recipients = 'At least one recipient is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (overrideIso?: string) => {
    if (!validate()) return;

    setLoading(true);
    try {
      const sendDate = overrideIso ? new Date(overrideIso) : new Date(form.scheduledAt);
      const scheduledIso = (isNaN(sendDate.getTime()) || sendDate <= new Date())
        ? new Date(Date.now() + 20_000).toISOString()
        : sendDate.toISOString();

      const result = await scheduleEmail({
        subject: form.subject,
        body: form.body,
        recipients,
        sender: form.sender,
        scheduledAt: scheduledIso,
        hourlyLimit: Number(form.hourlyLimit) || 50,
        delayBetweenMs: (Number(form.delayBetweenSec) || 2) * 1000,
      });

      setToast({ message: `✅ Scheduled ${result.recipientCount} email(s) successfully!`, type: 'success' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (error) {
      setToast({ message: (error as Error).message || 'Failed to schedule email', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Schedule Presets (matching Figma Screen 5/6)
  const setPresetTomorrow = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setForm(prev => ({ ...prev, scheduledAt: toLocalISOString(d) }));
    setShowScheduleDropdown(false);
  };

  const setPresetInSeconds = (seconds: number) => {
    const d = new Date(Date.now() + seconds * 1000);
    setForm(prev => ({ ...prev, scheduledAt: toLocalISOString(d) }));
    setShowScheduleDropdown(false);
  };

  // Remaining time calculation
  const targetTime = new Date(form.scheduledAt).getTime();
  const diffSec = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
  const remainingStr = diffSec === 0 
    ? 'Triggering immediately'
    : diffSec < 60 
      ? `in ${diffSec}s` 
      : diffSec < 3600 
        ? `in ${Math.floor(diffSec / 60)}m ${diffSec % 60}s`
        : `in ${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div 
          className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col my-4"
          style={{ maxHeight: '94vh' }}>
          
          {/* Top Bar (Figma Screen 5 Header) */}
          <div className="flex items-center justify-between px-7 py-4.5 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                title="Back to Dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Compose New Email
              </h2>
            </div>

            {/* Top-Right Action Controls */}
            <div className="flex items-center gap-3 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold px-4 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>

              {/* Schedule Popover Trigger Button */}
              <button
                type="button"
                onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center gap-2 text-sm font-semibold"
                title="Send Later Presets">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Send Later</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {/* Green Primary Send Button */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubmit()}
                className="px-6 py-2.5 text-sm font-bold text-white rounded-full transition-all flex items-center gap-2 shadow-sm"
                style={{ background: '#00a854' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#008f47')}
                onMouseLeave={e => (e.currentTarget.style.background = '#00a854')}>
                <span>{loading ? 'Scheduling...' : 'Send'}</span>
              </button>

              {/* Figma Send Later Popover (Screen 5 & 6) */}
              {showScheduleDropdown && (
                <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50 text-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <span className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>⏰</span>
                      <span>Send Later</span>
                    </span>
                    <button onClick={() => setShowScheduleDropdown(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
                  </div>

                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Quick Presets</p>
                  <div className="space-y-1.5 mb-5">
                    <button
                      type="button"
                      onClick={() => setPresetInSeconds(30)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 text-emerald-800 bg-emerald-50/60 font-semibold flex items-center justify-between border border-emerald-200/60">
                      <span>⚡ Send in 30 seconds</span>
                      <span className="text-xs bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-md font-bold">Instant test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(8)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between border border-transparent hover:border-slate-200">
                      <span>Tomorrow, 08:00 AM</span>
                      <span className="text-xs text-slate-400">Morning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(11)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between border border-transparent hover:border-slate-200">
                      <span>Tomorrow, 11:00 AM</span>
                      <span className="text-xs text-slate-400">Midday</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(15)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between border border-transparent hover:border-slate-200">
                      <span>Tomorrow, 03:00 PM</span>
                      <span className="text-xs text-slate-400">Afternoon</span>
                    </button>
                  </div>

                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pick Date & Time</p>
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={form.scheduledAt}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm mb-4 text-slate-800 font-medium focus:outline-none focus:border-[#00a854]"
                  />

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowScheduleDropdown(false)}
                      className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 text-sm">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleDropdown(false)}
                      className="px-5 py-2 rounded-xl font-bold text-white text-sm"
                      style={{ background: '#00a854' }}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields (Figma Screens 5, 6, 7) */}
          <div className="px-8 py-5 space-y-4 overflow-y-auto flex-1">
            {/* From Field */}
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <span className="w-20 font-semibold text-slate-500 text-sm">From:</span>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-sm font-medium">
                <span>{form.sender}</span>
                <span className="text-slate-400 text-xs">▼</span>
              </div>
            </div>

            {/* To Field with CSV upload */}
            <div className="flex items-start gap-4 py-3 border-b border-slate-100">
              <span className="w-20 font-semibold text-slate-500 text-sm pt-2">To:</span>
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Enter recipients (e.g. john@example.com, sara@example.com)..."
                    value={rawRecipients}
                    onChange={handleRecipientsChange}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00a854] shadow-sm"
                  />
                  <label 
                    htmlFor="csv-upload-input"
                    className="px-4 py-2 rounded-xl border border-[#a7f3d0] bg-[#e8f8f0] hover:bg-emerald-100 cursor-pointer font-bold text-[#00a854] text-xs flex items-center gap-2 shrink-0 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload List (CSV)
                    <input id="csv-upload-input" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                {recipients.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                      ✓ {recipients.length} lead{recipients.length !== 1 ? 's' : ''} detected
                    </span>
                    {recipients.slice(0, 4).map(r => (
                      <span key={r} className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                        {r}
                      </span>
                    ))}
                    {recipients.length > 4 && (
                      <span className="text-xs text-slate-500 font-semibold">
                        +{recipients.length - 4} more
                      </span>
                    )}
                  </div>
                )}
                {errors.recipients && <p className="text-red-500 text-xs font-semibold">{errors.recipients}</p>}
              </div>
            </div>

            {/* Subject Field */}
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              <span className="w-20 font-semibold text-slate-500 text-sm">Subject:</span>
              <input
                type="text"
                name="subject"
                placeholder="Subject..."
                value={form.subject}
                onChange={handleChange}
                className="flex-1 py-1.5 px-3 text-base text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none"
              />
              {errors.subject && <span className="text-red-500 text-xs font-semibold">{errors.subject}</span>}
            </div>

            {/* Dedicated Schedule Timer & Rate Limit Section (High Visibility) */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 my-2">
              {/* Row 1: The Schedule Timer */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Schedule Timer:</span>
                  </span>
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={form.scheduledAt}
                    onChange={handleChange}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white text-sm shadow-sm focus:border-[#00a854] focus:ring-1 focus:ring-[#00a854] focus:outline-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setPresetInSeconds(30)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-sm">
                    ⚡ In 30s
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetInSeconds(120)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-sm">
                    +2 mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetInSeconds(300)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-sm">
                    +5 mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTomorrow(8)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-sm">
                    Tomorrow 8 AM
                  </button>
                </div>
              </div>

              {/* Row 2: Delay, Rate Limits & Live Trigger Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3.5 border-t border-slate-200/80 text-sm text-slate-600">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-700">Delay between 2 emails:</span>
                    <input
                      type="number"
                      name="delayBetweenSec"
                      value={form.delayBetweenSec}
                      onChange={handleChange}
                      min={1}
                      max={60}
                      className="w-16 h-9 px-2 text-center font-bold bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:border-[#00a854] focus:outline-none"
                    />
                    <span className="text-slate-500 font-medium">sec</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-700">Hourly limit:</span>
                    <input
                      type="number"
                      name="hourlyLimit"
                      value={form.hourlyLimit}
                      onChange={handleChange}
                      min={1}
                      max={500}
                      className="w-20 h-9 px-2 text-center font-bold bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:border-[#00a854] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live Trigger Status Badge */}
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Triggers {remainingStr}</span>
                </div>
              </div>
            </div>

            {/* Body Rich Textarea */}
            <div className="pt-2">
              <textarea
                name="body"
                placeholder="Type Your Reply or campaign email here..."
                value={form.body}
                onChange={handleChange}
                rows={9}
                className="w-full text-base text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed font-normal p-2"
              />
              {errors.body && <p className="text-red-500 text-xs font-semibold mt-1">{errors.body}</p>}
            </div>

            {/* Bottom Formatting Toolbar (Figma Screen 5/6) */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-slate-500 text-sm">
              <div className="flex items-center gap-4">
                <button type="button" className="hover:text-slate-900 font-bold p-1">↶</button>
                <button type="button" className="hover:text-slate-900 font-bold p-1">↷</button>
                <span className="text-slate-200">|</span>
                <button type="button" className="hover:text-slate-900 font-bold p-1">Tt</button>
                <button type="button" className="hover:text-slate-900 font-bold p-1">B</button>
                <button type="button" className="hover:text-slate-900 italic p-1">I</button>
                <button type="button" className="hover:text-slate-900 underline p-1">U</button>
                <button type="button" className="hover:text-slate-900 line-through p-1">S</button>
                <span className="text-slate-200">|</span>
                <button type="button" className="hover:text-slate-900 p-1">🔗</button>
                <button type="button" className="hover:text-slate-900 p-1">📷</button>
                <button type="button" className="hover:text-slate-900 p-1">❝</button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full text-sm font-bold text-white shadow-md transition-all flex items-center gap-2"
                  style={{ background: '#00a854' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#008f47')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#00a854')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{loading ? 'Scheduling...' : 'Schedule & Send'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
