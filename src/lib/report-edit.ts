import { evaluateBooking } from './evaluate';
import { setBookingField, setItemField } from './edit';
import { findingKey } from './rules-engine';
import type { QuickFix } from './fixes';
import type { BookingReport, Finding } from './schemas';

export type EditResult = { ok: true; report: BookingReport } | { ok: false; error: string };

const rebuild = (r: BookingReport, booking = r.booking, items = r.items, ack = r.acknowledged ?? []) =>
  evaluateBooking(booking, items, r.dataIssues, ack);

export function editBookingField(r: BookingReport, key: string, raw: string): EditResult {
  const res = setBookingField(r.booking, key, raw);
  if (!res.ok) return res;
  return { ok: true, report: rebuild(r, res.booking) };
}

export function editItemField(r: BookingReport, sku: string, key: string, raw: string): EditResult {
  const item = r.items.find(i => i.sku === sku);
  if (!item) return { ok: false, error: 'That product is no longer on the booking.' };
  const res = setItemField(item, key, raw);
  if (!res.ok) return res;
  // Changing what a product is invalidates any "this is fine" given for it.
  const ack = key === 'description' || key === 'sku' ? (r.acknowledged ?? []).filter(k => !k.endsWith(`|${sku}`)) : r.acknowledged ?? [];
  return { ok: true, report: rebuild(r, r.booking, r.items.map(i => (i.sku === sku ? res.item : i)), ack) };
}

export function applyQuickFix(r: BookingReport, fix: QuickFix): BookingReport {
  const { booking, items } = fix.apply(r.booking, r.items);
  const live = new Set(items.map(i => i.sku));
  const ack = (r.acknowledged ?? []).filter(k => { const sku = k.split('|')[1]; return !sku || live.has(sku); });
  return rebuild(r, booking, items, ack);
}

export function acknowledge(r: BookingReport, f: Finding): BookingReport {
  const key = findingKey(f);
  return rebuild(r, r.booking, r.items, [...new Set([...(r.acknowledged ?? []), key])]);
}

export function unacknowledge(r: BookingReport, f: Finding): BookingReport {
  const key = findingKey(f);
  return rebuild(r, r.booking, r.items, (r.acknowledged ?? []).filter(k => k !== key));
}
