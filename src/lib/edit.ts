import {
  ALL_DESTINATION_CITIES,
  DESTINATION_TYPES,
  ITEM_COUNTRIES_OF_ORIGIN,
  ORIGIN_CITIES,
  SELLER_PRIORITIES,
} from './constants';
import type { Booking, Item } from './schemas';
import {
  countryForCity,
  matchAllowed,
  normaliseCountryOfOrigin,
  normaliseDestinationType,
  normalisePriority,
  normaliseYesNo,
  parseDateText,
} from './normalise';

export type FieldKind = 'text' | 'int' | 'money' | 'kg' | 'date' | 'enum' | 'hs';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  hint?: string;
}

export const BOOKING_FIELDS: FieldDef[] = [
  { key: 'sellerName', label: 'Seller', kind: 'text' },
  { key: 'originCity', label: 'Origin city', kind: 'enum', options: ORIGIN_CITIES },
  { key: 'destinationCity', label: 'Destination city', kind: 'enum', options: ALL_DESTINATION_CITIES },
  { key: 'destinationType', label: 'Destination type', kind: 'enum', options: DESTINATION_TYPES },
  { key: 'readyToShipDate', label: 'Ready to ship', kind: 'date', hint: 'DD-MM-YYYY' },
  { key: 'sellerPriority', label: 'Priority', kind: 'enum', options: SELLER_PRIORITIES },
  { key: 'pallets', label: 'Pallets', kind: 'int' },
  { key: 'cartons', label: 'Cartons', kind: 'int' },
  { key: 'totalDeclaredValue', label: 'Declared value', kind: 'money', hint: 'GBP' },
  { key: 'totalGrossWeight', label: 'Gross weight', kind: 'kg', hint: 'kg' },
  { key: 'deliveryAppointmentBooked', label: 'Appointment booked', kind: 'enum', options: ['Yes', 'No'] },
];

export const ITEM_FIELDS: FieldDef[] = [
  { key: 'description', label: 'Description', kind: 'text' },
  { key: 'hsCode', label: 'HS code', kind: 'hs', hint: '6 digits or more' },
  { key: 'quantity', label: 'Quantity', kind: 'int', hint: 'units' },
  { key: 'unitPrice', label: 'Unit price', kind: 'money', hint: 'GBP' },
  { key: 'unitsPerCarton', label: 'Units per carton', kind: 'int' },
  { key: 'cartons', label: 'Cartons', kind: 'int' },
  { key: 'unitWeight', label: 'Unit weight', kind: 'kg', hint: 'kg' },
  { key: 'countryOfOrigin', label: 'Made in', kind: 'enum', options: ITEM_COUNTRIES_OF_ORIGIN },
];

export type ParseResult = { ok: true; value: string | number | null } | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

export function parseFieldValue(def: FieldDef, raw: string): ParseResult {
  const text = raw.trim();
  switch (def.kind) {
    case 'text':
      return { ok: true, value: text };
    case 'hs': {
      if (!text) return { ok: true, value: null };
      if (!/^[\d\s.\-]+$/.test(text)) return fail('Use digits only, for example 6912.00');
      return { ok: true, value: text.replace(/[\s.\-]/g, '') };
    }
    case 'int':
    case 'money':
    case 'kg': {
      if (!text) return { ok: true, value: null };
      const n = Number(text.replace(/[£,\s]|kg$/gi, ''));
      if (!Number.isFinite(n)) return fail('Enter a number');
      if (n < 0) return fail('Cannot be negative');
      if (def.kind === 'int' && !Number.isInteger(n)) return fail('Enter a whole number');
      if (def.key === 'pallets' && n === 0) return fail('At least one pallet');
      return { ok: true, value: n };
    }
    case 'date': {
      if (!text) return { ok: true, value: '' };
      const d = parseDateText(text);
      return d ? { ok: true, value: d } : fail('Use DD-MM-YYYY, for example 05-11-2026');
    }
    case 'enum': {
      if (!text) return { ok: true, value: def.key === 'countryOfOrigin' ? null : '' };
      let v: string | undefined;
      if (def.key === 'sellerPriority') v = normalisePriority(text);
      else if (def.key === 'destinationType') v = normaliseDestinationType(text);
      else if (def.key === 'deliveryAppointmentBooked') v = normaliseYesNo(text);
      else if (def.key === 'countryOfOrigin') v = normaliseCountryOfOrigin(text);
      else v = matchAllowed(text, def.options ?? []);
      return v && (def.options ?? []).includes(v) ? { ok: true, value: v } : fail(`Choose one of: ${(def.options ?? []).join(', ')}`);
    }
  }
}

export function setBookingField(
  booking: Booking,
  key: string,
  raw: string,
): { ok: true; booking: Booking } | { ok: false; error: string } {
  const def = BOOKING_FIELDS.find(f => f.key === key);
  if (!def) return fail('Unknown field') as { ok: false; error: string };
  const r = parseFieldValue(def, raw);
  if (!r.ok) return r;
  const next: Booking = { ...booking, [key]: r.value ?? (def.kind === 'text' || def.kind === 'enum' || def.kind === 'date' ? '' : null) } as Booking;
  if (key === 'destinationCity') next.destinationCountry = countryForCity(String(r.value)) ?? '';
  return { ok: true, booking: next };
}

export function setItemField(
  item: Item,
  key: string,
  raw: string,
): { ok: true; item: Item } | { ok: false; error: string } {
  const def = ITEM_FIELDS.find(f => f.key === key);
  if (!def) return fail('Unknown field') as { ok: false; error: string };
  const r = parseFieldValue(def, raw);
  if (!r.ok) return r;
  return { ok: true, item: { ...item, [key]: r.value } as Item };
}

export function formatField(def: FieldDef, value: unknown): string {
  if (value == null || value === '') return '';
  if (def.kind === 'money') return `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (def.kind === 'kg') return `${Number(value).toLocaleString('en-GB')} kg`;
  if (def.kind === 'int') return Number(value).toLocaleString('en-GB');
  return String(value);
}
