import Decimal from 'decimal.js';
import { ORIGIN_COUNTRY } from './constants';
import { evaluateBooking } from './evaluate';
import {
  coerceInterpretation,
  getMissing,
  interpretText,
  isEmptyInterpretation,
  type ExtractedItem,
  type Interpretation,
  type MissingField,
} from './interpreter';
import { normaliseCountryOfOrigin, normaliseDestinationCity, normaliseDestinationType, normaliseOriginCity, normalisePriority, normaliseYesNo, parseDateText, countryForCity } from './normalise';
import { normaliseHsCode } from './rules-engine';
import type { Booking, BookingReport, Item } from './schemas';
import { formatCurrency, generateBookingId, generateSku } from './utils';

/** Everything the desk knows about the booking being described in chat. */
export interface ConvState {
  booking: Partial<Booking>;
  items: Partial<Item>[];
  /** Fields the desk worked out itself, so they update when the facts change. */
  derived: { cartons: boolean; declaredValue: boolean; itemCartons: string[] };
  /** Product details given before any product was named. */
  pendingPatch: ExtractedItem;
  /** Findings the shipper confirmed, as "R-06|SKU". */
  acknowledged: string[];
}

export const PLACEHOLDER_ID = 'BK-0000';

/** Pass PLACEHOLDER_ID when rendering: random IDs are only made in event handlers. */
export function newConversation(bookingId: string = generateBookingId()): ConvState {
  return {
    booking: { bookingId, originCountry: ORIGIN_COUNTRY, currency: 'GBP' },
    items: [],
    derived: { cartons: false, declaredValue: false, itemCartons: [] },
    pendingPatch: {},
    acknowledged: [],
  };
}

export interface ApplyResult {
  state: ConvState;
  /** Plain-language list of what this message changed. */
  captured: string[];
  /** Numbers the desk worked out for itself. */
  calculated: string[];
}

const sameProduct = (a?: string, b?: string) => {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const lastX = x.split(/\s+/).pop()!.replace(/s$/, '');
  const lastY = y.split(/\s+/).pop()!.replace(/s$/, '');
  return lastX.length > 2 && lastX === lastY;
};

function mergeItem(target: Partial<Item>, patch: ExtractedItem, captured: string[], label: string) {
  const set = <K extends keyof Item>(key: K, value: Item[K] | undefined, text: string) => {
    if (value === undefined || value === null) return;
    if (target[key] !== value) captured.push(`${label}: ${text}`);
    target[key] = value;
  };
  if (patch.description && !target.description) target.description = patch.description;
  set('quantity', patch.quantity, `${patch.quantity?.toLocaleString('en-GB')} units`);
  set('unitPrice', patch.unitPrice, `${formatCurrency(patch.unitPrice ?? 0)} each`);
  set('hsCode', patch.hsCode, `HS code ${patch.hsCode}`);
  set('unitsPerCarton', patch.unitsPerCarton, `${patch.unitsPerCarton} per carton`);
  set('cartons', patch.cartons, `${patch.cartons} cartons`);
  set('unitWeight', patch.unitWeight, `${patch.unitWeight} kg each`);
  set('countryOfOrigin', patch.countryOfOrigin, `made in ${patch.countryOfOrigin}`);
}

