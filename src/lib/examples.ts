export interface Example {
  id: string;
  title: string;
  blurb: string;
  text: string;
}

/** One-tap practice shipments. Each is written the way a person would type it. */
export const EXAMPLES: Example[] = [
  {
    id: 'clean',
    title: 'A clean booking',
    blurb: '1,080 mugs, Manchester to Frankfurt. Everything adds up.',
    text: 'I run Northfield Goods. Need to send ceramic mugs from Manchester to a warehouse in Frankfurt. Three pallets ready 05-11-2026. Each mug is £5 and we have 1,080 units, 12 per carton. Each mug weighs 0.5 kg. Total gross weight is 620 kg. HS code 691200. Made in the UK. Priority is cheapest. Appointment is booked.',
  },
  {
    id: 'heavy',
    title: 'Pallet too heavy',
    blurb: '800 kg on one pallet is over every carrier\'s limit.',
    text: 'I run Ironside Metals. Sending 200 cast iron plates from London to a business address in Frankfurt. 1 pallet, ready tomorrow, cheapest. £20 each, 10 per carton, 3.5 kg each, 800 kg in total. HS code 732399. Made in India.',
  },
  {
    id: 'dangerous',
    title: 'Dangerous goods',
    blurb: 'Lithium power banks cannot travel on these services.',
    text: 'I\'m from TechGear Direct. Sending 400 lithium-ion power banks from Birmingham to a business address in Lyon next Monday. £15 each, 10 per carton, 0.25 kg each, 2 pallets, 300 kg in total. HS code 850760, made in China. Fastest please.',
  },
  {
    id: 'paperwork',
    title: 'Missing paperwork',
    blurb: 'No HS code or origin. See how the desk asks for them.',
    text: 'We are Highland Textiles. 1,200 wool winter scarves from Birmingham to a warehouse in Paris, 4 pallets, 850 kg in total, ready 20-11-2026, most reliable. £6 each, 10 per carton, 0.15 kg each. No appointment booked.',
  },
];
