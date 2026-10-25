import {
  ORIGIN_CITIES, DESTINATION_CITIES, DESTINATION_COUNTRIES,
  DESTINATION_TYPES, SELLER_PRIORITIES, ITEM_COUNTRIES_OF_ORIGIN,
} from './constants';
import type { LLMExtraction } from './schemas';

const ALL_DEST_CITIES = Object.values(DESTINATION_CITIES).flat();

function findMatch(text: string, candidates: readonly string[]): string | undefined {
  const lower = text.toLowerCase();
  return candidates.find(c => lower.includes(c.toLowerCase()));
}

function findNumber(text: string, ...keywords: string[]): number | undefined {
  for (const kw of keywords) {
    const patterns = [
      new RegExp(`${kw}[:\\s]*[£]?([\\d,]+\\.?\\d*)`, 'i'),
      new RegExp(`([\\d,]+\\.?\\d*)\\s*${kw}`, 'i'),
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const n = Number(m[1].replace(/,/g, ''));
        if (!isNaN(n)) return n;
      }
    }
  }
  return undefined;
}

function findDate(text: string): string | undefined {
  const ddmmyyyy = text.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (ddmmyyyy) return ddmmyyyy[0];

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthMatch = text.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i
  );
  if (monthMatch) {
    const d = String(parseInt(monthMatch[1])).padStart(2, '0');
    const m = String(monthNames.indexOf(monthMatch[2].toLowerCase()) + 1).padStart(2, '0');
    return `${d}-${m}-${monthMatch[3]}`;
  }

  const monthMatch2 = text.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i
  );
  if (monthMatch2) {
    const d = String(parseInt(monthMatch2[2])).padStart(2, '0');
    const m = String(monthNames.indexOf(monthMatch2[1].toLowerCase()) + 1).padStart(2, '0');
    return `${d}-${m}-${monthMatch2[3]}`;
  }

  return undefined;
}

