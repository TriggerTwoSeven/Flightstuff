'use client';

import { useRef, useState } from 'react';
import type { Booking, Item } from '@/lib/schemas';
import { formatCurrency } from '@/lib/utils';
import Decimal from 'decimal.js';

interface Props {
  booking: Booking;
  items: Item[];
}

const PLACEHOLDER = '[To be supplied]';

export function InvoiceDraft({ booking, items }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [showMissing, setShowMissing] = useState(true);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html><head><title>Commercial Invoice Draft - ${booking.bookingId}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 60px; color: rgba(220, 38, 38, 0.1); font-weight: bold; pointer-events: none; z-index: 100; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .header-row { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .section { margin-bottom: 20px; }
        .totals { text-align: right; }
        .placeholder { color: #d97706; font-style: italic; }
        @media print { .no-print { display: none; } }
      </style>
      </head><body>
      <div class="watermark">DRAFT — not a customs document</div>
      ${content.innerHTML}
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  };

  const totalCartons = items.reduce((s, i) => s + (i.cartons ?? 0), 0);
  const totalValue = items.reduce((s, i) =>
    s.plus(new Decimal(i.quantity ?? 0).times(new Decimal(i.unitPrice ?? 0))), new Decimal(0));

  const missingFields: string[] = [];
  if (!booking.sellerName) missingFields.push('Exporter name/address');
  missingFields.push('Consignee name/address');
  missingFields.push('Invoice number');
  missingFields.push('Invoice date');
  missingFields.push('EORI number');
  missingFields.push('Payment terms');
  missingFields.push('Incoterms');
  if (items.some(i => !i.hsCode)) missingFields.push('HS codes for some items');
  if (items.some(i => !i.countryOfOrigin)) missingFields.push('Country of origin for some items');

  const completeness = Math.round(((9 - missingFields.length) / 9) * 100);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Document Readiness</h3>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Commercial invoice field completeness</p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="btn btn-primary flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print / Save PDF
        </button>
      </div>

      {/* Completeness bar */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Field completeness</span>
          <span className="text-sm font-mono font-bold" style={{ color: completeness >= 80 ? 'var(--green)' : 'var(--amber)' }}>{completeness}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${completeness}%`,
              background: completeness >= 80 ? 'var(--green)' : 'var(--amber)',
              animation: 'progress-fill 1s ease-out',
            }}
          />
        </div>
      </div>

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <div className="card mb-4 p-0 overflow-hidden" style={{ border: '1px solid var(--amber-border)' }}>
          <button
            onClick={() => setShowMissing(!showMissing)}
            className="w-full px-5 py-3.5 text-left flex items-center justify-between transition-colors"
            style={{ background: 'var(--amber-light)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--amber-glow)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                </svg>
              </div>
              <div>
                <span className="font-bold text-sm" style={{ color: 'var(--amber)' }}>
                  {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} missing
                </span>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Does not affect the 10-rule pre-flight result</p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2"
              style={{ transform: showMissing ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showMissing && (
            <div className="px-5 py-3 space-y-2 animate-fade-in">
              {missingFields.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ color: 'var(--fg)' }}>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice document */}
      <div
        ref={printRef}
        className="card relative overflow-hidden"
      >
        {/* Draft watermark badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
          </svg>
          DRAFT
        </div>

        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Commercial Invoice</h1>
        <p className="text-xs mb-6" style={{ color: 'var(--fg-muted)' }}>Draft generated from booking {booking.bookingId}</p>

        {/* Exporter / Consignee */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-muted)' }}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>Exporter</h4>
            <p className="font-semibold text-sm" style={{ color: booking.sellerName ? 'var(--fg)' : 'var(--amber)' }}>
              {booking.sellerName || PLACEHOLDER}
            </p>
            <p className="italic text-xs mt-0.5" style={{ color: 'var(--amber)' }}>{PLACEHOLDER} (address)</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-muted)' }}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>Consignee</h4>
            <p className="italic text-sm" style={{ color: 'var(--amber)' }}>{PLACEHOLDER}</p>
          </div>
        </div>

        {/* Document fields grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Invoice No', value: null },
            { label: 'Date', value: null },
            { label: 'EORI', value: null },
            { label: 'Payment terms', value: null },
            { label: 'Incoterms', value: null },
            { label: 'Currency', value: booking.currency },
          ].map((field, i) => (
            <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-muted)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--fg-subtle)' }}>{field.label}</span>
              <span className="text-xs font-medium" style={{ color: field.value ? 'var(--fg)' : 'var(--amber)', fontStyle: field.value ? 'normal' : 'italic' }}>
                {field.value || PLACEHOLDER}
              </span>
            </div>
          ))}
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 mb-5 rounded-lg px-4 py-3" style={{ background: 'var(--bg-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Route:</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
            {booking.originCity}, {booking.originCountry}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
          <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
            {booking.destinationCity}, {booking.destinationCountry}
          </span>
        </div>

        {/* Line items table */}
        <div className="rounded-xl overflow-hidden border mb-5" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['SKU', 'Description', 'HS Code', 'Origin', 'Qty', 'Units/Ctn', 'Cartons', 'Unit Price', 'Line Total'].map((h, i) => (
                  <th key={h} className={`py-2.5 px-2.5 font-bold uppercase tracking-wider ${i >= 4 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const lineTotal = (item.quantity ?? 0) * (item.unitPrice ?? 0);
                return (
                  <tr key={i} className="border-t transition-colors table-row" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 px-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        {item.sku}
                      </span>
                    </td>
                    <td className="py-2 px-2.5" style={{ color: 'var(--fg)' }}>{item.description}</td>
                    <td className="py-2 px-2.5 font-mono" style={{ color: item.hsCode ? 'var(--fg)' : 'var(--amber)', fontStyle: item.hsCode ? 'normal' : 'italic' }}>
                      {item.hsCode || PLACEHOLDER}
                    </td>
                    <td className="py-2 px-2.5" style={{ color: item.countryOfOrigin ? 'var(--fg)' : 'var(--amber)', fontStyle: item.countryOfOrigin ? 'normal' : 'italic' }}>
                      {item.countryOfOrigin || PLACEHOLDER}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">{item.quantity ?? '—'}</td>
                    <td className="py-2 px-2.5 text-right font-mono">{item.unitsPerCarton ?? '—'}</td>
                    <td className="py-2 px-2.5 text-right font-mono">{item.cartons ?? '—'}</td>
                    <td className="py-2 px-2.5 text-right font-mono">{item.unitPrice != null ? formatCurrency(item.unitPrice) : '—'}</td>
                    <td className="py-2 px-2.5 text-right font-mono font-semibold">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="rounded-xl p-4 min-w-[260px]" style={{ background: 'var(--bg-muted)' }}>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--fg-muted)' }}>Total cartons</span>
                <span className="font-mono font-semibold">{totalCartons}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--fg-muted)' }}>Total pallets</span>
                <span className="font-mono font-semibold">{booking.pallets ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--fg-muted)' }}>Total gross weight</span>
                <span className="font-mono font-semibold">{booking.totalGrossWeight ?? '—'} kg</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-sm" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold" style={{ color: 'var(--fg)' }}>Total declared value</span>
                <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(totalValue.toNumber())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fields */}
        <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4" style={{ borderColor: 'var(--border)' }}>
          <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-muted)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Insurance &amp; other charges</span>
            <span className="text-xs italic" style={{ color: 'var(--amber)' }}>{PLACEHOLDER}</span>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-muted)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Declaration</span>
            <span className="text-xs italic" style={{ color: 'var(--amber)' }}>{PLACEHOLDER}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
