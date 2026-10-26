import Decimal from 'decimal.js';
import type { Booking, Item, Finding, BookingStatus } from './schemas';
import { todayInLondon } from './normalise';
import { PROHIBITED_TERMS_TIER1, PROHIBITED_TERMS_TIER2, SAFE_TERMS } from './constants';

/**
 * Tidy an HS code from a spreadsheet or a chat message.
 * Accepts the dotted forms customs paperwork uses ("6912.00", "8517.12.00"),
 * spaces, and numeric cells. Anything with letters is left for R-01 to reject.
 */
export function normaliseHsCode(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? String(Math.trunc(raw)) : '';
  }
  const s = raw.trim();
  if (/^[\d\s.\-]+$/.test(s)) return s.replace(/[\s.\-]/g, '');
  return s.replace(/\s+/g, '');
}

export function checkR01(booking: Booking, items: Item[]): Finding[] {
  return items.map((item): Finding => {
    const normalised = normaliseHsCode(item.hsCode);
    const isBlank = normalised === '';
    const isAllDigits = /^\d+$/.test(normalised);
    const isLongEnough = normalised.length >= 6;
    const pass = !isBlank && isAllDigits && isLongEnough;

    let evidence = '';
    let fix = '';
    if (isBlank) {
      evidence = `HS code is missing for ${item.sku} (${item.description}).`;
      fix = 'Provide the HS code for this item. It must be at least 6 digits. Contact your customs broker if unsure.';
    } else if (!isAllDigits) {
      evidence = `HS code "${item.hsCode}" for ${item.sku} contains non-digit characters. Normalised: "${normalised}".`;
      fix = 'Provide a numeric HS code of at least 6 digits.';
    } else if (!isLongEnough) {
      evidence = `HS code "${normalised}" for ${item.sku} has only ${normalised.length} digits (minimum 6 required). Raw value: "${item.hsCode}".`;
      fix = `The HS code needs at least 6 digits. "${normalised}" looks truncated — check if leading zeros were lost in Excel.`;
    } else {
      evidence = `HS code "${normalised}" for ${item.sku} is valid (${normalised.length} digits).`;
      fix = 'No action needed.';
    }

    return {
      ruleId: 'R-01',
      ruleName: 'HS Code',
      severity: 'Red',
      status: pass ? 'pass' : 'fail',
      affectedBookingId: booking.bookingId,
      affectedItem: { sku: item.sku, description: item.description },
      evidence,
      expected: 'At least 6 digits',
      actual: normalised || '(blank)',
      whyItMatters: 'Customs requires a valid HS code to classify the goods. Missing or short codes will hold the shipment at the border.',
      fix,
    };
  });
}

export function checkR02(booking: Booking, items: Item[]): Finding {
  const hasMissing = items.some(i => i.quantity == null || i.unitPrice == null) || booking.totalDeclaredValue == null;
  if (hasMissing) {
    return {
      ruleId: 'R-02',
      ruleName: 'Declared Value',
      severity: 'Red',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — missing quantity, unit price, or declared value.',
      whyItMatters: 'The declared value must match the sum of item values to avoid customs queries.',
      fix: 'Provide the missing values.',
    };
  }

  const expected = items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.quantity!).times(new Decimal(item.unitPrice!)));
  }, new Decimal(0));

  const declared = new Decimal(booking.totalDeclaredValue!);

  if (expected.isZero()) {
    const pass = declared.isZero();
    return {
      ruleId: 'R-02',
      ruleName: 'Declared Value',
      severity: 'Red',
      status: pass ? 'pass' : 'fail',
      affectedBookingId: booking.bookingId,
      evidence: pass
        ? 'Expected value is £0 and declared value is £0.'
        : `Expected value is £0 but declared value is £${declared.toFixed(2)}.`,
      expected: '£0.00',
      actual: `£${declared.toFixed(2)}`,
      whyItMatters: 'The declared value must match the sum of item values to avoid customs queries.',
      fix: pass ? 'No action needed.' : 'Set declared value to £0.00 to match the calculated total.',
    };
  }

  const diff = declared.minus(expected).abs();
  const pctDiff = diff.div(expected);
  const pass = pctDiff.lte(new Decimal('0.01'));

  return {
    ruleId: 'R-02',
    ruleName: 'Declared Value',
    severity: 'Red',
    status: pass ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: pass
      ? `Declared value £${declared.toFixed(2)} is within 1% of calculated value £${expected.toFixed(2)} (${pctDiff.times(100).toFixed(2)}% difference).`
      : `Declared value £${declared.toFixed(2)} vs calculated £${expected.toFixed(2)}. Difference: £${diff.toFixed(2)} (${pctDiff.times(100).toFixed(2)}%).`,
    expected: `£${expected.toFixed(2)}`,
    actual: `£${declared.toFixed(2)}`,
    whyItMatters: 'A mismatch between declared and calculated value will trigger a customs inspection and delay clearance.',
    fix: pass ? 'No action needed.' : `Update declared value to £${expected.toFixed(2)} to match the sum of item values.`,
  };
}

