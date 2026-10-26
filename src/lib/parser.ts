import * as XLSX from 'xlsx';
import type { Booking, Item, DataIssue } from './schemas';
import {
  ORIGIN_CITIES, ORIGIN_COUNTRY, DESTINATION_COUNTRIES,
  DESTINATION_CITIES, ALL_DESTINATION_CITIES, DESTINATION_TYPES,
  SELLER_PRIORITIES, ITEM_COUNTRIES_OF_ORIGIN,
} from './constants';
import {
  matchAllowed, normaliseCountryOfOrigin, normaliseDestinationType,
  normalisePriority, normaliseYesNo, parseDateText,
} from './normalise';

const BOOKING_COLUMN_ALIASES: Record<string, string[]> = {
  bookingId: ['booking id', 'bookingid', 'booking_id', 'id'],
  sellerName: ['seller name', 'sellername', 'seller_name', 'seller'],
  originCity: ['origin city', 'origincity', 'origin_city'],
  originCountry: ['origin country', 'origincountry', 'origin_country'],
  destinationCity: ['destination city', 'destinationcity', 'destination_city', 'dest city'],
  destinationCountry: ['destination country', 'destinationcountry', 'destination_country', 'dest country'],
  destinationType: ['destination type', 'destinationtype', 'destination_type', 'dest type'],
  readyToShipDate: ['ready to ship date', 'readytoshipdate', 'ready_to_ship_date', 'ship date', 'ready date'],
  sellerPriority: ['seller priority', 'sellerpriority', 'seller_priority', 'priority'],
  pallets: ['pallets', 'pallet count', 'number of pallets'],
  cartons: ['cartons', 'total cartons', 'carton count'],
  totalDeclaredValue: ['total declared value', 'totaldeclaredvalue', 'declared value', 'total_declared_value', 'value'],
  currency: ['currency', 'curr'],
  totalGrossWeight: ['total gross weight (kg)', 'total gross weight', 'totalgrossweight', 'gross weight', 'total_gross_weight', 'weight (kg)', 'weight'],
  deliveryAppointmentBooked: ['delivery appointment booked', 'deliveryappointmentbooked', 'delivery_appointment_booked', 'appointment booked', 'appointment'],
};

const ITEM_COLUMN_ALIASES: Record<string, string[]> = {
  bookingId: ['booking id', 'bookingid', 'booking_id', 'id'],
  sku: ['sku', 'product code', 'item code'],
  description: ['description', 'product description', 'item description', 'desc'],
  hsCode: ['hs code', 'hscode', 'hs_code', 'hs'],
  quantity: ['quantity (units)', 'quantity', 'qty', 'units', 'quantity_units'],
  unitPrice: ['unit price', 'unitprice', 'unit_price', 'price'],
  unitsPerCarton: ['units per carton', 'unitspercarton', 'units_per_carton', 'per carton'],
  cartons: ['cartons', 'carton count', 'item cartons'],
  unitWeight: ['unit weight (kg)', 'unit weight', 'unitweight', 'unit_weight', 'weight per unit', 'weight (kg)'],
  countryOfOrigin: ['country of origin', 'countryoforigin', 'country_of_origin', 'origin', 'made in', 'coo'],
};

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function matchColumn(header: string, aliases: Record<string, string[]>): string | null {
  const norm = normaliseHeader(header);
  if (!norm) return null;
  let best: { field: string; score: number } | null = null;
  for (const [field, alts] of Object.entries(aliases)) {
    for (const rawAlt of alts) {
      const alt = normaliseHeader(rawAlt);
      let score = 0;
      if (norm === alt) score = 1000 + alt.length;
      // Loose matches only for aliases long enough not to hit by accident
      // ("units" used to swallow "units per carton", "id" matched anything).
      else if (alt.length >= 5 && norm.includes(alt)) score = alt.length;
      if (score > 0 && (!best || score > best.score)) best = { field, score };
    }
  }
  return best ? best.field : null;
}

