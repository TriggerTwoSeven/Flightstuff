import type { RuleSeverity } from './schemas';

export interface RuleMeta {
  id: string;
  name: string;
  severity: RuleSeverity;
  group: 'Customs paperwork' | 'Load and carrier' | 'Delivery';
  /** What is compared, in one plain sentence. */
  check: string;
  /** The exact threshold the engine uses. */
  threshold: string;
  why: string;
}

/** The rulebook shown in the app. Keep it in step with rules-engine.ts. */
export const RULES: RuleMeta[] = [
  {
    id: 'R-01', name: 'HS code', severity: 'Red', group: 'Customs paperwork',
    check: 'Every product line has an HS code made only of digits.',
    threshold: 'At least 6 digits. Dots and spaces are ignored, so 6912.00 counts as 691200.',
    why: 'Customs cannot classify goods without it, and the shipment is held at the border.',
  },
  {
    id: 'R-02', name: 'Declared value', severity: 'Red', group: 'Customs paperwork',
    check: 'The booking total matches quantity times unit price, added up across every product.',
    threshold: 'Within 1% of the calculated value.',
    why: 'A mismatch triggers a customs inspection and delays clearance.',
  },
  {
    id: 'R-03', name: 'Units vs cartons', severity: 'Red', group: 'Load and carrier',
    check: 'For each product, units per carton times cartons equals the quantity.',
    threshold: 'Exact match.',
    why: 'The warehouse will receive the wrong count if the numbers disagree.',
  },
  {
    id: 'R-04', name: 'Booking cartons', severity: 'Red', group: 'Load and carrier',
    check: 'The cartons on the booking equal the cartons added up across the products.',
    threshold: 'Exact match.',
    why: 'The carrier loads the number of boxes on the booking, not the number you meant.',
  },
  {
    id: 'R-05', name: 'Carrier weight limit', severity: 'Red', group: 'Load and carrier',
    check: 'Gross weight divided by pallets stays under the carrier\'s limit per pallet.',
    threshold: 'TransAsia 500 kg, CargoLink 750 kg, SwiftAir 400 kg. If no carrier on the route can take it, the strongest one is used.',
    why: 'Overloaded pallets are refused at collection.',
  },
  {
    id: 'R-06', name: 'Prohibited goods', severity: 'Red', group: 'Load and carrier',
    check: 'Product names and SKUs are screened for lithium batteries, aerosols and flammables.',
    threshold: 'A clear match blocks the booking. Ambiguous words such as perfume or paint ask a question instead.',
    why: 'These goods cannot travel on these services and are rejected.',
  },
  {
    id: 'R-07', name: 'Gross vs item weight', severity: 'Amber', group: 'Load and carrier',
    check: 'Total gross weight is at least the sum of quantity times unit weight.',
    threshold: 'Gross weight greater than or equal to the item total.',
    why: 'Gross includes packaging and pallets, so a lower figure points to a typing error.',
  },
  {
    id: 'R-08', name: 'Warehouse appointment', severity: 'Amber', group: 'Delivery',
    check: 'A delivery appointment is booked when the destination is a warehouse.',
    threshold: 'Applies to warehouses only.',
    why: 'Trucks without a slot wait in the yard or are turned away.',
  },
  {
    id: 'R-09', name: 'Country of origin', severity: 'Amber', group: 'Customs paperwork',
    check: 'Every product says where it was made.',
    threshold: 'Not blank. This is where it was manufactured, not where it ships from.',
    why: 'It is required on the commercial invoice.',
  },
  {
    id: 'R-10', name: 'Ready-to-ship date', severity: 'Amber', group: 'Delivery',
    check: 'The date is today or later, in UK time.',
    threshold: 'DD-MM-YYYY, a real calendar date, not in the past.',
    why: 'A past date usually means the booking was entered wrongly.',
  },
];

export const RULE_BY_ID: Record<string, RuleMeta> = Object.fromEntries(RULES.map(r => [r.id, r]));