export function checkR03(booking: Booking, items: Item[]): Finding[] {
  return items.map((item): Finding => {
    if (item.unitsPerCarton == null || item.cartons == null || item.quantity == null) {
      return {
        ruleId: 'R-03',
        ruleName: 'Units vs Cartons',
        severity: 'Red',
        status: 'not_checked',
        affectedBookingId: booking.bookingId,
        affectedItem: { sku: item.sku, description: item.description },
        evidence: `Cannot check — missing units per carton, cartons, or quantity for ${item.sku}.`,
        whyItMatters: 'The carton count must match the unit count to avoid discrepancies at the warehouse.',
        fix: 'Provide the missing values.',
      };
    }

    const computed = new Decimal(item.unitsPerCarton).times(new Decimal(item.cartons));
    const quantity = new Decimal(item.quantity);
    const pass = computed.eq(quantity);

    return {
      ruleId: 'R-03',
      ruleName: 'Units vs Cartons',
      severity: 'Red',
      status: pass ? 'pass' : 'fail',
      affectedBookingId: booking.bookingId,
      affectedItem: { sku: item.sku, description: item.description },
      evidence: pass
        ? `${item.sku}: ${item.unitsPerCarton} units/carton × ${item.cartons} cartons = ${computed.toNumber()} units. Matches stated quantity of ${item.quantity}.`
        : `${item.sku}: ${item.unitsPerCarton} units/carton × ${item.cartons} cartons = ${computed.toNumber()}, but stated quantity is ${item.quantity}.`,
      expected: `${quantity.toNumber()} units`,
      actual: `${computed.toNumber()} units (${item.unitsPerCarton} × ${item.cartons})`,
      whyItMatters: 'If the units don\'t match the carton calculation, the warehouse will receive the wrong count.',
      fix: pass
        ? 'No action needed.'
        : `Check ${item.sku}: is the quantity ${item.quantity}, the units per carton ${item.unitsPerCarton}, or the cartons ${item.cartons} wrong?`,
    };
  });
}

export function checkR04(booking: Booking, items: Item[]): Finding {
  if (booking.cartons == null) {
    return {
      ruleId: 'R-04',
      ruleName: 'Booking Cartons',
      severity: 'Red',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — booking carton count is missing.',
      whyItMatters: 'The booking carton total must match the sum of item cartons so the carrier loads the right number.',
      fix: 'Provide the total cartons on the booking.',
    };
  }

  const hasMissing = items.some(i => i.cartons == null);
  if (hasMissing) {
    return {
      ruleId: 'R-04',
      ruleName: 'Booking Cartons',
      severity: 'Red',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — some items are missing carton counts.',
      whyItMatters: 'The booking carton total must match the sum of item cartons so the carrier loads the right number.',
      fix: 'Provide carton counts for all items.',
    };
  }

  const sumItemCartons = items.reduce((s, i) => s + (i.cartons ?? 0), 0);
  const pass = booking.cartons === sumItemCartons;

  return {
    ruleId: 'R-04',
    ruleName: 'Booking Cartons',
    severity: 'Red',
    status: pass ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: pass
      ? `Booking cartons (${booking.cartons}) matches sum of item cartons (${sumItemCartons}).`
      : `Booking states ${booking.cartons} cartons, but item cartons sum to ${sumItemCartons}. Gap: ${Math.abs(booking.cartons - sumItemCartons)}.`,
    expected: `${sumItemCartons} cartons`,
    actual: `${booking.cartons} cartons`,
    whyItMatters: 'A carton count mismatch means the carrier may load the wrong number of boxes.',
    fix: pass ? 'No action needed.' : `Update booking cartons to ${sumItemCartons} to match the item totals.`,
  };
}