function parseNumericValue(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[£,\s]/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function parseDateValue(val: unknown): string {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    // SheetJS builds date cells at a UTC instant that sits on the calendar day
    // in the sheet, give or take the machine's offset. Rounding to the nearest
    // UTC day keeps the right day in every time zone.
    const rounded = new Date(Math.round(val.getTime() / 86400000) * 86400000);
    const d = String(rounded.getUTCDate()).padStart(2, '0');
    const m = String(rounded.getUTCMonth() + 1).padStart(2, '0');
    return `${d}-${m}-${rounded.getUTCFullYear()}`;
  }
  if (typeof val === 'number') {
    const epoch = new Date(Math.round((val - 25569) * 86400) * 1000);
    if (!isNaN(epoch.getTime())) {
      const d = String(epoch.getUTCDate()).padStart(2, '0');
      const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      return `${d}-${m}-${epoch.getUTCFullYear()}`;
    }
  }
  const raw = String(val).trim();
  // Accept 5/11/2026, 5 Nov 2026 and similar, and write them the way the rules expect.
  return parseDateText(raw) ?? raw;
}

function parseStringValue(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

interface SheetDetection {
  sheetName: string;
  headerRow: number;
  columns: Record<string, number>;
  sampleRow?: number;
}

const TEMPLATE_SAMPLE_VALUES = [
  'BK-001', 'Northfield Goods', 'Manchester', 'MUG-01', 'Ceramic coffee mug',
];

function detectHeaderRow(
  sheet: XLSX.WorkSheet,
  aliases: Record<string, string[]>,
): { headerRow: number; columns: Record<string, number>; sampleRow?: number } {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  let bestRow = 0;
  let bestCount = 0;
  let bestMapping: Record<string, number> = {};

  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    const mapping: Record<string, number> = {};
    let count = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const header = parseStringValue(cell.v);
      if (!header) continue;
      const field = matchColumn(header, aliases);
      if (field && mapping[field] === undefined) {
        mapping[field] = c;
        count++;
      }
    }
    if (count > bestCount && count >= 3) {
      bestCount = count;
      bestRow = r;
      bestMapping = mapping;
    }
  }

  let sampleRow: number | undefined;
  const dataStart = bestRow + 1;
  if (dataStart <= range.e.r) {
    const firstDataRow: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: dataStart, c })];
      if (cell) firstDataRow.push(parseStringValue(cell.v));
    }
    const rowText = firstDataRow.join(' ');
    const isSample = TEMPLATE_SAMPLE_VALUES.some(sv => rowText.includes(sv)) || /^\s*(example|sample)\b/i.test(rowText);
    if (isSample) sampleRow = dataStart;
  }

  return { headerRow: bestRow, columns: bestMapping, sampleRow };
}

export interface ParseResult {
  bookings: Booking[];
  items: Item[];
  dataIssues: DataIssue[];
  bookingSheetInfo: SheetDetection | null;
  itemSheetInfo: SheetDetection | null;
  sheetsFound: string[];
  includeSampleRow: boolean;
}

