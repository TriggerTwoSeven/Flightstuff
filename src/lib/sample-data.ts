import * as XLSX from 'xlsx';
import { addDays, formatDDMMYYYY, todayInLondon } from './normalise';

/**
 * The practice workbook. Each booking carries one planted problem (BK-101 is
 * clean), and ship dates are relative to today so the ten rules behave the
 * same whenever someone opens it.
 */
export function buildSampleWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const today = todayInLondon();
  const inDays = (n: number) => formatDDMMYYYY(addDays(today, n));

  const bookingsData: (string | number)[][] = [
    ['Bookings: one row per record. Row 3 is an example (grey); enter data from row 4.'],
    ['Booking ID', 'Seller name', 'Origin city', 'Origin country', 'Destination city', 'Destination country', 'Destination type', 'Ready to ship date', 'Seller priority', 'Pallets', 'Cartons', 'Total declared value', 'Currency', 'Total gross weight (kg)', 'Delivery appointment booked'],
    ['BK-001', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt', 'Germany', 'Warehouse', inDays(10), 'Cheapest', 3, 90, 5400, 'GBP', 620, 'Yes'],
    // Clean: every rule passes.
    ['BK-101', 'Greenfield Ceramics', 'London', 'United Kingdom', 'Berlin', 'Germany', 'Business address', inDays(14), 'Fastest', 2, 60, 3600, 'GBP', 520, 'No'],
    // R-01 blank HS code, R-09 blank country of origin.
    ['BK-102', 'Highland Textiles', 'Birmingham', 'United Kingdom', 'Paris', 'France', 'Warehouse', inDays(9), 'Most reliable', 4, 120, 7200, 'GBP', 850, 'Yes'],
    // R-02 declared 10,000 but the items add up to 5,400.
    ['BK-103', 'Lakeside Pottery', 'Leeds', 'United Kingdom', 'Amsterdam', 'Netherlands', 'Business address', inDays(12), 'Balanced', 3, 90, 10000, 'GBP', 620, 'No'],
    // R-03 15 x 40 is 600, not 540. R-04 booking says 100 cartons, items say 40.
    ['BK-104', 'Westfield Imports', 'Manchester', 'United Kingdom', 'Hamburg', 'Germany', 'Warehouse', inDays(8), 'Cheapest', 2, 100, 2700, 'GBP', 380, 'Yes'],
    // R-05 800 kg on one pallet is over every carrier's limit.
    ['BK-105', 'Ironside Metals', 'London', 'United Kingdom', 'Frankfurt', 'Germany', 'Business address', inDays(11), 'Cheapest', 1, 20, 4000, 'GBP', 800, 'No'],
    // R-06 lithium power bank (blocked) and perfume (needs a question).
    ['BK-106', 'TechGear Direct', 'Birmingham', 'United Kingdom', 'Lyon', 'France', 'Business address', inDays(7), 'Fastest', 2, 60, 9000, 'GBP', 300, 'No'],
    // R-07 items weigh 540 kg but gross is 400 kg. R-08 warehouse with no appointment.
    ['BK-107', 'Moorland Foods', 'Leeds', 'United Kingdom', 'Rotterdam', 'Netherlands', 'Warehouse', inDays(13), 'Balanced', 3, 90, 5400, 'GBP', 400, 'No'],
    // R-10 ship date is in the past.
    ['BK-108', 'Dales Crafts', 'Manchester', 'United Kingdom', 'Berlin', 'Germany', 'Business address', '01-01-2024', 'Cheapest', 2, 60, 3600, 'GBP', 420, 'No'],
    // Clean, but written the way real spreadsheets are: dotted HS code, lowercase priority.
    ['BK-109', 'Harbour Home', 'London', 'United Kingdom', 'Rotterdam', 'Netherlands', 'Warehouse', inDays(15), 'balanced', 2, 40, 2400, 'GBP', 330, 'yes'],
    // Duplicate booking ID (data issue).
    ['BK-102', 'Duplicate Trader', 'London', 'United Kingdom', 'Paris', 'France', 'Business address', inDays(10), 'Cheapest', 1, 10, 500, 'GBP', 100, 'No'],
  ];

  const itemsData: (string | number)[][] = [
    ['Items: one row per record. Row 3 is an example (grey); enter data from row 4.'],
    ['Booking ID', 'SKU', 'Description', 'HS code', 'Quantity (units)', 'Unit price', 'Units per carton', 'Cartons', 'Unit weight (kg)', 'Country of origin'],
    ['BK-001', 'MUG-01', 'Ceramic coffee mug, 350 ml', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'],
    ['BK-101', 'VASE-01', 'Decorative ceramic vase, large', 691390, 600, 6, 10, 60, 0.8, 'China'],
    ['BK-102', 'SCARF-01', 'Wool winter scarf', '', 1200, 6, 10, 120, 0.15, ''],
    ['BK-103', 'BOWL-01', 'Stoneware mixing bowl', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'],
    ['BK-104', 'CUP-01', 'Espresso cup set', 691200, 540, 5, 15, 40, 0.3, 'Turkey'],
    ['BK-105', 'PLATE-01', 'Cast iron decorative plate', 732399, 200, 20, 10, 20, 3.5, 'India'],
    ['BK-106', 'BATT-01', 'Lithium-ion power bank 10000mAh', 850760, 400, 15, 10, 40, 0.25, 'China'],
    ['BK-106', 'PERF-01', 'Perfume gift set, 50ml', 330300, 200, 15, 10, 20, 0.3, 'Germany'],
    ['BK-107', 'MUG-02', 'Travel mug with lid', 691200, 1080, 5, 12, 90, 0.5, 'Vietnam'],
    ['BK-108', 'TILE-01', 'Hand-painted ceramic tile', 690790, 600, 6, 10, 60, 0.4, 'Germany'],
    ['BK-109', 'BOWL-02', 'Glazed serving bowl', '6912.00', 400, 6, 10, 40, 0.6, 'United Kingdom'],
    // Orphan item (data issue): no matching booking.
    ['BK-999', 'ORPHAN-01', 'Mystery product', 999999, 100, 10, 10, 10, 1.0, 'United Kingdom'],
  ];

  const bookingsSheet = XLSX.utils.aoa_to_sheet(bookingsData);
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(wb, bookingsSheet, 'Bookings');
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items');
  return wb;
}

export const SAMPLE_FILE_NAME = 'ReadyRoute_Sample_Data.xlsx';

/** The practice workbook as bytes, for running it without a download. */
export function sampleWorkbookBuffer(): ArrayBuffer {
  return XLSX.write(buildSampleWorkbook(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function generateSampleWorkbook() {
  XLSX.writeFile(buildSampleWorkbook(), SAMPLE_FILE_NAME);
}