export function checkR05(booking: Booking, _items: Item[], maxKgPerPallet?: number, serviceName?: string): Finding {
  if (booking.pallets == null || booking.pallets <= 0 || booking.totalGrossWeight == null) {
    return {
      ruleId: 'R-05',
      ruleName: 'Carrier Weight Capacity',
      severity: 'Red',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: booking.pallets != null && booking.pallets <= 0
        ? `Pallets is ${booking.pallets} — cannot compute weight per pallet.`
        : 'Cannot check — pallets or gross weight is missing.',
      whyItMatters: 'The carrier has a maximum weight per pallet. Overloaded pallets will be rejected at collection.',
      fix: 'Provide the number of pallets and total gross weight.',
    };
  }

  const wpp = new Decimal(booking.totalGrossWeight).div(new Decimal(booking.pallets));
  const wppNum = wpp.toDecimalPlaces(2).toNumber();

  if (maxKgPerPallet == null) {
    return {
      ruleId: 'R-05',
      ruleName: 'Carrier Weight Capacity',
      severity: 'Red',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: `Weight per pallet is ${wppNum} kg but no carrier service selected to check against.`,
      whyItMatters: 'The carrier has a maximum weight per pallet. Overloaded pallets will be rejected at collection.',
      fix: 'Select or recommend a carrier service to check weight capacity.',
    };
  }

  const pass = wpp.lte(new Decimal(maxKgPerPallet));

  return {
    ruleId: 'R-05',
    ruleName: 'Carrier Weight Capacity',
    severity: 'Red',
    status: pass ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: pass
      ? `Weight per pallet: ${wppNum} kg ≤ ${maxKgPerPallet} kg limit${serviceName ? ` (${serviceName})` : ''}.`
      : `Weight per pallet: ${wppNum} kg exceeds ${maxKgPerPallet} kg limit${serviceName ? ` (${serviceName})` : ''}.`,
    expected: `≤ ${maxKgPerPallet} kg/pallet`,
    actual: `${wppNum} kg/pallet`,
    whyItMatters: 'Overloaded pallets will be rejected by the carrier at collection, delaying the shipment.',
    fix: pass
      ? 'No action needed.'
      : `Reduce weight per pallet below ${maxKgPerPallet} kg. Options: add more pallets or reduce gross weight.`,
  };
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Look for a prohibited term in free text. Known-safe phrases ("battery-free",
 * "non-flammable") are removed first, so they only cancel themselves and can no
 * longer hide a real problem elsewhere in the description. Plurals match too.
 */
function matchesProhibited(text: string, terms: string[]): string | null {
  let cleaned = text.toLowerCase();
  for (const safe of SAFE_TERMS) {
    cleaned = cleaned.split(safe.toLowerCase()).join(' ');
  }
  for (const term of terms) {
    const regex = new RegExp(`(?<![a-z0-9])${escapeRegex(term)}(?:s|es)?(?![a-z0-9])`, 'i');
    if (regex.test(cleaned)) return term;
  }
  return null;
}

export function checkR06(booking: Booking, items: Item[]): Finding[] {
  return items.map((item): Finding => {
    const searchText = `${item.sku} ${item.description}`;

    const tier1Match = matchesProhibited(searchText, PROHIBITED_TERMS_TIER1);
    if (tier1Match) {
      return {
        ruleId: 'R-06',
        ruleName: 'Prohibited Goods',
        severity: 'Red',
        status: 'fail',
        affectedBookingId: booking.bookingId,
        affectedItem: { sku: item.sku, description: item.description },
        evidence: `"${tier1Match}" found in "${item.description}" (${item.sku}). This is a prohibited item.`,
        whyItMatters: 'Lithium batteries, aerosols, and flammable liquids are prohibited on these services and will be rejected.',
        fix: `Remove ${item.sku} (${item.description}) from this shipment. It cannot be sent via these carrier services.`,
      };
    }

    const tier2Match = matchesProhibited(searchText, PROHIBITED_TERMS_TIER2);
    if (tier2Match) {
      return {
        ruleId: 'R-06',
        ruleName: 'Prohibited Goods',
        severity: 'Red',
        status: 'needs_clarification',
        affectedBookingId: booking.bookingId,
        affectedItem: { sku: item.sku, description: item.description },
        evidence: `"${tier2Match}" found in "${item.description}" (${item.sku}). This term is ambiguous: the item may contain prohibited substances.`,
        whyItMatters: 'Some products with this description may contain flammable or hazardous materials that are prohibited.',
        fix: `Confirm whether ${item.sku} (${item.description}) contains lithium batteries, aerosols, or flammable liquids.`,
      };
    }

    return {
      ruleId: 'R-06',
      ruleName: 'Prohibited Goods',
      severity: 'Red',
      status: 'pass',
      affectedBookingId: booking.bookingId,
      affectedItem: { sku: item.sku, description: item.description },
      evidence: `No prohibited terms found in "${item.description}" (${item.sku}).`,
      whyItMatters: 'Lithium batteries, aerosols, and flammable liquids are prohibited on these services.',
      fix: 'No action needed.',
    };
  });
}

export function checkR07(booking: Booking, items: Item[]): Finding {
  if (booking.totalGrossWeight == null) {
    return {
      ruleId: 'R-07',
      ruleName: 'Gross vs Item Weight',
      severity: 'Amber',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — total gross weight is missing.',
      whyItMatters: 'Gross weight should be at least the sum of item weights, since it includes packaging and pallets.',
      fix: 'Provide the total gross weight.',
    };
  }

  const hasMissing = items.some(i => i.quantity == null || i.unitWeight == null);
  if (hasMissing) {
    return {
      ruleId: 'R-07',
      ruleName: 'Gross vs Item Weight',
      severity: 'Amber',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — some items are missing quantity or unit weight.',
      whyItMatters: 'Gross weight should be at least the sum of item weights, since it includes packaging and pallets.',
      fix: 'Provide quantity and unit weight for all items.',
    };
  }

  const itemWeight = items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.quantity!).times(new Decimal(item.unitWeight!)));
  }, new Decimal(0));

  const gross = new Decimal(booking.totalGrossWeight);
  const pass = gross.gte(itemWeight);

  return {
    ruleId: 'R-07',
    ruleName: 'Gross vs Item Weight',
    severity: 'Amber',
    status: pass ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: pass
      ? `Total gross weight (${gross.toNumber()} kg) ≥ sum of item weights (${itemWeight.toNumber()} kg). Difference of ${gross.minus(itemWeight).toNumber()} kg covers packaging and pallets.`
      : `Total gross weight (${gross.toNumber()} kg) is less than sum of item weights (${itemWeight.toNumber()} kg). Shortfall: ${itemWeight.minus(gross).toNumber()} kg.`,
    expected: `≥ ${itemWeight.toNumber()} kg`,
    actual: `${gross.toNumber()} kg`,
    whyItMatters: 'Gross weight includes packaging and pallets, so it should always be at least the sum of item weights. A lower number suggests a data entry error.',
    fix: pass
      ? 'No action needed.'
      : `Gross weight should be at least ${itemWeight.toNumber()} kg. Check if a weight was entered incorrectly.`,
  };
}