export function parseWorkbook(buffer: ArrayBuffer, includeSampleRow = false): ParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    throw new Error('That file could not be read. Please upload an .xlsx workbook with Bookings and Items sheets.');
  }
  const dataIssues: DataIssue[] = [];
  const sheetsFound = wb.SheetNames;

  const bookingSheetName = sheetsFound.find(s => s.toLowerCase().includes('booking'));
  const itemSheetName = sheetsFound.find(s => s.toLowerCase().includes('item'));

  if (!bookingSheetName) {
    dataIssues.push({ type: 'missing_sheet', message: 'No "Bookings" sheet found in the workbook.', sheet: 'Bookings' });
  }
  if (!itemSheetName) {
    dataIssues.push({ type: 'missing_sheet', message: 'No "Items" sheet found in the workbook.', sheet: 'Items' });
  }

  let bookingSheetInfo: SheetDetection | null = null;
  let itemSheetInfo: SheetDetection | null = null;
  const bookings: Booking[] = [];
  const items: Item[] = [];

  if (bookingSheetName) {
    const sheet = wb.Sheets[bookingSheetName];
    const det = detectHeaderRow(sheet, BOOKING_COLUMN_ALIASES);
    bookingSheetInfo = { sheetName: bookingSheetName, ...det };

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (let r = det.headerRow + 1; r <= range.e.r; r++) {
      if (!includeSampleRow && r === det.sampleRow) continue;

      let hasData = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v != null && String(cell.v).trim() !== '') {
          hasData = true;
          break;
        }
      }
      if (!hasData) continue;

      const getVal = (field: string) => {
        const col = det.columns[field];
        if (col == null) return null;
        const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
        return cell ? cell.v : null;
      };

      const bookingId = parseStringValue(getVal('bookingId'));
      if (!bookingId) {
        dataIssues.push({ type: 'missing_id', message: `Row ${r + 1} on ${bookingSheetName} has no Booking ID and was skipped.`, sheet: bookingSheetName, row: r + 1 });
        continue;
      }

      const rawOriginCity = parseStringValue(getVal('originCity'));
      const rawOriginCountry = parseStringValue(getVal('originCountry'));
      const rawDestCity = parseStringValue(getVal('destinationCity'));
      const rawDestCountry = parseStringValue(getVal('destinationCountry'));
      const rawDestType = parseStringValue(getVal('destinationType'));
      const rawPriority = parseStringValue(getVal('sellerPriority'));
      const rawCurrency = parseStringValue(getVal('currency'));
      const rawAppointment = parseStringValue(getVal('deliveryAppointmentBooked'));

      // Accept any capitalisation ("cheapest", "WAREHOUSE", "manchester") and
      // tidy it to the canonical value; only genuinely unknown values warn.
      const originCity = matchAllowed(rawOriginCity, ORIGIN_CITIES) ?? rawOriginCity;
      const originCountry = /^(uk|gb|united kingdom|great britain)$/i.test(rawOriginCountry) ? ORIGIN_COUNTRY : rawOriginCountry;
      const destCity = matchAllowed(rawDestCity, ALL_DESTINATION_CITIES) ?? rawDestCity;
      const destCountry = matchAllowed(rawDestCountry, DESTINATION_COUNTRIES) ?? rawDestCountry;
      const destType = normaliseDestinationType(rawDestType) ?? rawDestType;
      const priority = normalisePriority(rawPriority) ?? rawPriority;
      const appointment = normaliseYesNo(rawAppointment) ?? rawAppointment;

      const issue = (type: string, message: string, field: string, value?: string) =>
        dataIssues.push({ type, message, sheet: bookingSheetName, row: r + 1, field, value, bookingId });

      if (originCountry && originCountry !== ORIGIN_COUNTRY) {
        issue('invalid_enum', `Origin country "${originCountry}" is not supported. Only "United Kingdom" is allowed.`, 'Origin country', originCountry);
      }
      if (originCity && !(ORIGIN_CITIES as readonly string[]).includes(originCity)) {
        issue('invalid_enum', `Origin city "${originCity}" is not in the allowed list: ${ORIGIN_CITIES.join(', ')}.`, 'Origin city', originCity);
      }
      if (destCountry && !(DESTINATION_COUNTRIES as readonly string[]).includes(destCountry)) {
        issue('invalid_enum', `Destination country "${destCountry}" is not supported. Allowed: ${DESTINATION_COUNTRIES.join(', ')}.`, 'Destination country', destCountry);
      }
      if (destCity && !ALL_DESTINATION_CITIES.includes(destCity)) {
        issue('invalid_enum', `Destination city "${destCity}" is not in the allowed list.`, 'Destination city', destCity);
      }
      if (destCity && destCountry && DESTINATION_CITIES[destCountry] && !DESTINATION_CITIES[destCountry].includes(destCity)) {
        issue('city_country_mismatch', `Destination city "${destCity}" does not belong to "${destCountry}".`, 'Destination city');
      }
      if (destType && !(DESTINATION_TYPES as readonly string[]).includes(destType)) {
        issue('invalid_enum', `Destination type "${destType}" is invalid. Allowed: ${DESTINATION_TYPES.join(', ')}.`, 'Destination type', destType);
      }
      if (priority && !(SELLER_PRIORITIES as readonly string[]).includes(priority)) {
        issue('invalid_enum', `Seller priority "${priority}" is invalid. Allowed: ${SELLER_PRIORITIES.join(', ')}.`, 'Seller priority', priority);
      }
      if (rawCurrency && rawCurrency.toUpperCase() !== 'GBP') {
        issue('invalid_enum', `Currency "${rawCurrency}" is not supported. All values are treated as GBP.`, 'Currency', rawCurrency);
      }

      bookings.push({
        bookingId,
        sellerName: parseStringValue(getVal('sellerName')),
        originCity,
        originCountry: originCountry || ORIGIN_COUNTRY,
        destinationCity: destCity,
        destinationCountry: destCountry,
        destinationType: destType,
        readyToShipDate: parseDateValue(getVal('readyToShipDate')),
        sellerPriority: priority,
        pallets: parseNumericValue(getVal('pallets')),
        cartons: parseNumericValue(getVal('cartons')),
        totalDeclaredValue: parseNumericValue(getVal('totalDeclaredValue')),
        currency: rawCurrency || 'GBP',
        totalGrossWeight: parseNumericValue(getVal('totalGrossWeight')),
        deliveryAppointmentBooked: appointment,
      });
    }
  }

  if (itemSheetName) {
    const sheet = wb.Sheets[itemSheetName];
    const det = detectHeaderRow(sheet, ITEM_COLUMN_ALIASES);
    itemSheetInfo = { sheetName: itemSheetName, ...det };

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (let r = det.headerRow + 1; r <= range.e.r; r++) {
      if (!includeSampleRow && r === det.sampleRow) continue;

      let hasData = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v != null && String(cell.v).trim() !== '') {
          hasData = true;
          break;
        }
      }
      if (!hasData) continue;

      const getVal = (field: string) => {
        const col = det.columns[field];
        if (col == null) return null;
        const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
        return cell ? cell.v : null;
      };

      const bookingId = parseStringValue(getVal('bookingId'));
      if (!bookingId) {
        dataIssues.push({ type: 'missing_id', message: `Row ${r + 1} on ${itemSheetName} has no Booking ID and was skipped.`, sheet: itemSheetName, row: r + 1 });
        continue;
      }

      const rawCoo = parseStringValue(getVal('countryOfOrigin'));
      const coo = normaliseCountryOfOrigin(rawCoo) ?? rawCoo;
      if (coo && !(ITEM_COUNTRIES_OF_ORIGIN as readonly string[]).includes(coo)) {
        dataIssues.push({ type: 'invalid_enum', message: `Country of origin "${coo}" is not in the allowed list: ${ITEM_COUNTRIES_OF_ORIGIN.join(', ')}.`, sheet: itemSheetName, row: r + 1, field: 'Country of origin', value: coo, bookingId });
      }

      const rawHs = getVal('hsCode');
      let hsCode: string | null = null;
      if (rawHs != null && rawHs !== '') {
        hsCode = String(typeof rawHs === 'number' ? Math.trunc(rawHs) : rawHs).trim();
      }

      items.push({
        bookingId,
        sku: parseStringValue(getVal('sku')),
        description: parseStringValue(getVal('description')),
        hsCode,
        quantity: parseNumericValue(getVal('quantity')),
        unitPrice: parseNumericValue(getVal('unitPrice')),
        unitsPerCarton: parseNumericValue(getVal('unitsPerCarton')),
        cartons: parseNumericValue(getVal('cartons')),
        unitWeight: parseNumericValue(getVal('unitWeight')),
        countryOfOrigin: coo || null,
      });
    }
  }

  // A repeated Booking ID would be checked twice against the same items, so keep the first.
  const allBookingIds = bookings.map(b => b.bookingId);
  for (let i = bookings.length - 1; i >= 0; i--) {
    const key = bookings[i].bookingId.trim().toLowerCase();
    if (allBookingIds.findIndex(id => id.trim().toLowerCase() === key) !== i) bookings.splice(i, 1);
  }
  const bookingIds = bookings.map(b => b.bookingId);
  const dupes = allBookingIds.filter((id, i) => allBookingIds.indexOf(id) !== i);
  const uniqueDupes = [...new Set(dupes)];
  for (const dup of uniqueDupes) {
    dataIssues.push({ type: 'duplicate_id', message: `Duplicate Booking ID "${dup}" found on the Bookings sheet. Only the first row is checked.`, bookingId: dup });
  }

  const orphanItems = items.filter(i => !bookingIds.includes(i.bookingId));
  for (const orphan of orphanItems) {
    dataIssues.push({ type: 'orphan_item', message: `Item "${orphan.sku}" references Booking ID "${orphan.bookingId}" which does not exist on the Bookings sheet.`, bookingId: orphan.bookingId });
  }

  const bookingsWithNoItems = bookings.filter(b => !items.some(i => i.bookingId === b.bookingId));
  for (const b of bookingsWithNoItems) {
    dataIssues.push({ type: 'no_items', message: `Booking "${b.bookingId}" has no items on the Items sheet.`, bookingId: b.bookingId });
  }

  return { bookings, items, dataIssues, bookingSheetInfo, itemSheetInfo, sheetsFound, includeSampleRow };
}
