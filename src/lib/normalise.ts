import {
  ORIGIN_CITIES,
  DESTINATION_COUNTRIES,
  ALL_DESTINATION_CITIES,
  DESTINATION_CITIES,
  DESTINATION_TYPES,
  SELLER_PRIORITIES,
  ITEM_COUNTRIES_OF_ORIGIN,
  ORIGIN_COUNTRY,
} from './constants';

/** Match a free-text value to one of the allowed values, ignoring case and spacing. */
export function matchAllowed(value: string | null | undefined, allowed: readonly string[]): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[_\s-]+/g, ' ').trim();
  return allowed.find(a => a.toLowerCase().replace(/[_\s-]+/g, ' ') === key);
}

const PRIORITY_ALIASES: Record<string, string> = {
  cheap: 'Cheapest',
  cheapest: 'Cheapest',
  lowest: 'Cheapest',
  'lowest cost': 'Cheapest',
  fast: 'Fastest',
  fastest: 'Fastest',
  quickest: 'Fastest',
  speed: 'Fastest',
  reliable: 'Most reliable',
  'most reliable': 'Most reliable',
  reliability: 'Most reliable',
  'on time': 'Most reliable',
  balance: 'Balanced',
  balanced: 'Balanced',
};

export function normalisePriority(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return PRIORITY_ALIASES[key] ?? matchAllowed(value, SELLER_PRIORITIES);
}

export function normaliseDestinationType(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (/warehouse|depot|fulfil|dc\b|distribution/.test(v)) return 'Warehouse';
  if (/business|office|shop|store|address|commercial|residen|home/.test(v)) return 'Business address';
  return matchAllowed(value, DESTINATION_TYPES);
}

export function normaliseOriginCity(value: string | null | undefined): string | undefined {
  return matchAllowed(value, ORIGIN_CITIES);
}

export function normaliseDestinationCountry(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  if (v === 'holland' || v === 'the netherlands' || v === 'nl') return 'Netherlands';
  if (v === 'de' || v === 'deutschland') return 'Germany';
  if (v === 'fr') return 'France';
  return matchAllowed(value, DESTINATION_COUNTRIES);
}

export function normaliseDestinationCity(value: string | null | undefined): string | undefined {
  return matchAllowed(value, ALL_DESTINATION_CITIES);
}

export function countryForCity(city: string | undefined): string | undefined {
  if (!city) return undefined;
  for (const [country, cities] of Object.entries(DESTINATION_CITIES)) {
    if (cities.includes(city)) return country;
  }
  return undefined;
}

export function normaliseCountryOfOrigin(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim().replace(/\./g, '');
  if (v === 'uk' || v === 'gb' || v === 'britain' || v === 'great britain' || v === 'england' || v === 'scotland' || v === 'wales') {
    return ORIGIN_COUNTRY;
  }
  if (v === 'prc' || v === 'peoples republic of china') return 'China';
  if (v === 'turkiye') return 'Turkey';
  if (v === 'vn') return 'Vietnam';
  return matchAllowed(value, ITEM_COUNTRIES_OF_ORIGIN);
}

export function normaliseYesNo(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (!v) return undefined;
  if (/^(yes|y|true|booked|confirmed|done|1)$/.test(v)) return 'Yes';
  if (/^(no|n|false|not booked|none|0|pending)$/.test(v)) return 'No';
  return undefined;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDDMMYYYY(d: Date): string {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** "Today" as a calendar date in London, independent of the visitor's time zone. */
export function todayInLondon(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return new Date(get('year'), get('month') - 1, get('day'));
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Turn the ways people write a date into DD-MM-YYYY.
 * Handles 05-11-2026, 5/11/2026, 2026-11-05, "5th November 2026", "Nov 5",
 * "tomorrow", "today" and "next Monday". Returns undefined when it can't tell.
 */
export function parseDateText(text: string, now: Date = new Date()): string | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  const today = todayInLondon(now);

  let m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    return isRealDate(y, mo, d) ? `${pad(d)}-${pad(mo)}-${y}` : undefined;
  }
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return isRealDate(y, mo, d) ? `${pad(d)}-${pad(mo)}-${y}` : undefined;
  }

  const monthRe = MONTHS.map(x => x.slice(0, 3)).join('|');
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRe})[a-z]*\\.?(?:,?\\s+(\\d{4}))?`));
  let day: number | undefined, mon: number | undefined, year: number | undefined;
  if (m) {
    day = Number(m[1]);
    mon = MONTHS.findIndex(x => x.startsWith(m![2])) + 1;
    year = m[3] ? Number(m[3]) : undefined;
  } else {
    m = t.match(new RegExp(`\\b(${monthRe})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`));
    if (m) {
      mon = MONTHS.findIndex(x => x.startsWith(m![1])) + 1;
      day = Number(m[2]);
      year = m[3] ? Number(m[3]) : undefined;
    }
  }
  if (day && mon) {
    let y = year ?? today.getFullYear();
    if (!year && new Date(y, mon - 1, day) < today) y += 1;
    return isRealDate(y, mon, day) ? `${pad(day)}-${pad(mon)}-${y}` : undefined;
  }

  if (/\btoday\b/.test(t)) return formatDDMMYYYY(today);
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDDMMYYYY(d);
  }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  m = t.match(/\b(?:next|on|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const target = days.indexOf(m[1]);
    const d = new Date(today);
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return formatDDMMYYYY(d);
  }
  return undefined;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** Next Monday-to-Friday day on or after the given date. */
export function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/** "3", "1,080", "three" and "2.5" as numbers. */
export function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const w = raw.toLowerCase().trim();
  if (w in WORD_NUMBERS) return WORD_NUMBERS[w];
  const n = Number(w.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** Add working days (Monday to Friday) to a date. Bank holidays are not known, so treat results as estimates. */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

/** Parse a DD-MM-YYYY string into a local date, or null. */
export function fromDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}
