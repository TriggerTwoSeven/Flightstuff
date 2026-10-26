import { describe, expect, it } from 'vitest';
import { interpretText, getMissing, coerceInterpretation } from '../interpreter';
import { newConversation, runTurn, interpretAnswer } from '../conversation';

const now = new Date('2026-10-26T10:00:00Z');
const SAMPLE = `I run Northfield Goods. Need to send ceramic mugs from Manchester to a warehouse in Frankfurt. Three pallets ready 05-11-2026. Each mug is £5 and we have 1,080 units, 12 per carton. Each mug weighs 0.5 kg. Total gross weight is 620 kg. HS code 691200. Made in the UK. Priority is cheapest. Appointment is booked.`;

describe('reading a description', () => {
  it('understands the sample sentence completely', () => {
    const r = interpretText(SAMPLE, undefined, now);
    expect(r.booking).toMatchObject({
      sellerName: 'Northfield Goods', originCity: 'Manchester', destinationCity: 'Frankfurt', destinationCountry: 'Germany',
      destinationType: 'Warehouse', readyToShipDate: '05-11-2026', pallets: 3, totalGrossWeight: 620,
      sellerPriority: 'Cheapest', deliveryAppointmentBooked: 'Yes',
    });
    expect(r.items[0]).toMatchObject({ description: 'ceramic mugs', quantity: 1080 });
    expect(r.itemPatch).toMatchObject({ unitPrice: 5, unitsPerCarton: 12, unitWeight: 0.5, hsCode: '691200', countryOfOrigin: 'United Kingdom' });
  });
  it('never turns a comma into zero pallets', () => {
    const r = interpretText('3 pallets, 2,400 kg, 12 per carton, 0.5kg each, HS code 6912.00', undefined, now);
    expect(r.booking.pallets).toBe(3);
    expect(r.booking.totalGrossWeight).toBe(2400);
    expect(r.itemPatch.hsCode).toBe('691200');
  });
  it('does not mistake dates, pallets or places for products', () => {
    const r = interpretText('Ship to Paris on 5th November 2026, 2 pallets, a business address', undefined, now);
    expect(r.items).toEqual([]);
    expect(r.booking.destinationCity).toBe('Paris');
  });
  it('handles several products and relative changes', () => {
    const r = interpretText('Send 200 lithium power banks and 500 glass vases to Paris', undefined, now);
    expect(r.items.map(i => i.description)).toEqual(['lithium power banks', 'glass vases']);
    expect(interpretText('add a pallet', undefined, now).palletsDelta).toBe(1);
    expect(interpretText('make it fastest', undefined, now).booking.sellerPriority).toBe('Fastest');
  });
  it('says so when the destination is not covered', () => {
    expect(interpretText('send to Madrid', undefined, now).unsupported[0]).toMatch(/Madrid/);
  });
});

describe('a whole conversation', () => {
  it('reaches a full booking from the sample and keeps what it learned on follow-ups', () => {
    let turn = runTurn(newConversation(), SAMPLE, null, null, now);
    expect(turn.missing.filter(m => m.required)).toHaveLength(0);
    expect(turn.report.booking.totalDeclaredValue).toBe(5400);
    expect(turn.report.booking.cartons).toBe(90);
    expect(turn.report.status).toBe('clear');

    turn = runTurn(turn.state, 'make it fastest', null, null, now);
    expect(turn.report.booking.sellerPriority).toBe('Fastest');
    expect(turn.report.items).toHaveLength(1);
    expect(turn.report.recommendation?.recommended?.carrier).toBe('SwiftAir Express');

    turn = runTurn(turn.state, 'add 2 pallets', null, null, now);
    expect(turn.report.booking.pallets).toBe(5);
  });
  it('recalculates what it worked out when the facts change', () => {
    let turn = runTurn(newConversation(), SAMPLE, null, null, now);
    turn = runTurn(turn.state, 'actually it is 2,000 units', null, null, now);
    expect(turn.report.items[0].quantity).toBe(2000);
    expect(turn.report.booking.totalDeclaredValue).toBe(10000);
  });
  it('flags an overweight booking as blocked', () => {
    const turn = runTurn(newConversation(), SAMPLE.replace('620 kg', '2,400 kg'), null, null, now);
    expect(turn.report.status).toBe('blocked');
  });
  it('reads one-word answers as the question that was asked', () => {
    const m = getMissing({ destinationType: 'Warehouse' }, []).find(x => x.key === 'deliveryAppointmentBooked')!;
    expect(interpretAnswer('Yes', m, now)?.booking.deliveryAppointmentBooked).toBe('Yes');
    const p = getMissing({}, []).find(x => x.key === 'pallets')!;
    expect(interpretAnswer('4', p, now)?.booking.pallets).toBe(4);
  });
});

describe('model output is cleaned before it reaches the rules', () => {
  it('normalises case, dates and made-up values', () => {
    const r = coerceInterpretation({
      booking: { sellerPriority: 'most_reliable', destinationType: 'warehouse', readyToShipDate: 'tomorrow', destinationCity: 'frankfurt', pallets: '3', originCity: 'Atlantis' },
      items: [{ description: 'mugs', hsCode: '6912.00', perCarton: 12, countryOfOrigin: 'UK' }],
    }, now);
    expect(r.booking).toMatchObject({ sellerPriority: 'Most reliable', destinationType: 'Warehouse', readyToShipDate: '27-10-2026', destinationCity: 'Frankfurt', destinationCountry: 'Germany', pallets: 3 });
    expect(r.booking.originCity).toBeUndefined();
    expect(r.items[0]).toMatchObject({ hsCode: '691200', unitsPerCarton: 12, countryOfOrigin: 'United Kingdom' });
  });
});
