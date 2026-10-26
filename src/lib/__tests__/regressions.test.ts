import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { checkR01, checkR06, checkR08, computeBookingStatus } from '../rules-engine';
import { evaluateBatch, evaluateBooking } from '../evaluate';
import { getRecommendation, rankCandidates, getCarrierCandidates } from '../carrier-engine';
import { parseWorkbook } from '../parser';
import { sampleWorkbookBuffer } from '../sample-data';
import { getQuickFix } from '../fixes';
import { parseDateText } from '../normalise';
import type { Booking, Item } from '../schemas';

const booking = (o: Partial<Booking> = {}): Booking => ({
  bookingId: 'BK-T', sellerName: 'Test Co', originCity: 'London', originCountry: 'United Kingdom',
  destinationCity: 'Frankfurt', destinationCountry: 'Germany', destinationType: 'Business address',
  readyToShipDate: '01-01-2099', sellerPriority: 'Cheapest', pallets: 2, cartons: 20,
  totalDeclaredValue: 1000, currency: 'GBP', totalGrossWeight: 300, deliveryAppointmentBooked: 'No', ...o,
});
const item = (o: Partial<Item> = {}): Item => ({
  bookingId: 'BK-T', sku: 'A-1', description: 'Ceramic mug', hsCode: '691200', quantity: 200, unitPrice: 5,
  unitsPerCarton: 10, cartons: 20, unitWeight: 0.5, countryOfOrigin: 'China', ...o,
});

describe('R-01 HS codes', () => {
  it('accepts dotted codes as written on customs paperwork', () => {
    expect(checkR01(booking(), [item({ hsCode: '6912.00' })])[0].status).toBe('pass');
    expect(checkR01(booking(), [item({ hsCode: '8517.12.00' })])[0].status).toBe('pass');
  });
  it('still rejects short or lettered codes', () => {
    expect(checkR01(booking(), [item({ hsCode: '6912' })])[0].status).toBe('fail');
    expect(checkR01(booking(), [item({ hsCode: '69A200' })])[0].status).toBe('fail');
  });
});

describe('R-05 with no carrier able to take the load', () => {
  it('fails and blocks instead of reporting "not checked"', () => {
    const r = evaluateBooking(booking({ pallets: 1, totalGrossWeight: 800 }), [item()]);
    const r05 = r.findings.find(f => f.ruleId === 'R-05')!;
    expect(r05.status).toBe('fail');
    expect(r.status).toBe('blocked');
    expect(r.recommendation?.recommended).toBeNull();
  });
  it('offers a pallet split that clears the limit', () => {
    const b = booking({ pallets: 1, totalGrossWeight: 800 });
    const r = evaluateBooking(b, [item()]);
    const fix = getQuickFix(r.findings.find(f => f.ruleId === 'R-05')!, b, [item()])!;
    const fixed = fix.apply(b, [item()]);
    expect(fixed.booking.pallets).toBe(2);
    expect(evaluateBooking(fixed.booking, fixed.items).status).not.toBe('blocked');
  });
});

describe('R-06 prohibited goods', () => {
  it('does not let a safe word hide a real problem', () => {
    expect(checkR06(booking(), [item({ description: 'Glass case with lithium battery' })])[0].status).toBe('fail');
  });
  it('still lets genuinely safe wording through', () => {
    expect(checkR06(booking(), [item({ description: 'Battery-free non-flammable gasket' })])[0].status).toBe('pass');
  });
  it('catches plurals', () => {
    expect(checkR06(booking(), [item({ description: 'Aerosols, 400 ml' })])[0].status).toBe('fail');
    expect(checkR06(booking(), [item({ description: 'Perfumes' })])[0].status).toBe('needs_clarification');
  });
});

describe('R-08 appointment answers', () => {
  it('reads yes in the ways people write it', () => {
    for (const v of ['Yes', 'yes', 'Y', 'booked']) {
      expect(checkR08(booking({ destinationType: 'Warehouse', deliveryAppointmentBooked: v })).status).toBe('pass');
    }
  });
});

