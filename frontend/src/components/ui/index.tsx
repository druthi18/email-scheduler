'use client';

import React from 'react';
import { EmailStatus } from '@/types';

interface BadgeProps {
  status: EmailStatus;
}

const statusConfig: Record<EmailStatus, { label: string; className: string; dot: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'badge-scheduled', dot: '#818cf8' },
  PROCESSING: { label: 'Processing', className: 'badge-processing', dot: '#22d3ee' },
  SENT: { label: 'Sent', className: 'badge-sent', dot: '#34d399' },
  FAILED: { label: 'Failed', className: 'badge-failed', dot: '#f87171' },
  RATE_LIMITED: { label: 'Rate Limited', className: 'badge-rate-limited', dot: '#fbbf24' },
  CANCELLED: { label: 'Cancelled', className: 'badge-cancelled', dot: '#94a3b8' },
};

export function StatusBadge({ status }: BadgeProps) {
  const config = statusConfig[status] || statusConfig.SCHEDULED;
  return (
    <span className={`badge ${config.className}`}>
      <span
        className={status === 'PROCESSING' ? 'pulse-dot' : ''}
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: config.dot,
        }}
      />
      {config.label}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', loading, children, className = '', ...props }: ButtonProps) {
  const variantClass = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger' }[variant];
  const sizeClass = { sm: 'btn-sm', md: '', lg: 'btn-lg' }[size];
  return (
    <button className={`btn ${variantClass} ${sizeClass} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <input id={inputId} className={`form-input ${error ? 'border-red-500' : ''} ${className}`} {...props} />
      {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <textarea id={inputId} className={`form-input resize-none ${error ? 'border-red-500' : ''} ${className}`} {...props} />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Skeleton className={`h-4 ${j === 0 ? 'w-32' : j === cols - 1 ? 'w-20' : 'w-24'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#34d399', icon: '✅' },
    error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#f87171', icon: '❌' },
    info: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#818cf8', icon: 'ℹ️' },
  }[type];

  return (
    <div className="toast fixed bottom-6 right-6 z-50 max-w-sm flex items-center gap-3 p-4 rounded-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
      <span>{colors.icon}</span>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 transition-opacity">×</button>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      {action}
    </div>
  );
}
