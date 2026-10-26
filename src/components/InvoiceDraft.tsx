'use client';

import { useRef } from 'react';
import Decimal from 'decimal.js';
import type { Booking, Item } from '@/lib/schemas';
import { formatCurrency } from '@/lib/utils';
import { Print } from './ui/Icons';

const PH = '[To be supplied]';

export function InvoiceDraft({ booking, items }: { booking: Booking; items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const total = items.reduce((s, i) => s.plus(new Decimal(i.quantity ?? 0).times(i.unitPrice ?? 0)), new Decimal(0));
  const cartons = items.reduce((s, i) => s + (i.cartons ?? 0), 0);
  const missing: string[] = [];
  if (!booking.sellerName) missing.push('Exporter name');
  missing.push('Exporter address', 'Consignee name and address', 'Invoice number', 'Invoice date', 'EORI number', 'Payment terms', 'Incoterms');
  if (items.some(i => !i.hsCode)) missing.push('HS code on every line');
  if (items.some(i => !i.countryOfOrigin)) missing.push('Country of origin on every line');

  const print = () => {
    const node = ref.current;
    if (!node) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Commercial invoice draft ${booking.bookingId}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;color:#111}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #ccc;padding:7px 9px;text-align:left;font-size:13px}th{background:#f3f4f6}h1{font-size:20px;margin:0 0 4px}.ph{color:#a15c00;font-style:italic}.wm{position:fixed;top:45%;left:8%;transform:rotate(-24deg);font-size:54px;color:rgba(200,30,30,.12);font-weight:800;pointer-events:none}</style></head><body><div class="wm">DRAFT. NOT A CUSTOMS DOCUMENT</div>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <div className="panel panel-pad row row-between">
        <div style={{ maxWidth: 560 }}>
          <h3 className="heading">Commercial invoice draft</h3>
          <p className="small muted" style={{ margin: '4px 0 0' }}>Built from this booking. {missing.length} detail{missing.length === 1 ? '' : 's'} still to be supplied before it can be used. This does not change the ten-rule result.</p>
        </div>
        <button type="button" className="btn btn-line" onClick={print}><Print />Print or save PDF</button>
      </div>

      <details className="panel panel-pad">
        <summary className="strong" style={{ cursor: 'pointer' }}>What still needs filling in ({missing.length})</summary>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>{missing.map(m => <li key={m}>{m}</li>)}</ul>
      </details>

      <div ref={ref} className="invoice">
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>Commercial invoice</h1>
        <p style={{ margin: '2px 0 18px', color: '#555' }}>Draft for booking {booking.bookingId}</p>
        <table>
          <tbody>
            <tr><th style={{ width: '22%' }}>Exporter</th><td>{booking.sellerName || <span className="ph">{PH}</span>}<br /><span className="ph">{PH} (address)</span></td><th style={{ width: '22%' }}>Consignee</th><td><span className="ph">{PH}</span><br />{booking.destinationCity}{booking.destinationCity && booking.destinationCountry ? ', ' : ''}{booking.destinationCountry}</td></tr>
            <tr><th>Invoice number</th><td className="ph">{PH}</td><th>Invoice date</th><td className="ph">{PH}</td></tr>
            <tr><th>Ready to ship</th><td>{booking.readyToShipDate || <span className="ph">{PH}</span>}</td><th>Origin</th><td>{booking.originCity ? `${booking.originCity}, ${booking.originCountry}` : <span className="ph">{PH}</span>}</td></tr>
            <tr><th>EORI</th><td className="ph">{PH}</td><th>Incoterms and payment</th><td className="ph">{PH}</td></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th>SKU</th><th>Description</th><th>HS code</th><th>Origin</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit price</th><th style={{ textAlign: 'right' }}>Line total</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.sku}>
                <td>{i.sku}</td><td>{i.description}</td>
                <td>{i.hsCode || <span className="ph">{PH}</span>}</td>
                <td>{i.countryOfOrigin || <span className="ph">{PH}</span>}</td>
                <td style={{ textAlign: 'right' }}>{i.quantity ?? '-'}</td>
                <td style={{ textAlign: 'right' }}>{i.unitPrice != null ? formatCurrency(i.unitPrice) : '-'}</td>
                <td style={{ textAlign: 'right' }}>{i.quantity != null && i.unitPrice != null ? formatCurrency(new Decimal(i.quantity).times(i.unitPrice).toNumber()) : '-'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ color: '#777' }}>No products on this booking yet.</td></tr>}
          </tbody>
          <tfoot>
            <tr><th colSpan={6} style={{ textAlign: 'right' }}>Total (GBP)</th><th style={{ textAlign: 'right' }}>{formatCurrency(total.toNumber())}</th></tr>
          </tfoot>
        </table>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#444' }}>{booking.pallets ?? '-'} pallets, {booking.cartons ?? cartons} cartons, gross weight {booking.totalGrossWeight != null ? `${booking.totalGrossWeight} kg` : '-'}.</p>
      </div>
    </div>
  );
}
