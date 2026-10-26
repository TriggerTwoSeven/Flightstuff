import type { BookingReport } from './schemas';

export interface SavedBooking {
  key: string;
  savedAt: string;
  source: 'chat' | 'upload';
  report: BookingReport;
}

const KEY = 'readyroute.history.v1';
const MAX = 40;

function read(): SavedBooking[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SavedBooking[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full or blocked: history is a convenience, never a requirement */
  }
}

export function loadHistory(): SavedBooking[] {
  if (typeof window === 'undefined') return [];
  return read();
}

export function saveToHistory(source: SavedBooking['source'], report: BookingReport): SavedBooking[] {
  const key = `${source}:${report.booking.bookingId}`;
  const next = [
    { key, savedAt: new Date().toISOString(), source, report },
    ...read().filter(s => s.key !== key),
  ];
  write(next);
  return next.slice(0, MAX);
}

export function removeFromHistory(key: string): SavedBooking[] {
  const next = read().filter(s => s.key !== key);
  write(next);
  return next;
}

export function clearHistory(): SavedBooking[] {
  write([]);
  return [];
}