export function checkR08(booking: Booking): Finding {
  if (booking.destinationType?.toLowerCase() !== 'warehouse') {
    return {
      ruleId: 'R-08',
      ruleName: 'Warehouse Appointment',
      severity: 'Amber',
      status: 'pass',
      affectedBookingId: booking.bookingId,
      evidence: `Destination type is "${booking.destinationType}" — appointment check only applies to warehouses.`,
      whyItMatters: 'Warehouses require a booked delivery slot to unload. Business addresses typically do not.',
      fix: 'No action needed.',
    };
  }

  const booked = /^(yes|y|true|booked|confirmed)$/i.test((booking.deliveryAppointmentBooked ?? '').trim());

  return {
    ruleId: 'R-08',
    ruleName: 'Warehouse Appointment',
    severity: 'Amber',
    status: booked ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: booked
      ? 'Delivery appointment is booked for this warehouse destination.'
      : 'No delivery appointment booked, but destination is a warehouse.',
    expected: 'Yes',
    actual: booking.deliveryAppointmentBooked || '(blank)',
    whyItMatters: 'Warehouses require a booked delivery slot. Arriving without one means the truck waits or is turned away.',
    fix: booked ? 'No action needed.' : 'Book a delivery appointment at the receiving warehouse before shipping.',
  };
}

export function checkR09(booking: Booking, items: Item[]): Finding[] {
  return items.map((item): Finding => {
    const hasOrigin = item.countryOfOrigin != null && item.countryOfOrigin.trim() !== '';

    return {
      ruleId: 'R-09',
      ruleName: 'Country of Origin',
      severity: 'Amber',
      status: hasOrigin ? 'pass' : 'fail',
      affectedBookingId: booking.bookingId,
      affectedItem: { sku: item.sku, description: item.description },
      evidence: hasOrigin
        ? `Country of origin for ${item.sku}: ${item.countryOfOrigin}.`
        : `Country of origin is missing for ${item.sku} (${item.description}).`,
      expected: 'A country of origin',
      actual: item.countryOfOrigin || '(blank)',
      whyItMatters: 'Country of origin means where the goods were manufactured, not where they ship from. Customs requires it on the commercial invoice.',
      fix: hasOrigin
        ? 'No action needed.'
        : `Provide the country of origin for ${item.sku}. This is where the product was made, not where it ships from.`,
    };
  });
}