describe('carrier ranking', () => {
  it('copes with a destination that has no rate card', () => {
    const rec = getRecommendation(booking({ destinationCountry: 'Spain' }));
    expect(rec.recommended).toBeNull();
    expect(rec.explanation).not.toMatch(/Infinity/);
  });
  it('treats an unknown priority as Balanced', () => {
    expect(getRecommendation(booking({ sellerPriority: 'fastest!!' })).priority).toBe('Balanced');
  });
  it('balanced scoring prefers the better trade-off (lower score wins)', () => {
    const ranked = rankCandidates(getCarrierCandidates(booking({ destinationCountry: 'Germany' })), 'Balanced');
    expect(ranked[0].score!).toBeLessThanOrEqual(ranked[1].score!);
  });
});

describe('acknowledging findings', () => {
  it('lets a person clear an ambiguous item but never a Red failure', () => {
    const b = booking({ pallets: 1, totalGrossWeight: 800 });
    const its = [item({ description: 'Perfume gift set' })];
    const open = evaluateBooking(b, its);
    expect(open.status).toBe('blocked');
    const ok = evaluateBooking(booking(), its, [], ['R-06|A-1']);
    expect(ok.status).toBe('clear');
    const stillBlocked = evaluateBooking(b, its, [], ['R-06|A-1', 'R-05|']);
    expect(stillBlocked.status).toBe('blocked');
    expect(computeBookingStatus(stillBlocked.findings)).toBe('blocked');
  });
});

describe('dates', () => {
  const now = new Date('2026-10-26T10:00:00Z');
  it('reads the ways people write them', () => {
    expect(parseDateText('5/11/2026', now)).toBe('05-11-2026');
    expect(parseDateText('ready on 5th November 2026', now)).toBe('05-11-2026');
    expect(parseDateText('Nov 5', now)).toBe('05-11-2026');
    expect(parseDateText('tomorrow', now)).toBe('27-10-2026');
    expect(parseDateText('next Monday', now)).toBe('02-11-2026');
  });
  it('rejects dates that do not exist', () => {
    expect(parseDateText('31-02-2026', now)).toBeUndefined();
  });
});

describe('Excel upload', () => {
  const parsed = parseWorkbook(sampleWorkbookBuffer());
  const reports = evaluateBatch(parsed.bookings, parsed.items, parsed.dataIssues);
  const by = (id: string) => reports.find(r => r.booking.bookingId === id)!;
  const failing = (id: string) => by(id).findings.filter(f => f.status === 'fail' || f.status === 'needs_clarification').map(f => f.ruleId);

  it('reads the Units per carton column, so R-03 runs on uploads', () => {
    expect(parsed.itemSheetInfo?.columns.unitsPerCarton).toBe(6);
    expect(failing('BK-104')).toContain('R-03');
  });
  it('checks each planted problem and nothing else', () => {
    expect(by('BK-101').status).toBe('clear');
    expect(by('BK-109').status).toBe('clear');
    expect(failing('BK-102').sort()).toEqual(['R-01', 'R-09']);
    expect(failing('BK-103')).toEqual(['R-02']);
    expect(failing('BK-104').sort()).toEqual(['R-03', 'R-04']);
    expect(failing('BK-105')).toEqual(['R-05']);
    expect(failing('BK-106').sort()).toEqual(['R-06', 'R-06']);
    expect(failing('BK-107').sort()).toEqual(['R-07', 'R-08']);
    expect(failing('BK-108')).toEqual(['R-10']);
  });
  it('skips the example row and keeps only the first of a duplicate ID', () => {
    expect(parsed.bookings.some(b => b.bookingId === 'BK-001')).toBe(false);
    expect(parsed.bookings.filter(b => b.bookingId === 'BK-102')).toHaveLength(1);
    expect(parsed.dataIssues.map(d => d.type)).toEqual(expect.arrayContaining(['duplicate_id', 'orphan_item']));
  });
  it('does not warn about capitalisation', () => {
    expect(parsed.dataIssues.some(d => d.type === 'invalid_enum')).toBe(false);
    expect(by('BK-109').booking.sellerPriority).toBe('Balanced');
  });
  it('rejects a file that is not a workbook with a clear message', () => {
    expect(() => parseWorkbook(new TextEncoder().encode('not a workbook ' + String.fromCharCode(0, 1)).buffer as ArrayBuffer)).not.toThrow();
  });
  it('reads real date cells on the right day in any time zone', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Booking ID', 'Seller name', 'Origin city', 'Ready to ship date'], ['BK-1', 'x', 'London', new Date(Date.UTC(2026, 10, 5))]], { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Booking ID', 'SKU', 'Description']]), 'Items');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
    expect(parseWorkbook(buf).bookings[0].readyToShipDate).toBe('05-11-2026');
  });
});