/** Fold one interpreted message into the conversation. Pure: returns a new state. */
export function applyInterpretation(prev: ConvState, interp: Interpretation): ApplyResult {
  const state: ConvState = {
    ...prev,
    booking: { ...prev.booking },
    items: prev.items.map(i => ({ ...i })),
    derived: { ...prev.derived, itemCartons: [...prev.derived.itemCartons] },
    pendingPatch: { ...prev.pendingPatch },
  };
  const captured: string[] = [];
  const calculated: string[] = [];
  const b = state.booking;
  const x = interp.booking;

  const setB = <K extends keyof Booking>(key: K, value: Booking[K] | undefined, text: string) => {
    if (value === undefined || value === null || value === '') return;
    if (b[key] !== value) captured.push(text);
    b[key] = value;
  };

  setB('sellerName', x.sellerName, `Seller: ${x.sellerName}`);
  setB('originCity', x.originCity, `Origin: ${x.originCity}, UK`);
  if (x.destinationCity) {
    setB('destinationCity', x.destinationCity, `Destination: ${x.destinationCity}, ${x.destinationCountry ?? countryForCity(x.destinationCity)}`);
    b.destinationCountry = x.destinationCountry ?? countryForCity(x.destinationCity) ?? b.destinationCountry;
  } else if (x.destinationCountry && b.destinationCountry !== x.destinationCountry) {
    b.destinationCountry = x.destinationCountry;
    if (b.destinationCity && countryForCity(b.destinationCity) !== x.destinationCountry) b.destinationCity = '';
    captured.push(`Destination country: ${x.destinationCountry}`);
  }
  setB('destinationType', x.destinationType, `Delivering to a ${x.destinationType?.toLowerCase()}`);
  setB('readyToShipDate', x.readyToShipDate, `Ready to ship: ${x.readyToShipDate}`);
  setB('sellerPriority', x.sellerPriority, `Priority: ${x.sellerPriority}`);
  if (x.pallets != null) {
    setB('pallets', x.pallets, `Pallets: ${x.pallets}`);
  }
  if (interp.palletsDelta) {
    const next = Math.max(1, (b.pallets ?? 0) + interp.palletsDelta);
    b.pallets = next;
    captured.push(`Pallets: now ${next}`);
  }
  if (x.cartons != null) {
    setB('cartons', x.cartons, `Cartons: ${x.cartons}`);
    state.derived.cartons = false;
  }
  if (x.totalDeclaredValue != null) {
    setB('totalDeclaredValue', x.totalDeclaredValue, `Declared value: ${formatCurrency(x.totalDeclaredValue)}`);
    state.derived.declaredValue = false;
  }
  setB('totalGrossWeight', x.totalGrossWeight, `Gross weight: ${x.totalGrossWeight?.toLocaleString('en-GB')} kg`);
  setB('deliveryAppointmentBooked', x.deliveryAppointmentBooked, `Delivery appointment: ${x.deliveryAppointmentBooked}`);

  /* products */
  for (const incoming of interp.items) {
    const existing = state.items.find(i => sameProduct(i.description, incoming.description));
    const label = incoming.description ?? 'Product';
    if (existing) {
      mergeItem(existing, incoming, captured, existing.description ?? label);
    } else {
      const fresh: Partial<Item> = {
        bookingId: b.bookingId,
        sku: generateSku(incoming.description ?? 'ITEM'),
        description: incoming.description,
      };
      state.items.push(fresh);
      captured.push(`Product: ${incoming.description}`);
      mergeItem(fresh, incoming, captured, label);
    }
  }
  const patch = interp.itemPatch;
  if (Object.keys(patch).length > 0) {
    const target = state.items[state.items.length - 1];
    if (target) mergeItem(target, patch, captured, target.description ?? 'Product');
    else state.pendingPatch = { ...state.pendingPatch, ...patch };
  }
  if (state.items.length > 0 && Object.keys(state.pendingPatch).length > 0) {
    mergeItem(state.items[state.items.length - 1], state.pendingPatch, captured, state.items[state.items.length - 1].description ?? 'Product');
    state.pendingPatch = {};
  }

  /* work out what can be worked out */
  for (const it of state.items) {
    const sku = it.sku!;
    const stated = it.cartons != null && !state.derived.itemCartons.includes(sku);
    if (!stated && it.quantity != null && it.unitsPerCarton) {
      const cartons = Math.ceil(it.quantity / it.unitsPerCarton);
      if (it.cartons !== cartons) calculated.push(`${it.description}: ${it.quantity.toLocaleString('en-GB')} units at ${it.unitsPerCarton} per carton is ${cartons} cartons`);
      it.cartons = cartons;
      if (!state.derived.itemCartons.includes(sku)) state.derived.itemCartons.push(sku);
    }
  }
  const allCartons = state.items.length > 0 && state.items.every(i => i.cartons != null);
  if ((b.cartons == null || state.derived.cartons) && allCartons) {
    const total = state.items.reduce((s, i) => s + (i.cartons ?? 0), 0);
    if (b.cartons !== total) calculated.push(`Booking cartons: ${total}`);
    b.cartons = total;
    state.derived.cartons = true;
  }
  const allPriced = state.items.length > 0 && state.items.every(i => i.quantity != null && i.unitPrice != null);
  if ((b.totalDeclaredValue == null || state.derived.declaredValue) && allPriced) {
    const total = state.items
      .reduce((s, i) => s.plus(new Decimal(i.quantity!).times(i.unitPrice!)), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();
    if (b.totalDeclaredValue !== total) calculated.push(`Declared value: ${formatCurrency(total)}`);
    b.totalDeclaredValue = total;
    state.derived.declaredValue = true;
  }

  return { state, captured: dedupe(captured), calculated };
}

const dedupe = (a: string[]) => [...new Set(a)];

/** Edits made on the sheet count as stated, so the desk stops recalculating that field. */
export function markStated(state: ConvState, field: 'cartons' | 'totalDeclaredValue'): ConvState {
  return {
    ...state,
    derived: {
      ...state.derived,
      cartons: field === 'cartons' ? false : state.derived.cartons,
      declaredValue: field === 'totalDeclaredValue' ? false : state.derived.declaredValue,
    },
  };
}

/** Build the full, rule-ready booking from what has been captured so far. */
export function toFull(state: ConvState): { booking: Booking; items: Item[] } {
  const p = state.booking;
  const booking: Booking = {
    bookingId: p.bookingId ?? generateBookingId(),
    sellerName: p.sellerName ?? '',
    originCity: p.originCity ?? '',
    originCountry: p.originCountry ?? ORIGIN_COUNTRY,
    destinationCity: p.destinationCity ?? '',
    destinationCountry: p.destinationCountry ?? '',
    destinationType: p.destinationType ?? '',
    readyToShipDate: p.readyToShipDate ?? '',
    sellerPriority: p.sellerPriority ?? '',
    pallets: p.pallets ?? null,
    cartons: p.cartons ?? null,
    totalDeclaredValue: p.totalDeclaredValue ?? null,
    currency: p.currency ?? 'GBP',
    totalGrossWeight: p.totalGrossWeight ?? null,
    deliveryAppointmentBooked: p.deliveryAppointmentBooked ?? '',
  };
  const items: Item[] = state.items.map(i => ({
    bookingId: booking.bookingId,
    sku: i.sku ?? generateSku(i.description ?? 'ITEM'),
    description: i.description ?? '',
    hsCode: i.hsCode ?? null,
    quantity: i.quantity ?? null,
    unitPrice: i.unitPrice ?? null,
    unitsPerCarton: i.unitsPerCarton ?? null,
    cartons: i.cartons ?? null,
    unitWeight: i.unitWeight ?? null,
    countryOfOrigin: i.countryOfOrigin ?? null,
  }));
  return { booking, items };
}

export function buildReport(state: ConvState): BookingReport {
  const { booking, items } = toFull(state);
  return evaluateBooking(booking, items, [], state.acknowledged);
}

/** Take a finished report (after edits or quick fixes) back into conversation state. */
export function stateFromReport(prev: ConvState, report: BookingReport): ConvState {
  // A number the person typed or fixed by hand stops being "worked out", so a
  // later message does not quietly overwrite it.
  const changedItemCartons = report.items
    .filter(i => prev.items.find(p => p.sku === i.sku)?.cartons !== i.cartons)
    .map(i => i.sku);
  return {
    ...prev,
    booking: { ...report.booking },
    items: report.items.map(i => ({ ...i })),
    acknowledged: report.acknowledged ?? prev.acknowledged,
    derived: {
      cartons: prev.derived.cartons && report.booking.cartons === prev.booking.cartons,
      declaredValue: prev.derived.declaredValue && report.booking.totalDeclaredValue === prev.booking.totalDeclaredValue,
      itemCartons: prev.derived.itemCartons.filter(sku => !changedItemCartons.includes(sku)),
    },
  };
}

/* ------------------------------------------------- reading short answers */

/**
 * People answer a question with one word or number ("Yes", "3", "620 kg").
 * When the desk just asked for a specific field, read the reply as that field.
 */
export function interpretAnswer(text: string, pending: MissingField | null, now: Date = new Date()): Interpretation | null {
  if (!pending) return null;
  const t = text.trim();
  if (!t) return null;
  const out: Interpretation = { booking: {}, items: [], itemPatch: {}, unsupported: [] };
  const numeric = t.match(/^£?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:kg|kgs|units?|pallets?|cartons?|gbp|pounds)?\.?$/i);
  const n = numeric ? Number(numeric[1].replace(/,/g, '')) : undefined;
  const itemKey = pending.key.startsWith('item') ? pending.key.split('.')[1] : undefined;

  switch (pending.key) {
    case 'originCity': { const v = normaliseOriginCity(t); if (!v) return null; out.booking.originCity = v; return out; }
    case 'destinationCity': { const v = normaliseDestinationCity(t); if (!v) return null; out.booking.destinationCity = v; out.booking.destinationCountry = countryForCity(v); return out; }
    case 'destinationType': { const v = normaliseDestinationType(t); if (!v) return null; out.booking.destinationType = v; return out; }
    case 'sellerPriority': { const v = normalisePriority(t); if (!v) return null; out.booking.sellerPriority = v; return out; }
    case 'readyToShipDate': { const v = parseDateText(t, now); if (!v) return null; out.booking.readyToShipDate = v; return out; }
    case 'deliveryAppointmentBooked': { const v = normaliseYesNo(t); if (!v) return null; out.booking.deliveryAppointmentBooked = v; return out; }
    case 'pallets': if (n == null) return null; out.booking.pallets = n; return out;
    case 'totalGrossWeight': if (n == null) return null; out.booking.totalGrossWeight = n; return out;
  }
  if (itemKey === 'hsCode') {
    if (!/^[\d\s.\-]{4,16}$/.test(t)) return null;
    out.itemPatch.hsCode = normaliseHsCode(t);
    return out;
  }
  if (itemKey === 'countryOfOrigin') {
    const v = normaliseCountryOfOrigin(t);
    if (!v) return null;
    out.itemPatch.countryOfOrigin = v;
    return out;
  }
  if (itemKey && n != null && ['quantity', 'unitPrice', 'unitsPerCarton', 'unitWeight'].includes(itemKey)) {
    (out.itemPatch as Record<string, number>)[itemKey] = n;
    return out;
  }
  return null;
}

