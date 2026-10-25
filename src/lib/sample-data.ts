import * as XLSX from 'xlsx';

export function generateSampleWorkbook() {
  const wb = XLSX.utils.book_new();

  const bookingsData = [
    ['Bookings — one row per record. Row 3 is an example (grey); enter data from row 4.'],
    ['Booking ID', 'Seller name', 'Origin city', 'Origin country', 'Destination city', 'Destination country', 'Destination type', 'Ready to ship date', 'Seller priority', 'Pallets', 'Cartons', 'Total declared value', 'Currency', 'Total gross weight (kg)', 'Delivery appointment booked'],
    ['BK-001', 'Northfield Goods', 'Manchester', 'United Kingdom', 'Frankfurt', 'Germany', 'Warehouse', '05-11-2026', 'Cheapest', 3, 90, 5400, 'GBP', 620, 'Yes'],
    // BK-101: Clean booking - all checks should pass
    ['BK-101', 'Greenfield Ceramics', 'London', 'United Kingdom', 'Berlin', 'Germany', 'Business address', '15-12-2026', 'Fastest', 2, 60, 3600, 'GBP', 400, 'No'],
    // BK-102: R-01 fail - missing HS code + R-09 fail - missing country of origin
    ['BK-102', 'Highland Textiles', 'Birmingham', 'United Kingdom', 'Paris', 'France', 'Warehouse', '20-11-2026', 'Most reliable', 4, 120, 7200, 'GBP', 850, 'Yes'],
    // BK-103: R-02 fail - declared value mismatch (declared 10000, should be 5400)
    ['BK-103', 'Lakeside Pottery', 'Leeds', 'United Kingdom', 'Amsterdam', 'Netherlands', 'Business address', '10-12-2026', 'Balanced', 3, 90, 10000, 'GBP', 620, 'No'],
    // BK-104: R-03 fail - units per carton mismatch + R-04 fail - booking cartons mismatch
    ['BK-104', 'Westfield Imports', 'Manchester', 'United Kingdom', 'Hamburg', 'Germany', 'Warehouse', '01-12-2026', 'Cheapest', 2, 100, 2700, 'GBP', 380, 'Yes'],
    // BK-105: R-05 fail (no eligible carrier) - 800 kg/pallet exceeds all limits
    ['BK-105', 'Ironside Metals', 'London', 'United Kingdom', 'Frankfurt', 'Germany', 'Business address', '05-12-2026', 'Cheapest', 1, 20, 4000, 'GBP', 800, 'No'],
    // BK-106: R-06 fail - prohibited goods (lithium battery)
    ['BK-106', 'TechGear Direct', 'Birmingham', 'United Kingdom', 'Lyon', 'France', 'Business address', '18-11-2026', 'Fastest', 2, 40, 6000, 'GBP', 300, 'No'],
    // BK-107: R-07 fail - gross weight less than item weights + R-08 fail - warehouse without appointment
    ['BK-107', 'Moorland Foods', 'Leeds', 'United Kingdom', 'Rotterdam', 'Netherlands', 'Warehouse', '22-11-2026', 'Balanced', 3, 90, 5400, 'GBP', 400, 'No'],
    // BK-108: R-10 fail - date in the past
    ['BK-108', 'Dales Crafts', 'Manchester', 'United Kingdom', 'Berlin', 'Germany', 'Business address', '01-01-2024', 'Cheapest', 2, 60, 3600, 'GBP', 420, 'No'],
    // BK-102 duplicate ID (data issue)
    ['BK-102', 'Duplicate Trader', 'London', 'United Kingdom', 'Paris', 'France', 'Business address', '10-12-2026', 'Cheapest', 1, 10, 500, 'GBP', 100, 'No'],
  ];

  const itemsData = [
    ['Items — one row per record. Row 3 is an example (grey); enter data from row 4.'],
    ['Booking ID', 'SKU', 'Description', 'HS code', 'Quantity (units)', 'Unit price', 'Units per carton', 'Cartons', 'Unit weight (kg)', 'Country of origin'],
    ['BK-001', 'MUG-01', 'Ceramic coffee mug, 350 ml', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'],
    // BK-101 items (clean)
    ['BK-101', 'VASE-01', 'Decorative ceramic vase, large', 691390, 600, 6, 10, 60, 0.8, 'China'],
    // BK-102 items (R-01: blank HS, R-09: blank country of origin)
    ['BK-102', 'SCARF-01', 'Wool winter scarf', '', 1200, 6, 10, 120, 0.15, ''],
    // BK-103 items (R-02: value mismatch - 1080 * 5 = 5400 but booking says 10000)
    ['BK-103', 'BOWL-01', 'Stoneware mixing bowl', 691200, 1080, 5, 12, 90, 0.5, 'United Kingdom'],
    // BK-104 items (R-03: 15 * 40 = 600 ≠ 540; R-04: booking says 100 but item says 40)
    ['BK-104', 'CUP-01', 'Espresso cup set', 691200, 540, 5, 15, 40, 0.3, 'Turkey'],
    // BK-105 items (heavy - triggers R-05)
    ['BK-105', 'PLATE-01', 'Cast iron decorative plate', 732399, 200, 20, 10, 20, 3.5, 'India'],
    // BK-106 items (R-06: lithium battery)
    ['BK-106', 'BATT-01', 'Lithium-ion power bank 10000mAh', 850760, 400, 15, 10, 40, 0.25, 'China'],
    // BK-107 items (R-07: item weight 540 kg > gross 400 kg)
    ['BK-107', 'MUG-02', 'Travel mug with lid', 691200, 1080, 5, 12, 90, 0.5, 'Vietnam'],
    // BK-108 items (clean items, booking date is wrong)
    ['BK-108', 'TILE-01', 'Hand-painted ceramic tile', 690790, 600, 6, 10, 60, 0.4, 'Germany'],
    // Orphan item (data issue - no matching booking)
    ['BK-999', 'ORPHAN-01', 'Mystery product', 999999, 100, 10, 10, 10, 1.0, 'United Kingdom'],
    // BK-106 second item (R-06 tier 2: perfume)
    ['BK-106', 'PERF-01', 'Perfume gift set, 50ml', 330300, 200, 15, 10, 20, 0.3, 'France'],
  ];

  const bookingsSheet = XLSX.utils.aoa_to_sheet(bookingsData);
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);

  XLSX.utils.book_append_sheet(wb, bookingsSheet, 'Bookings');
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items');

  XLSX.writeFile(wb, 'ReadyRoute_Sample_Data.xlsx');
}
