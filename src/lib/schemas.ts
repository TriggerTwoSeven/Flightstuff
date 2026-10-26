import { z } from 'zod';

export const BookingSchema = z.object({
  bookingId: z.string(),
  sellerName: z.string(),
  originCity: z.string(),
  originCountry: z.string(),
  destinationCity: z.string(),
  destinationCountry: z.string(),
  destinationType: z.string(),
  readyToShipDate: z.string(),
  sellerPriority: z.string(),
  pallets: z.number().nullable(),
  cartons: z.number().nullable(),
  totalDeclaredValue: z.number().nullable(),
  currency: z.string(),
  totalGrossWeight: z.number().nullable(),
  deliveryAppointmentBooked: z.string(),
});

export const ItemSchema = z.object({
  bookingId: z.string(),
  sku: z.string(),
  description: z.string(),
  hsCode: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  unitsPerCarton: z.number().nullable(),
  cartons: z.number().nullable(),
  unitWeight: z.number().nullable(),
  countryOfOrigin: z.string().nullable(),
});

export type Booking = z.infer<typeof BookingSchema>;
export type Item = z.infer<typeof ItemSchema>;

export type RuleSeverity = 'Red' | 'Amber';
export type FindingStatus = 'pass' | 'fail' | 'not_checked' | 'needs_clarification';

export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  status: FindingStatus;
  affectedBookingId: string;
  affectedItem?: { sku: string; description: string };
  evidence: string;
  expected?: string;
  actual?: string;
  whyItMatters: string;
  fix: string;
  acknowledged?: boolean;
}

export interface CarrierCandidate {
  carrier: string;
  service: string;
  destinationCountry: string;
  pricePerPallet: number;
  totalCost: number;
  costPerPallet: number;
  transitDays: number;
  onTimePercent: number;
  maxKgPerPallet: number;
  actualKgPerPallet: number;
  eligible: boolean;
  ineligibleReason?: string;
  score?: number;
}

export interface Recommendation {
  recommended: CarrierCandidate | null;
  allCandidates: CarrierCandidate[];
  bestAlternative: CarrierCandidate | null;
  explanation: string;
  alternativeTradeoff?: string;
  priority: string;
  noEligibleReason?: string;
}

export type BookingStatus = 'blocked' | 'review' | 'clear';

export interface BookingReport {
  booking: Booking;
  items: Item[];
  findings: Finding[];
  status: BookingStatus;
  recommendation: Recommendation | null;
  dataIssues: DataIssue[];
  /** Findings the shipper has confirmed as fine, as "R-06|SKU". Cleared by any edit that changes the facts. */
  acknowledged?: string[];
}

export interface DataIssue {
  type: string;
  message: string;
  sheet?: string;
  row?: number;
  field?: string;
  value?: string;
  bookingId?: string;
}

export type FieldProvenance = 'stated' | 'calculated' | 'auto-generated' | 'confirmed';

export interface ProvenanceField<T> {
  value: T;
  provenance: FieldProvenance;
}

export const LLMExtractionSchema = z.object({
  extracted: z.object({
    sellerName: z.string().optional(),
    originCity: z.string().optional(),
    originCountry: z.string().optional(),
    destinationCity: z.string().optional(),
    destinationCountry: z.string().optional(),
    destinationType: z.string().optional(),
    readyToShipDate: z.string().optional(),
    sellerPriority: z.string().optional(),
    pallets: z.number().optional(),
    cartons: z.number().optional(),
    totalDeclaredValue: z.number().optional(),
    totalGrossWeight: z.number().optional(),
    deliveryAppointmentBooked: z.string().optional(),
    items: z.array(z.object({
      sku: z.string().optional(),
      description: z.string().optional(),
      hsCode: z.string().optional(),
      quantity: z.number().optional(),
      unitPrice: z.number().optional(),
      unitsPerCarton: z.number().optional(),
      cartons: z.number().optional(),
      unitWeight: z.number().optional(),
      countryOfOrigin: z.string().optional(),
    })).optional(),
  }),
  updates: z.record(z.unknown()).optional(),
  missing: z.array(z.string()).optional(),
  ambiguities: z.array(z.string()).optional(),
  unsupported: z.array(z.string()).optional(),
});

export type LLMExtraction = z.infer<typeof LLMExtractionSchema>;