export function fallbackParse(text: string, currentState?: Partial<LLMExtraction['extracted']>): LLMExtraction {
  const extracted: LLMExtraction['extracted'] = { items: [] };
  const missing: string[] = [];

  const sellerMatch = text.match(/(?:I run|I'm from|company is|business is|we are|seller[: ]+)([A-Z][A-Za-z\s&'-]+?)(?:\.|,|$)/i);
  if (sellerMatch) extracted.sellerName = sellerMatch[1].trim();

  const originCity = findMatch(text, ORIGIN_CITIES);
  if (originCity) extracted.originCity = originCity;
  extracted.originCountry = 'United Kingdom';

  const destCountry = findMatch(text, DESTINATION_COUNTRIES);
  if (destCountry) extracted.destinationCountry = destCountry;

  const destCity = findMatch(text, ALL_DEST_CITIES);
  if (destCity) {
    extracted.destinationCity = destCity;
    if (!extracted.destinationCountry) {
      for (const [country, cities] of Object.entries(DESTINATION_CITIES)) {
        if (cities.includes(destCity)) {
          extracted.destinationCountry = country;
          break;
        }
      }
    }
  }

  const destType = findMatch(text, DESTINATION_TYPES);
  if (destType) extracted.destinationType = destType;

  const priority = findMatch(text, SELLER_PRIORITIES);
  if (priority) extracted.sellerPriority = priority;

  const date = findDate(text);
  if (date) extracted.readyToShipDate = date;

  const pallets = findNumber(text, 'pallets?');
  if (pallets != null) extracted.pallets = pallets;

  const cartons = findNumber(text, 'cartons?');
  if (cartons != null) extracted.cartons = cartons;

  const weight = findNumber(text, 'kg', 'gross weight', 'weight');
  if (weight != null) extracted.totalGrossWeight = weight;

  const value = findNumber(text, 'declared value', 'total value', 'worth');
  if (value != null) extracted.totalDeclaredValue = value;

  const appointmentMatch = text.match(/appointment[:\s]*(yes|no|booked)/i);
  if (appointmentMatch) {
    extracted.deliveryAppointmentBooked = appointmentMatch[1].toLowerCase() === 'no' ? 'No' : 'Yes';
  }

  const productPatterns = [
    /(\d[\d,]*)\s+(?:units?\s+(?:of\s+)?)?([a-z][a-z\s,'-]+?)(?:\s+at\s+[£]?([\d.]+)|\s+(?:each|per unit)\s+[£]?([\d.]+)|[,.])/gi,
    /([a-z][a-z\s,'-]+?)\s*[,.]?\s*(\d[\d,]*)\s+units?\s*(?:at\s+[£]?([\d.]+))?/gi,
  ];

  const items: NonNullable<LLMExtraction['extracted']['items']> = [];

  for (const pat of productPatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const qty = parseInt(m[1]?.replace(/,/g, '') || m[2]?.replace(/,/g, ''), 10);
      const desc = (m[2] || m[1] || '').trim();
      const price = parseFloat(m[3] || m[4] || '');
      if (qty && desc && desc.length > 2) {
        items.push({
          description: desc,
          quantity: qty,
          unitPrice: isNaN(price) ? undefined : price,
        });
      }
    }
  }

  const simpleProduct = text.match(/(?:send|ship|sending|shipping)\s+(.+?)(?:\s+from\s+|\s+to\s+|\.)/i);
  if (items.length === 0 && simpleProduct) {
    const desc = simpleProduct[1].trim();
    const qtyInDesc = findNumber(desc, 'units?', 'pieces?', 'pcs');
    if (desc.length > 2) {
      items.push({ description: desc, quantity: qtyInDesc });
    }
  }

  if (items.length > 0) extracted.items = items;

  const priceMatch = text.match(/[£]([\d,.]+)\s*(?:each|per unit|per\s)/i);
  if (priceMatch && items.length === 1 && !items[0].unitPrice) {
    items[0].unitPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  const unitsPerCartonMatch = text.match(/(\d+)\s*(?:units?\s*)?per\s*carton/i);
  if (unitsPerCartonMatch && items.length > 0) {
    items[0].unitsPerCarton = parseInt(unitsPerCartonMatch[1], 10);
  }

  const unitWeightMatch = text.match(/([\d.]+)\s*kg\s*(?:each|per unit|per\s)/i);
  if (unitWeightMatch && items.length > 0) {
    items[0].unitWeight = parseFloat(unitWeightMatch[1]);
  }

  const cooMatch = findMatch(text, ITEM_COUNTRIES_OF_ORIGIN);
  if (cooMatch && items.length > 0) {
    const madeInPattern = /(?:made in|from|origin|manufactured in)\s/i;
    if (madeInPattern.test(text)) {
      items[0].countryOfOrigin = cooMatch;
    }
  }

  const hsMatch = text.match(/hs\s*(?:code)?\s*[:\s]*([\d]{4,})/i);
  if (hsMatch && items.length > 0) {
    items[0].hsCode = hsMatch[1];
  }

  const merged = { ...(currentState || {}), ...extracted };
  if (!merged.sellerName) missing.push('seller name');
  if (!merged.originCity) missing.push('origin city');
  if (!merged.destinationCity) missing.push('destination city');
  if (!merged.destinationCountry) missing.push('destination country');
  if (!merged.destinationType) missing.push('destination type (Warehouse or Business address)');
  if (!merged.readyToShipDate) missing.push('ready-to-ship date (DD-MM-YYYY)');
  if (!merged.sellerPriority) missing.push('seller priority (Cheapest, Fastest, Most reliable, or Balanced)');
  if (merged.pallets == null) missing.push('number of pallets');
  if (!merged.items || merged.items.length === 0) {
    missing.push('product details (description, quantity, unit price)');
  } else {
    for (const item of merged.items) {
      const itemMissing: string[] = [];
      if (!item.hsCode) itemMissing.push('HS code');
      if (item.unitsPerCarton == null) itemMissing.push('units per carton');
      if (item.unitWeight == null) itemMissing.push('unit weight (kg)');
      if (!item.countryOfOrigin) itemMissing.push('country of origin');
      if (itemMissing.length > 0) {
        missing.push(`For ${item.description || 'the item'}: ${itemMissing.join(', ')}`);
      }
    }
  }
  if (merged.deliveryAppointmentBooked == null && merged.destinationType?.toLowerCase() === 'warehouse') {
    missing.push('delivery appointment booked (Yes/No)');
  }

  return { extracted, missing: missing.length > 0 ? missing : undefined };
}
