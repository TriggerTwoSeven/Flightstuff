import * as XLSX from 'xlsx';
import type { Booking, Item, DataIssue } from './schemas';
import {
  ORIGIN_CITIES, ORIGIN_COUNTRY, DESTINATION_COUNTRIES,
  DESTINATION_CITIES, ALL_DESTINATION_CITIES, DESTINATION_TYPES,
  SELLER_PRIORITIES, ITEM_COUNTRIES_OF_ORIGIN,
} from './constants';

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
  for (const [field, alts] of Object.entries(aliases)) {
    for (const alt of alts) {
      if (norm === alt || norm.includes(alt)) return field;
    }
  }
  return null;
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
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}-${m}-${y}`;
  }
  if (typeof val === 'number') {
    const epoch = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(epoch.getTime())) {
      const d = String(epoch.getUTCDate()).padStart(2, '0');
      const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      const y = epoch.getUTCFullYear();
      return `${d}-${m}-${y}`;
    }
  }
  return String(val).trim();
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
      if (field && !mapping[field]) {
        mapping[field] = c;
        count++;
      }
    }
    if (count > bestCount) {
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
    const isSample = TEMPLATE_SAMPLE_VALUES.some(sv => rowText.includes(sv));
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
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
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
        dataIssues.push({ type: 'missing_id', message: `Row ${r + 1} on ${bookingSheetName} has no Booking ID.`, sheet: bookingSheetName, row: r + 1 });
        continue;
      }

      const originCity = parseStringValue(getVal('originCity'));
      const originCountry = parseStringValue(getVal('originCountry'));
      const destCity = parseStringValue(getVal('destinationCity'));
      const destCountry = parseStringValue(getVal('destinationCountry'));
      const destType = parseStringValue(getVal('destinationType'));
      const priority = parseStringValue(getVal('sellerPriority'));

      if (originCountry && originCountry !== ORIGIN_COUNTRY) {
        dataIssues.push({ type: 'invalid_enum', message: `Origin country "${originCountry}" is not supported. Only "United Kingdom" is allowed.`, sheet: bookingSheetName, row: r + 1, field: 'Origin country', value: originCountry });
      }
      if (originCity && !(ORIGIN_CITIES as readonly string[]).includes(originCity)) {
        dataIssues.push({ type: 'invalid_enum', message: `Origin city "${originCity}" is not in the allowed list: ${ORIGIN_CITIES.join(', ')}.`, sheet: bookingSheetName, row: r + 1, field: 'Origin city', value: originCity });
      }
      if (destCountry && !(DESTINATION_COUNTRIES as readonly string[]).includes(destCountry)) {
        dataIssues.push({ type: 'invalid_enum', message: `Destination country "${destCountry}" is not supported. Allowed: ${DESTINATION_COUNTRIES.join(', ')}.`, sheet: bookingSheetName, row: r + 1, field: 'Destination country', value: destCountry });
      }
      if (destCity && !ALL_DESTINATION_CITIES.includes(destCity)) {
        dataIssues.push({ type: 'invalid_enum', message: `Destination city "${destCity}" is not in the allowed list.`, sheet: bookingSheetName, row: r + 1, field: 'Destination city', value: destCity });
      }
      if (destCity && destCountry && DESTINATION_CITIES[destCountry] && !DESTINATION_CITIES[destCountry].includes(destCity)) {
        dataIssues.push({ type: 'city_country_mismatch', message: `Destination city "${destCity}" does not belong to "${destCountry}".`, sheet: bookingSheetName, row: r + 1, field: 'Destination city' });
      }
      if (destType && !(DESTINATION_TYPES as readonly string[]).includes(destType)) {
        dataIssues.push({ type: 'invalid_enum', message: `Destination type "${destType}" is invalid. Allowed: ${DESTINATION_TYPES.join(', ')}.`, sheet: bookingSheetName, row: r + 1, field: 'Destination type', value: destType });
      }
      if (priority && !(SELLER_PRIORITIES as readonly string[]).includes(priority)) {
        dataIssues.push({ type: 'invalid_enum', message: `Seller priority "${priority}" is invalid. Allowed: ${SELLER_PRIORITIES.join(', ')}.`, sheet: bookingSheetName, row: r + 1, field: 'Seller priority', value: priority });
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
        currency: parseStringValue(getVal('currency')) || 'GBP',
        totalGrossWeight: parseNumericValue(getVal('totalGrossWeight')),
        deliveryAppointmentBooked: parseStringValue(getVal('deliveryAppointmentBooked')),
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
        dataIssues.push({ type: 'missing_id', message: `Row ${r + 1} on ${itemSheetName} has no Booking ID.`, sheet: itemSheetName, row: r + 1 });
        continue;
      }

      const coo = parseStringValue(getVal('countryOfOrigin'));
      if (coo && !(ITEM_COUNTRIES_OF_ORIGIN as readonly string[]).includes(coo)) {
        dataIssues.push({ type: 'invalid_enum', message: `Country of origin "${coo}" is not in the allowed list.`, sheet: itemSheetName, row: r + 1, field: 'Country of origin', value: coo });
      }

      const rawHs = getVal('hsCode');
      let hsCode: string | null = null;
      if (rawHs != null && rawHs !== '') {
        hsCode = String(typeof rawHs === 'number' ? Math.floor(rawHs) : rawHs).trim();
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

  const bookingIds = bookings.map(b => b.bookingId);
  const dupes = bookingIds.filter((id, i) => bookingIds.indexOf(id) !== i);
  const uniqueDupes = [...new Set(dupes)];
  for (const dup of uniqueDupes) {
    dataIssues.push({ type: 'duplicate_id', message: `Duplicate Booking ID "${dup}" found on the Bookings sheet.` });
  }

  const orphanItems = items.filter(i => !bookingIds.includes(i.bookingId));
  for (const orphan of orphanItems) {
    dataIssues.push({ type: 'orphan_item', message: `Item "${orphan.sku}" references Booking ID "${orphan.bookingId}" which does not exist on the Bookings sheet.` });
  }

  const bookingsWithNoItems = bookings.filter(b => !items.some(i => i.bookingId === b.bookingId));
  for (const b of bookingsWithNoItems) {
    dataIssues.push({ type: 'no_items', message: `Booking "${b.bookingId}" has no items on the Items sheet.` });
  }

  return { bookings, items, dataIssues, bookingSheetInfo, itemSheetInfo, sheetsFound, includeSampleRow };
}
