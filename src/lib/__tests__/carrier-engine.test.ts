import { describe, it, expect } from 'vitest';
import { getCarrierCandidates, rankCandidates, getRecommendation } from '../carrier-engine';
import type { Booking } from '../schemas';

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
    totalGrossWeight: 400,
    deliveryAppointmentBooked: 'No',
    ...overrides,
  };
}

describe('getCarrierCandidates', () => {
  it('filters carriers by destination country', () => {
    const candidates = getCarrierCandidates(makeBooking({ destinationCountry: 'Germany' }));
    expect(candidates.length).toBeGreaterThan(0);
    candidates.forEach(c => {
      expect(c.destinationCountry).toBe('Germany');
    });
  });

  it('returns empty for unsupported country', () => {
    const candidates = getCarrierCandidates(makeBooking({ destinationCountry: 'Japan' }));
    expect(candidates).toHaveLength(0);
  });

  it('marks candidates as ineligible when weight exceeds max', () => {
    const candidates = getCarrierCandidates(makeBooking({ totalGrossWeight: 800, pallets: 1 }));
    const ineligible = candidates.filter(c => !c.eligible);
    expect(ineligible.length).toBeGreaterThan(0);
    ineligible.forEach(c => {
      expect(c.ineligibleReason).toContain('exceeds');
    });
  });
});

describe('rankCandidates', () => {
  it('ranks by cost for Cheapest priority', () => {
    const candidates = getCarrierCandidates(makeBooking());
    const ranked = rankCandidates(candidates, 'Cheapest');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].totalCost).toBeGreaterThanOrEqual(ranked[i - 1].totalCost);
    }
  });

  it('ranks by transit for Fastest priority', () => {
    const candidates = getCarrierCandidates(makeBooking());
    const ranked = rankCandidates(candidates, 'Fastest');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].transitDays).toBeGreaterThanOrEqual(ranked[i - 1].transitDays);
    }
  });

  it('ranks by on-time for Most reliable priority', () => {
    const candidates = getCarrierCandidates(makeBooking());
    const ranked = rankCandidates(candidates, 'Most reliable');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].onTimePercent).toBeLessThanOrEqual(ranked[i - 1].onTimePercent);
    }
  });

  it('produces scores for Balanced priority', () => {
    const candidates = getCarrierCandidates(makeBooking());
    const ranked = rankCandidates(candidates, 'Balanced');
    ranked.forEach(c => {
      expect(c.score).toBeDefined();
      expect(typeof c.score).toBe('number');
    });
  });
});

describe('getRecommendation', () => {
  it('returns a recommendation for Germany with Cheapest priority', () => {
    const rec = getRecommendation(makeBooking());
    expect(rec.recommended).not.toBeNull();
    expect(rec.recommended!.carrier).toBeTruthy();
    expect(rec.explanation).toBeTruthy();
    expect(rec.priority).toBe('Cheapest');
  });

  it('returns no eligible when weight is too high', () => {
    const rec = getRecommendation(makeBooking({ totalGrossWeight: 2000, pallets: 1 }));
    expect(rec.recommended).toBeNull();
    expect(rec.noEligibleReason).toBeTruthy();
  });

  it('provides a best alternative when available', () => {
    const rec = getRecommendation(makeBooking());
    if (rec.allCandidates.filter(c => c.eligible).length > 1) {
      expect(rec.bestAlternative).not.toBeNull();
      expect(rec.alternativeTradeoff).toBeTruthy();
    }
  });

  it('Balanced mode explanation mentions scoring', () => {
    const rec = getRecommendation(makeBooking({ sellerPriority: 'Balanced' }));
    expect(rec.recommended).not.toBeNull();
    expect(rec.explanation).toContain('Balanced');
  });
});
