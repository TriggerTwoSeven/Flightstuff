import {
  ORIGIN_CITIES,
  ALL_DESTINATION_CITIES,
  DESTINATION_COUNTRIES,
} from './constants';
import type { Booking, Item } from './schemas';
import {
  countryForCity,
  normaliseCountryOfOrigin,
  normaliseDestinationCity,
  normaliseDestinationCountry,
  normaliseDestinationType,
  normaliseOriginCity,
  normalisePriority,
  normaliseYesNo,
  parseDateText,
  toNumber,
} from './normalise';
import { normaliseHsCode } from './rules-engine';

/* ------------------------------------------------------------------ types */

export interface ExtractedItem {
  sku?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  hsCode?: string;
  unitsPerCarton?: number;
  cartons?: number;
  unitWeight?: number;
  countryOfOrigin?: string;
}

export interface ExtractedBooking {
  sellerName?: string;
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  destinationType?: string;
  readyToShipDate?: string;
  sellerPriority?: string;
  pallets?: number;
  cartons?: number;
  totalDeclaredValue?: number;
  totalGrossWeight?: number;
  deliveryAppointmentBooked?: string;
}

export interface Interpretation {
  booking: ExtractedBooking;
  /** Products named with a description in this message. */
  items: ExtractedItem[];
  /** Product details given without naming a product ("12 per carton", "HS code 691200"). */
  itemPatch: ExtractedItem;
  /** "add a pallet" style change relative to the current count. */
  palletsDelta?: number;
  /** Things the message mentioned that the desk cannot do. */
  unsupported: string[];
}

export const emptyInterpretation = (): Interpretation => ({
  booking: {},
  items: [],
  itemPatch: {},
  unsupported: [],
});

/* ------------------------------------------------------------ small tools */

const NUM_WORDS = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty';
const NUM = `(?:\\d[\\d,]*(?:\\.\\d+)?|\\b(?:${NUM_WORDS})\\b)`;

const num = (s: string | undefined) => toNumber(s);

