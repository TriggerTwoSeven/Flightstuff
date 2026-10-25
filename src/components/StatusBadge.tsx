'use client';

import type { BookingStatus } from '@/lib/schemas';

const STATUS_CONFIG: Record<BookingStatus, {
  label: string;
  bg: string;
  color: string;
  border: string;
  icon: React.ReactNode;
}> = {
  blocked: {
    label: 'Blocked',
    bg: 'var(--red-light)',
    color: 'var(--red)',
    border: 'var(--red-border)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    ),
  },
  review: {
    label: 'Review required',
    bg: 'var(--amber-light)',
    color: 'var(--amber)',
    border: 'var(--amber-border)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
      </svg>
    ),
  },
  clear: {
    label: 'Clear',
    bg: 'var(--green-light)',
    color: 'var(--green)',
    border: 'var(--green-border)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
};

export function StatusBadge({ status, large }: { status: BookingStatus; large?: boolean }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`badge inline-flex items-center gap-1.5 font-semibold animate-fade-in-scale ${large ? 'px-4 py-1.5 text-sm' : ''}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
