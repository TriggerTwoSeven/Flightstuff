import type { Booking, Item, BookingReport, DataIssue } from './schemas';
import { evaluateAllRules, computeBookingStatus, findingKey } from './rules-engine';
import { getRecommendation } from './carrier-engine';

export function evaluateBooking(
  booking: Booking,
  items: Item[],
  dataIssues: DataIssue[] = [],
  acknowledged: string[] = []
): BookingReport {
  const recommendation = getRecommendation(booking);

  // R-05 is checked against the recommended service. When nothing on the route
  // can carry the load, it is checked against the strongest service instead, so
  // an overweight booking fails (and blocks) instead of quietly "not checked".
  let maxKg = recommendation.recommended?.maxKgPerPallet;
  let serviceName = recommendation.recommended
    ? `${recommendation.recommended.carrier} ${recommendation.recommended.service}`
    : undefined;
  if (maxKg == null && recommendation.allCandidates.length > 0) {
    const strongest = recommendation.allCandidates.reduce((a, b) => (b.maxKgPerPallet > a.maxKgPerPallet ? b : a));
    maxKg = strongest.maxKgPerPallet;
    serviceName = `${strongest.carrier} ${strongest.service}, the highest-capacity service on this route`;
  }

  const ack = new Set(acknowledged);
  const findings = evaluateAllRules(booking, items, maxKg, serviceName).map(f =>
    ack.has(findingKey(f)) && !(f.severity === 'Red' && f.status === 'fail') ? { ...f, acknowledged: true } : f
  );
  const status = computeBookingStatus(findings);

  return {
    booking,
    items,
    findings,
    status,
    recommendation,
    dataIssues,
    acknowledged,
  };
}

export function evaluateBatch(
  bookings: Booking[],
  items: Item[],
  dataIssues: DataIssue[] = []
): BookingReport[] {
  return bookings.map(booking => {
    const bookingItems = items.filter(
      i => i.bookingId.trim().toLowerCase() === booking.bookingId.trim().toLowerCase()
    );
    const key = booking.bookingId.trim().toLowerCase();
    const bookingDataIssues = dataIssues.filter(
      d => (d.bookingId ?? '').trim().toLowerCase() === key || d.type === 'missing_sheet'
    );
    return evaluateBooking(booking, bookingItems, bookingDataIssues);
  });
}
