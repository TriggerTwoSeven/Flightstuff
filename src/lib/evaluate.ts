import type { Booking, Item, BookingReport } from './schemas';
import { evaluateAllRules, computeBookingStatus } from './rules-engine';
import { getRecommendation } from './carrier-engine';
import type { DataIssue } from './schemas';

export function evaluateBooking(
  booking: Booking,
  items: Item[],
  dataIssues: DataIssue[] = []
): BookingReport {
  const recommendation = getRecommendation(booking);

  const maxKg = recommendation.recommended?.maxKgPerPallet;
  const serviceName = recommendation.recommended
    ? `${recommendation.recommended.carrier} ${recommendation.recommended.service}`
    : undefined;

  const findings = evaluateAllRules(booking, items, maxKg, serviceName);
  const status = computeBookingStatus(findings);

  return {
    booking,
    items,
    findings,
    status,
    recommendation,
    dataIssues,
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
    const bookingDataIssues = dataIssues.filter(
      d => d.message.includes(booking.bookingId) || d.type === 'missing_sheet'
    );
    return evaluateBooking(booking, bookingItems, bookingDataIssues);
  });
}
