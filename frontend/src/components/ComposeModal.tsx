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

  const [form, setForm] = useState({
    subject: '',
    body: '',
    sender: senderEmail,
    scheduledAt: toLocalISOString(new Date(Date.now() + 30 * 1000)), // default in 30s
    hourlyLimit: 50,
    delayBetweenSec: 2,
  });

  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawRecipients, setRawRecipients] = useState('');
  const [recipientsFromFile, setRecipientsFromFile] = useState(0);
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

  const handleSubmit = async (scheduleIso?: string) => {
    if (!validate()) return;

    setLoading(true);
    try {
      const sendDate = scheduleIso ? new Date(scheduleIso) : new Date(form.scheduledAt);
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

  // Schedule presets from Figma
  const setPresetTomorrow = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setForm(prev => ({ ...prev, scheduledAt: toLocalISOString(d) }));
    setShowScheduleDropdown(false);
  };

  const setPresetIn30s = () => {
    const d = new Date(Date.now() + 30 * 1000);
    setForm(prev => ({ ...prev, scheduledAt: toLocalISOString(d) }));
    setShowScheduleDropdown(false);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div 
          className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
          style={{ maxHeight: '92vh' }}>
          
          {/* Top Bar (Figma Screen 5) */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h2 className="text-base font-bold text-slate-900">
                Compose New Email
              </h2>
            </div>

            {/* Top-Right Action Buttons */}
            <div className="flex items-center gap-3 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold px-3 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>

              {/* Green Send / Schedule Dropdown (Figma) */}
              <div className="inline-flex rounded-lg shadow-sm" style={{ background: '#00a854' }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSubmit()}
                  className="px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 rounded-l-lg transition-colors flex items-center gap-1.5">
                  {loading ? 'Scheduling...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                  className="px-2.5 py-2 text-white hover:bg-emerald-600 rounded-r-lg border-l border-emerald-400 transition-colors"
                  title="Schedule send">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              </div>

              {/* Schedule Popover (Figma Screen 5 & 6) */}
              {showScheduleDropdown && (
                <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <span className="font-bold text-slate-900">Send Later</span>
                    <button onClick={() => setShowScheduleDropdown(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-500 mb-2">QUICK PRESETS</p>
                  <div className="space-y-1 mb-4">
                    <button
                      type="button"
                      onClick={setPresetIn30s}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-medium flex items-center justify-between">
                      <span>⚡ Send in 30 seconds</span>
                      <span className="text-[10px] text-slate-400">instant test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(8)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between">
                      <span>Tomorrow, 8:00 AM</span>
                      <span className="text-[10px] text-slate-400">Morning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(13)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between">
                      <span>Tomorrow, 1:00 PM</span>
                      <span className="text-[10px] text-slate-400">Afternoon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetTomorrow(18)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between">
                      <span>Tomorrow, 6:00 PM</span>
                      <span className="text-[10px] text-slate-400">Evening</span>
                    </button>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">CUSTOM DATE & TIME</p>
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={form.scheduledAt}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs mb-3 text-slate-800"
                  />

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowScheduleDropdown(false)}
                      className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleDropdown(false)}
                      className="px-3 py-1.5 rounded font-bold text-white bg-[#00a854] hover:bg-emerald-600">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields (Figma Screens 5, 6, 7) */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* From field */}
            <div className="flex items-center gap-3 py-2 border-b border-slate-100 text-xs">
              <span className="w-16 font-semibold text-slate-400">From:</span>
              <div className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-slate-700 text-xs">
                {form.sender}
              </div>
            </div>

            {/* To field with CSV upload */}
            <div className="flex items-start gap-3 py-2 border-b border-slate-100 text-xs">
              <span className="w-16 font-semibold text-slate-400 pt-1.5">To:</span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter recipients (comma-separated)..."
                    value={rawRecipients}
                    onChange={handleRecipientsChange}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00a854]"
                  />
                  <label 
                    htmlFor="csv-upload-input"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer font-semibold text-slate-600 text-[11px] flex items-center gap-1.5 shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload CSV
                    <input id="csv-upload-input" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                {recipients.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ {recipients.length} lead{recipients.length !== 1 ? 's' : ''} detected
                    </span>
                    {recipients.slice(0, 3).map(r => (
                      <span key={r} className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {r}
                      </span>
                    ))}
                    {recipients.length > 3 && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        +{recipients.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {errors.recipients && <p className="text-red-500 text-[11px]">{errors.recipients}</p>}
              </div>
            </div>

            {/* Subject field */}
            <div className="flex items-center gap-3 py-2 border-b border-slate-100 text-xs">
              <span className="w-16 font-semibold text-slate-400">Subject:</span>
              <input
                type="text"
                name="subject"
                placeholder="Subject..."
                value={form.subject}
                onChange={handleChange}
                className="flex-1 py-1 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none"
              />
              {errors.subject && <span className="text-red-500 text-[11px]">{errors.subject}</span>}
            </div>

            {/* Delay & Limit Controls (Figma Screen 5 & 7) */}
            <div className="flex items-center gap-6 py-2 border-b border-slate-100 text-xs text-slate-600 bg-slate-50/50 px-3 rounded-lg">
              <div className="flex items-center gap-2">
                <span>Delay between 2 emails:</span>
                <input
                  type="number"
                  name="delayBetweenSec"
                  value={form.delayBetweenSec}
                  onChange={handleChange}
                  min={1}
                  max={60}
                  className="w-14 px-2 py-1 text-center font-bold bg-white border border-slate-200 rounded text-xs text-slate-800"
                />
                <span>sec</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Hourly limit:</span>
                <input
                  type="number"
                  name="hourlyLimit"
                  value={form.hourlyLimit}
                  onChange={handleChange}
                  min={1}
                  max={500}
                  className="w-16 px-2 py-1 text-center font-bold bg-white border border-slate-200 rounded text-xs text-slate-800"
                />
              </div>

              <div className="ml-auto text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                Scheduled for: {form.scheduledAt.replace('T', ' ')}
              </div>
            </div>

            {/* Body Rich Area */}
            <div className="pt-2">
              <textarea
                name="body"
                placeholder="Type your reply or campaign email here..."
                value={form.body}
                onChange={handleChange}
                rows={8}
                className="w-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
              {errors.body && <p className="text-red-500 text-[11px] mt-1">{errors.body}</p>}
            </div>

            {/* Formatting Toolbar (Figma Screen 5 Bottom Toolbar) */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-slate-400 text-xs">
              <div className="flex items-center gap-3">
                <button type="button" className="hover:text-slate-700 font-bold">↩</button>
                <button type="button" className="hover:text-slate-700 font-bold">↪</button>
                <span className="text-slate-300">|</span>
                <button type="button" className="hover:text-slate-700 font-bold">B</button>
                <button type="button" className="hover:text-slate-700 italic">I</button>
                <button type="button" className="hover:text-slate-700 underline">U</button>
                <button type="button" className="hover:text-slate-700 line-through">S</button>
                <span className="text-slate-300">|</span>
                <button type="button" className="hover:text-slate-700">🔗</button>
                <button type="button" className="hover:text-slate-700">📷</button>
                <button type="button" className="hover:text-slate-700">⠇</button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all"
                  style={{ background: '#00a854' }}>
                  {loading ? 'Sending...' : 'Schedule Campaign'}
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