export function checkR10(booking: Booking): Finding {
  if (!booking.readyToShipDate || booking.readyToShipDate.trim() === '') {
    return {
      ruleId: 'R-10',
      ruleName: 'Ready-to-Ship Date',
      severity: 'Amber',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: 'Cannot check — ready-to-ship date is missing.',
      whyItMatters: 'A past shipping date means the goods should already have left, which usually indicates a booking error.',
      fix: 'Provide the ready-to-ship date in DD-MM-YYYY format.',
    };
  }

  const parts = booking.readyToShipDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!parts) {
    return {
      ruleId: 'R-10',
      ruleName: 'Ready-to-Ship Date',
      severity: 'Amber',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: `Cannot parse date "${booking.readyToShipDate}". Expected DD-MM-YYYY format.`,
      whyItMatters: 'A past shipping date means the goods should already have left, which usually indicates a booking error.',
      fix: `Provide the date in DD-MM-YYYY format (e.g. 15-11-2026).`,
    };
  }

  const day = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10);
  const year = parseInt(parts[3], 10);
  const shipDate = new Date(year, month - 1, day);

  if (isNaN(shipDate.getTime()) || shipDate.getDate() !== day || shipDate.getMonth() !== month - 1) {
    return {
      ruleId: 'R-10',
      ruleName: 'Ready-to-Ship Date',
      severity: 'Amber',
      status: 'not_checked',
      affectedBookingId: booking.bookingId,
      evidence: `"${booking.readyToShipDate}" is not a valid date.`,
      whyItMatters: 'A past shipping date means the goods should already have left, which usually indicates a booking error.',
      fix: 'Correct the date to a valid DD-MM-YYYY value.',
    };
  }

  const todayLondon = todayInLondon();

  const pass = shipDate >= todayLondon;

  return {
    ruleId: 'R-10',
    ruleName: 'Ready-to-Ship Date',
    severity: 'Amber',
    status: pass ? 'pass' : 'fail',
    affectedBookingId: booking.bookingId,
    evidence: pass
      ? `Ready-to-ship date ${booking.readyToShipDate} is today or in the future.`
      : `Ready-to-ship date ${booking.readyToShipDate} is in the past (today is ${String(todayLondon.getDate()).padStart(2, '0')}-${String(todayLondon.getMonth() + 1).padStart(2, '0')}-${todayLondon.getFullYear()}).`,
    expected: 'Today or later',
    actual: booking.readyToShipDate,
    whyItMatters: 'A past shipping date means the goods should already have left, which usually indicates a booking error.',
    fix: pass
      ? 'No action needed.'
      : `Update the ready-to-ship date to today or a future date.`,
  };
}

export function evaluateAllRules(
  booking: Booking,
  items: Item[],
  recommendedMaxKg?: number,
  recommendedServiceName?: string
): Finding[] {
  const findings: Finding[] = [];

  findings.push(...checkR01(booking, items));
  findings.push(checkR02(booking, items));
  findings.push(...checkR03(booking, items));
  findings.push(checkR04(booking, items));
  findings.push(checkR05(booking, items, recommendedMaxKg, recommendedServiceName));
  findings.push(...checkR06(booking, items));
  findings.push(checkR07(booking, items));
  findings.push(checkR08(booking));
  findings.push(...checkR09(booking, items));
  findings.push(checkR10(booking));

  return findings;
}

export const findingKey = (f: Pick<Finding, 'ruleId' | 'affectedItem'>) => `${f.ruleId}|${f.affectedItem?.sku ?? ''}`;

export function computeBookingStatus(findings: Finding[]): BookingStatus {
  const hasRedFail = findings.some(f => f.severity === 'Red' && f.status === 'fail');
  if (hasRedFail) return 'blocked';

  // A person can confirm an ambiguous item or an Amber warning is fine; a Red
  // failure can never be waved through.
  const open = findings.filter(f => !f.acknowledged);
  const hasIssue = open.some(f =>
    f.status === 'fail' || f.status === 'not_checked' || f.status === 'needs_clarification'
  );
  if (hasIssue) return 'review';

  return findings.every(f => f.status === 'pass' || f.acknowledged) ? 'clear' : 'review';
}