function wordMatch(text: string, candidates: readonly string[]): string | undefined {
  for (const c of candidates) {
    const re = new RegExp(`(?<![A-Za-z])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i');
    if (re.test(text)) return c;
  }
  return undefined;
}

/** Remove a matched span so later patterns can't read it again. */
function blank(text: string, m: RegExpMatchArray | null): string {
  if (!m || m.index == null) return text;
  return text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
}

const OTHER_PLACES = [
  'Spain', 'Italy', 'Belgium', 'Poland', 'Ireland', 'Portugal', 'Austria', 'Sweden', 'Denmark',
  'Norway', 'Switzerland', 'Czech Republic', 'Madrid', 'Barcelona', 'Milan', 'Rome', 'Brussels',
  'Dublin', 'Warsaw', 'Vienna', 'Stockholm', 'Copenhagen', 'Munich', 'Cologne', 'Marseille',
];

const NOT_PRODUCTS = new Set([
  'pallet', 'pallets', 'carton', 'cartons', 'kg', 'kilos', 'kilogram', 'kilograms', 'units', 'unit',
  'pieces', 'piece', 'pcs', 'items', 'item', 'boxes', 'box', 'days', 'day', 'weeks', 'week', 'pounds',
  'pound', 'gbp', 'percent', 'hours', 'hour', 'each', 'per', 'of', 'them', 'more', 'extra', 'another',
]);

const STOP_WORDS = /\s+(?:from|to|at|for|each|per|on|by|in|and|with|ready|priced|via|into|out|around|about|that|which|weighing|weighs|worth)\b.*$/i;

const LEADING_FILLER = /^(?:of|the|some|my|our|these|those|total|units?\s+of|pieces?\s+of|pcs\s+of)\s+/i;

function cleanDescription(raw: string): string {
  let d = raw.trim().replace(/[.,;:]+$/, '');
  for (let i = 0; i < 3; i++) d = d.replace(LEADING_FILLER, '');
  d = d.replace(STOP_WORDS, '').replace(/\s+/g, ' ').trim();
  return d;
}

function looksLikeProduct(desc: string): boolean {
  if (desc.length < 3) return false;
  const words = desc.toLowerCase().split(/\s+/);
  const last = words[words.length - 1];
  if (NOT_PRODUCTS.has(last)) return false;
  if (words.every(w => NOT_PRODUCTS.has(w))) return false;
  if (/^(ready|due|on|by|at|in|to|from|and|but|with|for|priority|priced)\b/.test(desc.toLowerCase())) return false;
  if (wordMatch(desc, [...ORIGIN_CITIES, ...ALL_DESTINATION_CITIES, ...DESTINATION_COUNTRIES])) return false;
  return true;
}

/* ------------------------------------------------------------ the parser */

/**
 * Rule-based reading of a shipment description. It is deliberately forgiving:
 * it only returns what it is confident about, and the UI asks for the rest.
 * Dates, numbers and names are all normalised to the values the rules expect.
 */
export function interpretText(
  input: string,
  context?: { pallets?: number | null; hasItems?: boolean },
  now: Date = new Date(),
): Interpretation {
  const out = emptyInterpretation();
  const original = input.replace(/\s+/g, ' ').trim();
  if (!original) return out;
  let text = ` ${original} `;

  /* seller */
  const sellerTrigger = /(?:\bI run|\bI own|\bI work (?:for|at)|\bwe(?:'re| are)|\bcompany is(?: called)?|\bbusiness is(?: called)?|\bseller(?: name)?(?: is|:)|\bI(?:'m| am) (?:from|with|at)|\bthis is|\bwe(?:'re| are) called|\bfrom the (?:team )?at)\s+/i;
  const st = text.match(sellerTrigger);
  if (st && st.index != null) {
    const rest = text.slice(st.index + st[0].length);
    const name = rest.match(/^((?:[A-Z][\w&'’-]*)(?:\s+(?:[A-Z&][\w&'’-]*|&|and\s+(?=[A-Z])))*)/);
    if (name && name[1].trim().length > 2 && !/^(Manchester|London|Birmingham|Leeds)$/.test(name[1].trim())) {
      out.booking.sellerName = name[1].replace(/\s+(?:and|&)\s*$/, '').trim();
    }
  }

  /* places */
  const originCity = wordMatch(text, ORIGIN_CITIES);
  if (originCity) out.booking.originCity = originCity;

  const destCity = wordMatch(text, ALL_DESTINATION_CITIES);
  if (destCity) {
    out.booking.destinationCity = destCity;
    out.booking.destinationCountry = countryForCity(destCity);
  }
  const countryWord = wordMatch(text, [...DESTINATION_COUNTRIES, 'Holland', 'the Netherlands']);
  if (countryWord) {
    const c = normaliseDestinationCountry(countryWord.replace(/^the /i, ''));
    if (c && (!out.booking.destinationCountry || out.booking.destinationCountry === c)) {
      out.booking.destinationCountry = c;
    }
  }

  const other = wordMatch(text, OTHER_PLACES);
  if (other) {
    out.unsupported.push(`${other} isn't covered by the rate card. I can check routes to Germany, France and the Netherlands.`);
  }

  /* destination type */
  const dt = text.match(/\b(warehouses?|depots?|fulfil?ment cent(?:re|er)s?|distribution cent(?:re|er)s?|business address|office|shop|store|residential|home address)\b/i);
  if (dt) out.booking.destinationType = normaliseDestinationType(dt[1]);

  /* priority */
  const pr = text.match(/\b(cheapest|cheap|lowest cost|fastest|quickest|fast|most reliable|reliable|on[- ]time|balanced|balance)\b/i);
  if (pr) out.booking.sellerPriority = normalisePriority(pr[1]);

  /* appointment */
  if (/\b(?:no|not|haven't|hasn't|without|yet to|still need(?:s)? to|need(?:s)? to)\b[^.;]{0,25}\bappointment\b|\bappointment\b[^.;]{0,25}\b(?:not|no\b|pending|yet|missing|none)/i.test(text)) {
    out.booking.deliveryAppointmentBooked = 'No';
  } else if (/\bappointment\b[^.;]{0,30}\b(?:booked|confirmed|arranged|set|made|yes|done)\b|\b(?:booked|confirmed|arranged)\b[^.;]{0,15}\b(?:delivery )?(?:slot|appointment)\b/i.test(text)) {
    out.booking.deliveryAppointmentBooked = 'Yes';
  }

  /* date */
  const date = parseDateText(original, now);
  if (date) out.booking.readyToShipDate = date;
  // Keep dates from being mistaken for quantities below.
  text = text
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g, m => ' '.repeat(m.length))
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, m => ' '.repeat(m.length))
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+\d{4})?/gi, m => ' '.repeat(m.length))
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/gi, m => ' '.repeat(m.length));

  /* HS code */
  const hs = text.match(/\bhs(?:\s*code)?\s*(?:is|=|:)?\s*(\d[\d .]{3,14}\d)/i);
  if (hs) {
    out.itemPatch.hsCode = normaliseHsCode(hs[1]);
    text = blank(text, hs);
  }

  /* country of origin */
  const coo = text.match(/(?:made in|manufactured in|produced in|(?:country of )?origin(?: is|:)?|comes? from|sourced from)\s+(?:the\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (coo) {
    const words = coo[1].split(/\s+/);
    const guess = normaliseCountryOfOrigin(coo[1]) ?? normaliseCountryOfOrigin(words[0]);
    if (guess) out.itemPatch.countryOfOrigin = guess;
  }

  /* pallets: absolute and relative */
  const palletDelta = text.match(new RegExp(`\\b(?:add|adding|plus|with|need|another|one more|extra)\\s*(${NUM})?\\s*(?:more\\s+|extra\\s+|additional\\s+|another\\s+)?pallets?\\b`, 'i'));
  const palletsAbs = text.match(new RegExp(`(${NUM})\\s*(?:x\\s*)?(?:euro\\s+)?pallets?\\b`, 'i')) ||
    text.match(new RegExp(`\\bpallets?\\s*(?:is|are|=|:|of|count(?: is)?)\\s*(${NUM})`, 'i'));
  if (/\b(add|adding|another|extra|more)\b/i.test(palletDelta?.[0] ?? '') && palletDelta) {
    out.palletsDelta = num(palletDelta[1]) ?? 1;
    text = blank(text, palletDelta);
  } else if (palletsAbs) {
    const n = num(palletsAbs[1]);
    if (n != null) out.booking.pallets = n;
    text = blank(text, palletsAbs);
  }

  /* units per carton, then cartons */
  const upc = text.match(new RegExp(`(${NUM})\\s*(?:units?|pcs|pieces|items)?\\s*(?:per|a|in (?:a|each|every)|each)\\s+(?:carton|case|box)\\b`, 'i')) ||
    text.match(new RegExp(`\\b(?:carton|case|box)(?:es)?\\s+(?:of|holds?|contains?)\\s+(${NUM})`, 'i'));
  if (upc) {
    out.itemPatch.unitsPerCarton = num(upc[1]);
    text = blank(text, upc);
  }
  const cartons = text.match(new RegExp(`(${NUM})\\s*(?:x\\s*)?(?:cartons?|cases?|boxes)\\b`, 'i')) ||
    text.match(new RegExp(`\\bcartons?\\s*(?:is|are|=|:)\\s*(${NUM})`, 'i'));
  if (cartons) {
    const n = num(cartons[1]);
    if (n != null) out.booking.cartons = n;
    text = blank(text, cartons);
  }

  /* declared value */
  const dv = text.match(new RegExp(`(?:declared|customs|invoice|total|goods)\\s+value\\s*(?:is|of|=|:|at)?\\s*£?\\s*(${NUM})|(?:worth|valued at|value of)\\s*£\\s*(${NUM})|(?:declared at|declaring)\\s*£\\s*(${NUM})`, 'i'));
  if (dv) {
    out.booking.totalDeclaredValue = num(dv[1] ?? dv[2] ?? dv[3]);
    text = blank(text, dv);
  }

  /* weights */
  const kgRe = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:kgs?|kilos?|kilograms?)\\b`, 'gi');
  let k: RegExpExecArray | null;
  const kgMatches: { n: number; start: number; end: number }[] = [];
  while ((k = kgRe.exec(text)) !== null) {
    const n = num(k[1]);
    if (n != null) kgMatches.push({ n, start: k.index, end: k.index + k[0].length });
  }
  for (const m of kgMatches) {
    const left = text.slice(Math.max(0, m.start - 40), m.start).toLowerCase();
    const right = text.slice(m.end, m.end + 24).toLowerCase();
    const perPallet = /^\s*(?:per|a|each|\/)\s*pallet/.test(right);
    const eachWord = /^\s*(?:each|per\s+(?!pallet)\w+|apiece|a piece|\/\s*(?:unit|piece|item))/.test(right) ||
      /(?:each|every|unit)\s+(?:\w+\s+){0,3}(?:weighs?|weight(?: is)?)\s*(?:is|of|about|around)?\s*$/.test(left) ||
      /weigh(?:s|ing)?\s*(?:about|around|roughly)?\s*$/.test(left) && !/(total|gross|shipment|consignment|load)/.test(left);
    const grossWord = /(?:total|gross|all together|altogether|overall|in total|shipment|consignment|load)/.test(left) ||
      /^\s*(?:in total|total|gross|altogether|all in|overall)/.test(right);
    if (perPallet) {
      const p = out.booking.pallets ?? context?.pallets ?? undefined;
      if (p) out.booking.totalGrossWeight = Math.round(m.n * p * 100) / 100;
      else out.unsupported.push('You gave a weight per pallet. Tell me the pallet count and I will work out the total.');
    } else if (eachWord && !grossWord) {
      out.itemPatch.unitWeight = m.n;
    } else if (grossWord) {
      out.booking.totalGrossWeight = m.n;
    } else if (m.n < 25 && (context?.hasItems || /\beach\b/.test(text))) {
      out.itemPatch.unitWeight = m.n;
    } else {
      out.booking.totalGrossWeight = m.n;
    }
    text = text.slice(0, m.start) + ' '.repeat(m.end - m.start) + text.slice(m.end);
  }

  /* price per unit */
  const pricedAt = text.match(new RegExp(`£\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:each|per\\s+\\w+|a\\s+\\w+|apiece|/\\s*\\w+)|(?:at|@|priced at|costs?|for)\\s*£\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:each|per)?|\\beach\\s+(?:\\w+\\s+){0,2}(?:is|costs?)\\s*£\\s*(\\d[\\d,]*(?:\\.\\d+)?)`, 'i'));
  if (pricedAt) {
    out.itemPatch.unitPrice = num(pricedAt[1] ?? pricedAt[2] ?? pricedAt[3]);
    text = blank(text, pricedAt);
  }

  /* products */
  const itemRe = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?|\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty)\\b)\\s+((?:[A-Za-z][A-Za-z'’-]*\\s+){0,3}[A-Za-z][A-Za-z'’-]*)`, 'g');
  let im: RegExpExecArray | null;
  const found: ExtractedItem[] = [];
  let genericQty: number | undefined;
  while ((im = itemRe.exec(text)) !== null) {
    const qty = num(im[1]);
    const desc = cleanDescription(im[2]);
    if (qty == null) continue;
    const firstWord = desc.toLowerCase().split(/\s+/)[0];
    if (/^(units?|pieces?|pcs|items?)$/.test(firstWord) && desc.split(/\s+/).length <= 2) {
      genericQty = qty;
      continue;
    }
    if (!looksLikeProduct(desc)) continue;
    // A bare "3 pallets" or "2 days" has already been removed or is not a product.
    const stripped = desc.replace(/\b(?:units?|pieces?|pcs)\s+(?:of\s+)?/i, '');
    found.push({ description: stripped, quantity: qty });
  }

  const sendPhrase = original.match(/\b(?:send(?:ing)?|ship(?:ping)?|export(?:ing)?|move|moving|sell(?:ing)?|selling|shifting)\s+(?:some\s+|a\s+load of\s+|our\s+)?(?:\d[\d,]*\s+)?([A-Za-z][A-Za-z'’ -]{2,60}?)(?=\s+(?:from|to|out of|for|at|via|in)\b|[.,;]|$)/i);
  const sendDesc = sendPhrase ? cleanDescription(sendPhrase[1]) : undefined;

  if (found.length > 0) {
    out.items = found;
  } else if (sendDesc && looksLikeProduct(sendDesc) && !/^(a |an |the )?(shipment|booking|consignment|parcel|load|freight|order|goods)$/i.test(sendDesc)) {
    out.items = [{ description: sendDesc, quantity: genericQty }];
  } else if (genericQty != null) {
    out.itemPatch.quantity = genericQty;
  }
  return out;
}

/* --------------------------------------------------- missing information */

export interface MissingField {
  key: string;
  label: string;
  question: string;
  /** Quick replies the UI can offer as one-tap buttons. */
  options?: string[];
  required: boolean;
}

/** What the desk still needs before every rule can run, in the order worth asking. */
export function getMissing(booking: Partial<Booking>, items: Partial<Item>[]): MissingField[] {
  const m: MissingField[] = [];
  const need = (key: string, label: string, question: string, options?: string[], required = true) =>
    m.push({ key, label, question, options, required });

  if (items.length === 0) need('items', 'Product', 'What are you shipping, and how many units?');
  if (!booking.originCity) need('originCity', 'Origin city', 'Which UK city does it leave from?', [...ORIGIN_CITIES]);
  if (!booking.destinationCity) {
    need('destinationCity', 'Destination', 'Where is it going? Germany, France or the Netherlands.', ['Frankfurt', 'Paris', 'Rotterdam', 'Hamburg', 'Amsterdam', 'Lyon', 'Berlin']);
  }
  if (!booking.destinationType) need('destinationType', 'Destination type', 'Is it going to a warehouse or a business address?', ['Warehouse', 'Business address']);
  if (!booking.readyToShipDate) need('readyToShipDate', 'Ship date', 'When will it be ready to ship? (e.g. 05-11-2026 or "next Monday")', ['Tomorrow', 'Next Monday']);
  if (!booking.sellerPriority) need('sellerPriority', 'Priority', 'What matters most: cheapest, fastest, most reliable or balanced?', ['Cheapest', 'Fastest', 'Most reliable', 'Balanced']);
  if (booking.pallets == null) need('pallets', 'Pallets', 'How many pallets?');
  if (booking.totalGrossWeight == null) need('totalGrossWeight', 'Gross weight', 'What is the total gross weight in kg, packaging and pallets included?');
  if ((booking.destinationType ?? '').toLowerCase() === 'warehouse' && !booking.deliveryAppointmentBooked) {
    need('deliveryAppointmentBooked', 'Appointment', 'Has a delivery appointment been booked at the warehouse?', ['Yes', 'No']);
  }
  for (const [i, it] of items.entries()) {
    const label = it.description || `product ${i + 1}`;
    if (it.quantity == null) need(`item${i}.quantity`, `${label}: quantity`, `How many units of ${label}?`);
    if (it.unitPrice == null) need(`item${i}.unitPrice`, `${label}: unit price`, `What is the price per unit of ${label} in pounds?`);
    if (it.unitsPerCarton == null) need(`item${i}.unitsPerCarton`, `${label}: units per carton`, `How many units of ${label} go in each carton?`);
    if (it.unitWeight == null) need(`item${i}.unitWeight`, `${label}: unit weight`, `How much does one unit of ${label} weigh in kg?`);
    if (!it.hsCode) need(`item${i}.hsCode`, `${label}: HS code`, `What is the HS code for ${label}? At least 6 digits.`, undefined, true);
    if (!it.countryOfOrigin) need(`item${i}.countryOfOrigin`, `${label}: country of origin`, `Where was ${label} made?`, ['United Kingdom', 'China', 'India', 'Vietnam', 'Turkey', 'Germany'], false);
  }
  return m;
}


/* ------------------------------------------ reading a model's JSON safely */

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const pos = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(/[£,\s]/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function cleanItem(raw: Record<string, unknown>): ExtractedItem {
  const hs = typeof raw.hsCode === 'string' || typeof raw.hsCode === 'number' ? normaliseHsCode(raw.hsCode as string | number) : '';
  const per = pos(raw.unitsPerCarton ?? raw.perCarton);
  return {
    description: str(raw.description),
    quantity: pos(raw.quantity),
    unitPrice: pos(raw.unitPrice),
    hsCode: hs || undefined,
    unitsPerCarton: per && per > 0 ? per : undefined,
    cartons: pos(raw.cartons),
    unitWeight: pos(raw.unitWeight ?? raw.weightPerUnit),
    countryOfOrigin: normaliseCountryOfOrigin(str(raw.countryOfOrigin)),
  };
}

/**
 * Turn whatever a language model returned into a clean Interpretation. Every
 * value is checked and normalised here, so a model can never put a lower-case
 * priority, a text date or a made-up city into the rules.
 */
export function coerceInterpretation(raw: unknown, now: Date = new Date()): Interpretation {
  const out = emptyInterpretation();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const b = (r.booking && typeof r.booking === 'object' ? r.booking : {}) as Record<string, unknown>;

  out.booking.sellerName = str(b.sellerName);
  out.booking.originCity = normaliseOriginCity(str(b.originCity));
  out.booking.destinationCity = normaliseDestinationCity(str(b.destinationCity));
  out.booking.destinationCountry = normaliseDestinationCountry(str(b.destinationCountry)) ?? countryForCity(out.booking.destinationCity);
  out.booking.destinationType = normaliseDestinationType(str(b.destinationType));
  const date = str(b.readyToShipDate);
  out.booking.readyToShipDate = date ? parseDateText(date, now) : undefined;
  out.booking.sellerPriority = normalisePriority(str(b.sellerPriority));
  out.booking.pallets = pos(b.pallets);
  out.booking.cartons = pos(b.cartons);
  out.booking.totalDeclaredValue = pos(b.totalDeclaredValue);
  out.booking.totalGrossWeight = pos(b.totalGrossWeight);
  out.booking.deliveryAppointmentBooked = normaliseYesNo(str(b.deliveryAppointmentBooked));
  for (const k of Object.keys(out.booking) as (keyof ExtractedBooking)[]) {
    if (out.booking[k] === undefined) delete out.booking[k];
  }

  const items = Array.isArray(r.items) ? r.items : [];
  out.items = items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(cleanItem)
    .filter(i => !!i.description);
  if (r.itemPatch && typeof r.itemPatch === 'object') out.itemPatch = cleanItem(r.itemPatch as Record<string, unknown>);
  for (const k of Object.keys(out.itemPatch) as (keyof ExtractedItem)[]) {
    if (out.itemPatch[k] === undefined) delete out.itemPatch[k];
  }
  for (const it of out.items) {
    for (const k of Object.keys(it) as (keyof ExtractedItem)[]) if (it[k] === undefined) delete it[k];
  }
  const delta = typeof r.palletsDelta === 'number' && Number.isFinite(r.palletsDelta) ? Math.trunc(r.palletsDelta) : undefined;
  if (delta) out.palletsDelta = delta;
  if (Array.isArray(r.unsupported)) out.unsupported = r.unsupported.filter((u): u is string => typeof u === 'string').slice(0, 3);
  return out;
}

/** True when a message gave the desk nothing it could use. */
export function isEmptyInterpretation(i: Interpretation): boolean {
  return (
    Object.keys(i.booking).length === 0 &&
    i.items.length === 0 &&
    Object.keys(i.itemPatch).length === 0 &&
    !i.palletsDelta
  );
}
