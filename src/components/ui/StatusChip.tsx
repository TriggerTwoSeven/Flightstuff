import type { BookingStatus } from '@/lib/schemas';

const LABEL: Record<BookingStatus, string> = { blocked: 'Blocked', review: 'Needs review', clear: 'Clear to ship' };

export function StatusChip({ status, large }: { status: BookingStatus; large?: boolean }) {
  return <span className={`chip chip-${status}${large ? ' chip-lg' : ''}`}>{LABEL[status]}</span>;
}

export const statusLabel = (s: BookingStatus) => LABEL[s];
