export const ORIGIN_COUNTRY = 'United Kingdom' as const;

export const ORIGIN_CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds'] as const;

export const DESTINATION_COUNTRIES = ['Germany', 'France', 'Netherlands'] as const;

export const DESTINATION_CITIES: Record<string, readonly string[]> = {
  Germany: ['Berlin', 'Frankfurt', 'Hamburg'],
  France: ['Paris', 'Lyon'],
  Netherlands: ['Amsterdam', 'Rotterdam'],
};

export const ALL_DESTINATION_CITIES = Object.values(DESTINATION_CITIES).flat();

export const CURRENCY = 'GBP' as const;

export const ITEM_COUNTRIES_OF_ORIGIN = [
  'United Kingdom',
  'China',
  'India',
  'Vietnam',
  'Turkey',
  'Germany',
] as const;

export const DESTINATION_TYPES = ['Warehouse', 'Business address'] as const;

export const SELLER_PRIORITIES = ['Cheapest', 'Fastest', 'Most reliable', 'Balanced'] as const;

export const DATE_FORMAT = 'DD-MM-YYYY' as const;

export interface CarrierService {
  carrier: string;
  service: string;
  destinationCountry: string;
  pricePerPallet: number;
  transitDays: number;
  onTimePercent: number;
  maxKgPerPallet: number;
}

export const RATE_CARD: CarrierService[] = [
  { carrier: 'TransAsia Road', service: 'Road economy', destinationCountry: 'Germany', pricePerPallet: 180, transitDays: 5, onTimePercent: 87.8, maxKgPerPallet: 500 },
  { carrier: 'CargoLink Prime', service: 'Road standard', destinationCountry: 'Germany', pricePerPallet: 220, transitDays: 3, onTimePercent: 93.1, maxKgPerPallet: 750 },
  { carrier: 'SwiftAir Express', service: 'Road express', destinationCountry: 'Germany', pricePerPallet: 340, transitDays: 2, onTimePercent: 96.5, maxKgPerPallet: 400 },
  { carrier: 'TransAsia Road', service: 'Road economy', destinationCountry: 'France', pricePerPallet: 170, transitDays: 5, onTimePercent: 87.8, maxKgPerPallet: 500 },
  { carrier: 'CargoLink Prime', service: 'Road standard', destinationCountry: 'France', pricePerPallet: 210, transitDays: 3, onTimePercent: 93.1, maxKgPerPallet: 750 },
  { carrier: 'SwiftAir Express', service: 'Road express', destinationCountry: 'France', pricePerPallet: 330, transitDays: 2, onTimePercent: 96.5, maxKgPerPallet: 400 },
  { carrier: 'TransAsia Road', service: 'Road economy', destinationCountry: 'Netherlands', pricePerPallet: 160, transitDays: 5, onTimePercent: 87.8, maxKgPerPallet: 500 },
  { carrier: 'CargoLink Prime', service: 'Road standard', destinationCountry: 'Netherlands', pricePerPallet: 200, transitDays: 3, onTimePercent: 93.1, maxKgPerPallet: 750 },
  { carrier: 'SwiftAir Express', service: 'Road express', destinationCountry: 'Netherlands', pricePerPallet: 320, transitDays: 2, onTimePercent: 96.5, maxKgPerPallet: 400 },
];

export const PROHIBITED_TERMS_TIER1 = [
  'lithium', 'li-ion', 'lithium-ion', 'lipo', 'lithium battery', 'power bank',
  'aerosol', 'spray can', 'aerosol spray',
  'flammable', 'flammable liquid', 'lighter fluid', 'petrol', 'gasoline',
  'paraffin', 'white spirit', 'butane', 'acetone', 'nail-polish remover', 'nail polish remover',
];

export const PROHIBITED_TERMS_TIER2 = [
  'perfume', 'cologne', 'alcohol-based', 'paint', 'solvent', 'varnish',
  'fragrance oil', 'rechargeable', 'battery-powered', 'spray bottle',
];

export const SAFE_TERMS = [
  'battery-free', 'liquid soap', 'non-flammable', 'gasket', 'glass',
  'spray-painted', 'spray painted',
];

export const BALANCED_WEIGHTS = {
  cost: 0.40,
  transit: 0.30,
  reliability: 0.30,
} as const;

export type OriginCity = (typeof ORIGIN_CITIES)[number];
export type DestinationCountry = (typeof DESTINATION_COUNTRIES)[number];
export type ItemCountryOfOrigin = (typeof ITEM_COUNTRIES_OF_ORIGIN)[number];
export type DestinationType = (typeof DESTINATION_TYPES)[number];
export type SellerPriority = (typeof SELLER_PRIORITIES)[number];
