import Decimal from 'decimal.js';
import type { Booking, Finding, Item } from './schemas';
import { RATE_CARD } from './constants';
import { addDays, formatDDMMYYYY, nextWorkingDay, todayInLondon } from './normalise';

export interface QuickFix {
  label: string;
  /** What changes, in one line, shown before the person presses the button. */
  detail: string;
  apply: (booking: Booking, items: Item[]) => { booking: Booking; items: Item[] };
}

const sum = (items: Item[], f: (i: Item) => Decimal) => items.reduce((s, i) => s.plus(f(i)), new Decimal(0));

/**
 * A one-press repair for a finding, when there is exactly one sensible answer.
 * Anything that needs a fact only the shipper knows (an HS code, a country of
 * origin) has no quick fix.
 */
export function getQuickFix(f: Finding, booking: Booking, items: Item[]): QuickFix | null {
  if (f.status !== 'fail' && f.status !== 'needs_clarification') return null;

  switch (f.ruleId) {
    case 'R-02': {
      if (items.some(i => i.quantity == null || i.unitPrice == null)) return null;
      const total = sum(items, i => new Decimal(i.quantity!).times(i.unitPrice!)).toDecimalPlaces(2).toNumber();
      return {
        label: 'Use the calculated value',
        detail: `Declared value becomes £${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}.`,
        apply: (b, its) => ({ booking: { ...b, totalDeclaredValue: total }, items: its }),
      };
    }
    case 'R-03': {
      const sku = f.affectedItem?.sku;
      const it = items.find(i => i.sku === sku);
      if (!it || it.quantity == null || !it.unitsPerCarton) return null;
      const cartons = it.quantity / it.unitsPerCarton;
      if (!Number.isInteger(cartons)) return null;
      return {
        label: `Set cartons to ${cartons}`,
        detail: `${it.quantity} units at ${it.unitsPerCarton} per carton is ${cartons} cartons.`,
        apply: (b, its) => ({ booking: b, items: its.map(i => (i.sku === sku ? { ...i, cartons } : i)) }),
      };
    }
    case 'R-04': {
      if (items.some(i => i.cartons == null)) return null;
      const total = items.reduce((s, i) => s + (i.cartons ?? 0), 0);
      return {
        label: `Set booking cartons to ${total}`,
        detail: `The products add up to ${total} cartons.`,
        apply: (b, its) => ({ booking: { ...b, cartons: total }, items: its }),
      };
    }
    case 'R-05': {
      if (!booking.totalGrossWeight || !booking.destinationCountry) return null;
      const limits = RATE_CARD.filter(s => s.destinationCountry === booking.destinationCountry).map(s => s.maxKgPerPallet);
      if (limits.length === 0) return null;
      const strongest = Math.max(...limits);
      const pallets = Math.ceil(booking.totalGrossWeight / strongest);
      if (pallets <= (booking.pallets ?? 0)) return null;
      const per = new Decimal(booking.totalGrossWeight).div(pallets).toDecimalPlaces(0).toNumber();
      return {
        label: `Spread over ${pallets} pallets`,
        detail: `${booking.totalGrossWeight} kg over ${pallets} pallets is about ${per} kg each, under the ${strongest} kg limit.`,
        apply: (b, its) => ({ booking: { ...b, pallets }, items: its }),
      };
    }
    case 'R-06': {
      if (f.status !== 'fail' || !f.affectedItem) return null;
      const sku = f.affectedItem.sku;
      return {
        label: 'Remove this product',
        detail: `${f.affectedItem.description} comes off the booking. Cartons and value update to match.`,
        apply: (b, its) => {
          const kept = its.filter(i => i.sku !== sku);
          const hasAll = kept.every(i => i.cartons != null);
          const value = kept.every(i => i.quantity != null && i.unitPrice != null)
            ? sum(kept, i => new Decimal(i.quantity!).times(i.unitPrice!)).toDecimalPlaces(2).toNumber()
            : b.totalDeclaredValue;
          return {
            booking: { ...b, cartons: hasAll ? kept.reduce((s, i) => s + (i.cartons ?? 0), 0) : b.cartons, totalDeclaredValue: value },
            items: kept,
          };
        },
      };
    }
    case 'R-08':
      return {
        label: 'I have booked it',
        detail: 'Marks the delivery appointment as booked. Only press this once the slot is confirmed.',
        apply: (b, its) => ({ booking: { ...b, deliveryAppointmentBooked: 'Yes' }, items: its }),
      };
    case 'R-10': {
      const next = formatDDMMYYYY(nextWorkingDay(addDays(todayInLondon(), 1)));
      return {
        label: `Move to ${next}`,
        detail: 'The next working day. Change it if the goods are ready later.',
        apply: (b, its) => ({ booking: { ...b, readyToShipDate: next }, items: its }),
      };
    }
    default:
      return null;
  }
}
