import { describe, it, expect } from 'vitest';
import {
  checkR01, checkR02, checkR03, checkR04, checkR05,
  checkR06, checkR07, checkR08, checkR09, checkR10,
  computeBookingStatus,
} from '../rules-engine';
import type { Booking, Item } from '../schemas';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    bookingId: 'BK-TEST',
    sellerName: 'Test Co',
    originCity: 'London',
    originCountry: 'United Kingdom',
    destinationCity: 'Berlin',
    destinationCountry: 'Germany',
    destinationType: 'Business address',
    readyToShipDate: '15-12-2026',
    sellerPriority: 'Cheapest',
    pallets: 2,
    cartons: 60,
    totalDeclaredValue: 3600,
    currency: 'GBP',
    totalGrossWeight: 500,
    deliveryAppointmentBooked: 'No',
    ...overrides,
  };
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    bookingId: 'BK-TEST',
    sku: 'TEST-01',
    description: 'Test widget',
    hsCode: '691200',
    quantity: 600,
    unitPrice: 6,
    unitsPerCarton: 10,
    cartons: 60,
    unitWeight: 0.5,
    countryOfOrigin: 'China',
    ...overrides,
  };
}

const booking = makeBooking();

describe('R-01: HS Code Validation', () => {
  it('passes for 6+ digit HS code', () => {
    const findings = checkR01(booking, [makeItem({ hsCode: '691200' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });

  it('fails for HS code with fewer than 6 digits', () => {
    const findings = checkR01(booking, [makeItem({ hsCode: '6912' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('fail');
    expect(findings[0].severity).toBe('Red');
  });

  it('fails for missing HS code', () => {
    const findings = checkR01(booking, [makeItem({ hsCode: '' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('fail');
  });

  it('handles HS codes with dots/spaces by stripping them', () => {
    const findings = checkR01(booking, [makeItem({ hsCode: '69.12.00' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });
});

describe('R-02: Declared Value Check', () => {
  it('passes when declared value matches calculated (within 1%)', () => {
    const b = makeBooking({ totalDeclaredValue: 3600 });
    const items = [makeItem({ quantity: 600, unitPrice: 6 })];
    const finding = checkR02(b, items);
    expect(finding.status).toBe('pass');
  });

  it('fails when declared value deviates more than 1%', () => {
    const b = makeBooking({ totalDeclaredValue: 10000 });
    const items = [makeItem({ quantity: 600, unitPrice: 6 })];
    const finding = checkR02(b, items);
    expect(finding.status).toBe('fail');
    expect(finding.severity).toBe('Red');
  });
});

describe('R-03: Quantity vs Cartons', () => {
  it('passes when unitsPerCarton * cartons = quantity', () => {
    const findings = checkR03(booking, [makeItem({ quantity: 600, unitsPerCarton: 10, cartons: 60 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });

  it('fails when the math does not match', () => {
    const findings = checkR03(booking, [makeItem({ quantity: 540, unitsPerCarton: 15, cartons: 40 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('fail');
    expect(findings[0].severity).toBe('Red');
  });
});

describe('R-04: Booking Cartons = Sum of Item Cartons', () => {
  it('passes when booking cartons equals sum', () => {
    const b = makeBooking({ cartons: 60 });
    const finding = checkR04(b, [makeItem({ cartons: 60 })]);
    expect(finding.status).toBe('pass');
  });

  it('fails when booking cartons differs from sum', () => {
    const b = makeBooking({ cartons: 100 });
    const finding = checkR04(b, [makeItem({ cartons: 40 })]);
    expect(finding.status).toBe('fail');
    expect(finding.severity).toBe('Red');
  });
});

describe('R-05: Weight per Pallet', () => {
  it('passes when weight per pallet is under carrier max', () => {
    const b = makeBooking({ totalGrossWeight: 500, pallets: 2 });
    const finding = checkR05(b, [], 500);
    expect(finding.status).toBe('pass');
  });

  it('fails when weight per pallet exceeds max', () => {
    const b = makeBooking({ totalGrossWeight: 800, pallets: 1 });
    const finding = checkR05(b, [], 300);
    expect(finding.status).toBe('fail');
    expect(finding.severity).toBe('Red');
  });

  it('returns not_checked when pallets is 0', () => {
    const b = makeBooking({ totalGrossWeight: 500, pallets: 0 });
    const finding = checkR05(b, [], 500);
    expect(finding.status).toBe('not_checked');
  });
});

describe('R-06: Prohibited Goods', () => {
  it('fails with Red for Tier 1 terms', () => {
    const findings = checkR06(booking, [makeItem({ description: 'Lithium-ion power bank' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('fail');
    expect(findings[0].severity).toBe('Red');
  });

  it('returns needs_clarification for Tier 2 terms', () => {
    const findings = checkR06(booking, [makeItem({ description: 'Perfume gift set' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('needs_clarification');
  });

  it('passes for safe descriptions', () => {
    const findings = checkR06(booking, [makeItem({ description: 'Ceramic coffee mug' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });

  it('excludes safe terms like battery-free', () => {
    const findings = checkR06(booking, [makeItem({ description: 'Battery-free torch' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });
});

describe('R-07: Gross Weight Check', () => {
  it('passes when gross weight >= sum of item weights', () => {
    const b = makeBooking({ totalGrossWeight: 500 });
    const items = [makeItem({ quantity: 600, unitWeight: 0.5 })];
    const finding = checkR07(b, items);
    expect(finding.status).toBe('pass');
  });

  it('fails when gross weight < sum of item weights', () => {
    const b = makeBooking({ totalGrossWeight: 200 });
    const items = [makeItem({ quantity: 600, unitWeight: 0.5 })];
    const finding = checkR07(b, items);
    expect(finding.status).toBe('fail');
  });
});

describe('R-08: Warehouse Appointment', () => {
  it('fails (Amber) for Warehouse without appointment', () => {
    const b = makeBooking({ destinationType: 'Warehouse', deliveryAppointmentBooked: 'No' });
    const finding = checkR08(b);
    expect(finding.status).toBe('fail');
    expect(finding.severity).toBe('Amber');
  });

  it('passes for Warehouse with appointment', () => {
    const b = makeBooking({ destinationType: 'Warehouse', deliveryAppointmentBooked: 'Yes' });
    const finding = checkR08(b);
    expect(finding.status).toBe('pass');
  });

  it('passes for Business address (always)', () => {
    const b = makeBooking({ destinationType: 'Business address', deliveryAppointmentBooked: 'No' });
    const finding = checkR08(b);
    expect(finding.status).toBe('pass');
  });
});

describe('R-09: Country of Origin', () => {
  it('passes when country of origin is present', () => {
    const findings = checkR09(booking, [makeItem({ countryOfOrigin: 'China' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('pass');
  });

  it('fails when country of origin is missing', () => {
    const findings = checkR09(booking, [makeItem({ countryOfOrigin: '' })]);
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('fail');
  });
});

describe('R-10: Ready-to-Ship Date', () => {
  it('passes for future date', () => {
    const finding = checkR10(makeBooking({ readyToShipDate: '15-12-2027' }));
    expect(finding.status).toBe('pass');
  });

  it('fails for past date', () => {
    const finding = checkR10(makeBooking({ readyToShipDate: '01-01-2024' }));
    expect(finding.status).toBe('fail');
  });
});

describe('computeBookingStatus', () => {
  it('returns "blocked" if any Red fail', () => {
    const findings = [
      { ruleId: 'R-01', ruleName: 'HS Code', severity: 'Red' as const, status: 'fail' as const, affectedBookingId: 'BK-TEST', evidence: '', whyItMatters: '', fix: '' },
    ];
    expect(computeBookingStatus(findings)).toBe('blocked');
  });

  it('returns "review" if Amber fail but no Red', () => {
    const findings = [
      { ruleId: 'R-08', ruleName: 'Appointment', severity: 'Amber' as const, status: 'fail' as const, affectedBookingId: 'BK-TEST', evidence: '', whyItMatters: '', fix: '' },
    ];
    expect(computeBookingStatus(findings)).toBe('review');
  });

  it('returns "clear" when all pass', () => {
    const findings = [
      { ruleId: 'R-01', ruleName: 'HS Code', severity: 'Red' as const, status: 'pass' as const, affectedBookingId: 'BK-TEST', evidence: '', whyItMatters: '', fix: '' },
    ];
    expect(computeBookingStatus(findings)).toBe('clear');
  });
});
