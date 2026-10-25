'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';

interface BookingRow {
  booking_id: string;
  seller_name: string | null;
  destination_country: string | null;
  status: string;
  pallets: number | null;
  total_declared_value: number | null;
  currency: string | null;
  created_at: string;
  findings_summary: string | null;
}

interface Props {
  onBack: () => void;
}

export function HistoryView({ onBack }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bookings')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setBookings(data);
        else setError(data.error || 'Failed to load');
      })
      .catch(() => setError('Failed to connect'))
      .finally(() => setLoading(false));
  }, []);

  const findingsCount = (row: BookingRow) => {
    try {
      const arr = typeof row.findings_summary === 'string'
        ? JSON.parse(row.findings_summary)
        : row.findings_summary;
      if (!Array.isArray(arr)) return { red: 0, amber: 0 };
      const red = arr.filter((f: { severity?: string }) => f.severity === 'Red').length;
      const amber = arr.filter((f: { severity?: string }) => f.severity === 'Amber').length;
      return { red, amber };
    } catch { return { red: 0, amber: 0 }; }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Booking History</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-subtle)' }}>
            All checked bookings saved to database
          </p>
        </div>
        <button onClick={onBack} className="btn btn-secondary text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
      </div>

      {loading && (
        <div className="card p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--fg-muted)' }}>Loading history...</p>
        </div>
      )}

      {error && (
        <div className="card p-8 text-center" style={{ background: 'var(--status-blocked-bg)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--status-blocked)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p className="font-medium" style={{ color: 'var(--status-blocked)' }}>{error}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Check your database connection</p>
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="card p-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ opacity: 0.4 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="font-medium" style={{ color: 'var(--fg)' }}>No bookings yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Bookings will appear here after you check them via conversation or upload.
          </p>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="card overflow-hidden" style={{ borderRadius: '16px' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Booking ID</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Seller</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Destination</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Status</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Findings</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Value</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fg-subtle)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((row) => {
                  const { red, amber } = findingsCount(row);
                  return (
                    <tr key={row.booking_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                        {row.booking_id}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--fg)' }}>
                        {row.seller_name || '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--fg)' }}>
                        {row.destination_country || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status as 'blocked' | 'review' | 'clear'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {red > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--status-blocked-bg)', color: 'var(--status-blocked)' }}>
                              {red} red
                            </span>
                          )}
                          {amber > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--status-review-bg)', color: 'var(--status-review)' }}>
                              {amber} amber
                            </span>
                          )}
                          {red === 0 && amber === 0 && (
                            <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--fg)' }}>
                        {row.total_declared_value
                          ? `${row.currency === 'GBP' ? '£' : row.currency} ${Number(row.total_declared_value).toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