/* --------------------------------------------------------- one full turn */

export type Reader = 'ai' | 'builtin';

export interface TurnResult {
  state: ConvState;
  report: BookingReport;
  captured: string[];
  calculated: string[];
  unsupported: string[];
  understood: boolean;
  missing: MissingField[];
  reader: Reader;
}

/**
 * Handle one message. `ai` is the optional model's interpretation of the text;
 * when it is absent or empty the built-in reader is used, so the desk never
 * depends on an API key.
 */
export function runTurn(
  prev: ConvState,
  text: string,
  pending: MissingField | null,
  ai: Interpretation | null,
  now: Date = new Date(),
): TurnResult {
  const ctx = { pallets: prev.booking.pallets ?? null, hasItems: prev.items.length > 0 };
  let interp = interpretAnswer(text, pending, now);
  let reader: Reader = 'builtin';
  if (!interp) {
    const local = interpretText(text, ctx, now);
    if (ai && !isEmptyInterpretation(ai)) {
      interp = { ...ai, unsupported: [...new Set([...ai.unsupported, ...local.unsupported])] };
      reader = 'ai';
    } else {
      interp = local;
    }
  }
  const applied = applyInterpretation(prev, interp);
  const report = buildReport(applied.state);
  return {
    state: applied.state,
    report,
    captured: applied.captured,
    calculated: applied.calculated,
    unsupported: interp.unsupported,
    understood: !isEmptyInterpretation(interp),
    missing: getMissing(applied.state.booking, applied.state.items),
    reader,
  };
}

export { coerceInterpretation };
