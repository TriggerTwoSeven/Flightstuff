'use client';

import { useState, useCallback } from 'react';
import type { BookingReport, Booking, Item } from '@/lib/schemas';
import { evaluateBooking } from '@/lib/evaluate';
import { StatusBadge } from '@/components/StatusBadge';
import { FindingsPanel } from '@/components/FindingsPanel';
import { CarrierRecommendation } from '@/components/CarrierRecommendation';
import { InvoiceDraft } from '@/components/InvoiceDraft';
import { formatCurrency } from '@/lib/utils';

interface Props {
  report: BookingReport;
  onBack: () => void;
  onUpdate: (report: BookingReport) => void;
}

export function BookingDetailView({ report, onBack, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'checks' | 'carrier' | 'invoice'>('checks');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { booking, items, findings, status, recommendation } = report;

  const recompute = useCallback((b: Booking, its: Item[]) => {
    const updated = evaluateBooking(b, its, report.dataIssues);
    onUpdate(updated);
  }, [report.dataIssues, onUpdate]);

  const handleBookingEdit = (field: keyof Booking, value: string | number | null) => {
    const updated = { ...booking, [field]: value };
    recompute(updated, items);
    setEditingField(null);
  };

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const redCount = findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
  const amberCount = findings.filter(f => (f.severity === 'Amber' && f.status === 'fail') || f.status === 'needs_clarification').length;

  const isAllClear = redCount === 0 && amberCount === 0 && findings.every(f => f.status === 'pass');

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="btn btn-ghost text-sm mb-4 -ml-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back
      </button>

      {/* Status banner */}
      <div
        className="card p-5 sm:p-6 mb-6 animate-fade-in-scale"
        style={{
          background: status === 'clear' ? 'var(--green-light)' : status === 'blocked' ? 'var(--red-light)' : 'var(--amber-light)',
          borderColor: status === 'clear' ? 'var(--green-border)' : status === 'blocked' ? 'var(--red-border)' : 'var(--amber-border)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--fg)' }}>{booking.bookingId}</h2>
              <StatusBadge status={status} large />
            </div>
            <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
              <span className="font-medium">{booking.sellerName}</span>
              <span style={{ color: 'var(--fg-subtle)' }}>&middot;</span>
              {booking.originCity}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              {booking.destinationCity}, {booking.destinationCountry}
            </p>
          </div>
          {isAllClear && (
            <div className="flex items-center gap-2 text-sm font-semibold animate-fade-in-scale" style={{ color: 'var(--green)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              All clear — ready to go
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--fg)' }}>Booking Details</h3>
            <div className="space-y-1">
              <EditableRow label="Seller" value={booking.sellerName} field="sellerName" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('sellerName', v)} />
              <EditableRow label="Origin" value={`${booking.originCity}, ${booking.originCountry}`} field="originCity" editing={editingField} editValue={editValue} onStart={(f) => startEdit(f, booking.originCity)} onChange={setEditValue} onSave={v => handleBookingEdit('originCity', v)} />
              <EditableRow label="Destination" value={`${booking.destinationCity}, ${booking.destinationCountry}`} field="destinationCity" editing={editingField} editValue={editValue} onStart={(f) => startEdit(f, booking.destinationCity)} onChange={setEditValue} onSave={v => handleBookingEdit('destinationCity', v)} />
              <EditableRow label="Type" value={booking.destinationType} field="destinationType" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('destinationType', v)} />
              <EditableRow label="Ship date" value={booking.readyToShipDate} field="readyToShipDate" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('readyToShipDate', v)} />
              <EditableRow label="Priority" value={booking.sellerPriority} field="sellerPriority" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('sellerPriority', v)} />
              <EditableRow label="Pallets" value={String(booking.pallets ?? '')} field="pallets" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('pallets', v ? Number(v) : null)} />
              <EditableRow label="Cartons" value={String(booking.cartons ?? '')} field="cartons" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('cartons', v ? Number(v) : null)} />
              <EditableRow label="Declared value" value={booking.totalDeclaredValue != null ? formatCurrency(booking.totalDeclaredValue) : ''} field="totalDeclaredValue" editing={editingField} editValue={editValue} onStart={(f) => startEdit(f, String(booking.totalDeclaredValue ?? ''))} onChange={setEditValue} onSave={v => handleBookingEdit('totalDeclaredValue', v ? Number(v.replace(/[£,]/g, '')) : null)} />
              <EditableRow label="Gross weight" value={booking.totalGrossWeight != null ? `${booking.totalGrossWeight} kg` : ''} field="totalGrossWeight" editing={editingField} editValue={editValue} onStart={(f) => startEdit(f, String(booking.totalGrossWeight ?? ''))} onChange={setEditValue} onSave={v => handleBookingEdit('totalGrossWeight', v ? Number(v.replace(/kg/gi, '').trim()) : null)} />
              <EditableRow label="Appointment" value={booking.deliveryAppointmentBooked} field="deliveryAppointmentBooked" editing={editingField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={v => handleBookingEdit('deliveryAppointmentBooked', v)} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--fg)' }}>Items ({items.length})</h3>
            {items.map((item, i) => (
              <div key={i} className="rounded-xl p-3 mb-2 text-xs animate-fade-in" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                <div className="font-semibold text-sm mb-1.5" style={{ color: 'var(--fg)' }}>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md mr-1.5" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{item.sku}</span>
                  {item.description}
                </div>
                <div className="grid grid-cols-2 gap-1" style={{ color: 'var(--fg-muted)' }}>
                  <span>Qty: {item.quantity ?? '—'}</span>
                  <span>Price: {item.unitPrice != null ? `£${item.unitPrice}` : '—'}</span>
                  <span>HS: {item.hsCode ?? '—'}</span>
                  <span>Weight: {item.unitWeight != null ? `${item.unitWeight} kg` : '—'}</span>
                  <span>Per carton: {item.unitsPerCarton ?? '—'}</span>
                  <span>Cartons: {item.cartons ?? '—'}</span>
                  <span className="col-span-2">Origin: {item.countryOfOrigin ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="tab-group">
            {([
              { id: 'checks' as const, label: `Pre-Flight`, badge: redCount + amberCount > 0 ? `${redCount}R / ${amberCount}A` : undefined },
              { id: 'carrier' as const, label: 'Carrier' },
              { id: 'invoice' as const, label: 'Invoice Draft' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{
                    background: activeTab === tab.id ? 'var(--red-light)' : 'transparent',
                    color: 'var(--red)',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="animate-fade-in" key={activeTab}>
            {activeTab === 'checks' && (
              <FindingsPanel
                findings={findings}
                onAcknowledge={(ruleId, itemSku) => {
                  const updated = {
                    ...report,
                    findings: findings.map(f =>
                      f.ruleId === ruleId && f.affectedItem?.sku === itemSku
                        ? { ...f, acknowledged: true }
                        : f
                    ),
                  };
                  onUpdate(updated);
                }}
              />
            )}

            {activeTab === 'carrier' && recommendation && (
              <CarrierRecommendation recommendation={recommendation} />
            )}

            {activeTab === 'invoice' && (
              <InvoiceDraft booking={booking} items={items} />
            )}
          </div>

          {/* Confirmation section */}
          <div className="card p-6">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--fg)' }}>Confirmation &amp; Next Steps</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
              <InfoRow label="Booking" value={booking.bookingId} />
              <InfoRow label="Seller" value={booking.sellerName} />
              <InfoRow label="Route" value={`${booking.originCity} → ${booking.destinationCity}`} />
              <InfoRow label="Products" value={`${items.length} line${items.length !== 1 ? 's' : ''}`} />
              <InfoRow label="Pallets / Cartons" value={`${booking.pallets ?? '—'} / ${booking.cartons ?? '—'}`} />
              <InfoRow label="Declared value" value={booking.totalDeclaredValue != null ? formatCurrency(booking.totalDeclaredValue) : '—'} />
              <InfoRow label="Gross weight" value={booking.totalGrossWeight != null ? `${booking.totalGrossWeight} kg` : '—'} />
              <InfoRow label="Recommended" value={
                recommendation?.recommended
                  ? `${recommendation.recommended.carrier} ${recommendation.recommended.service} (${formatCurrency(recommendation.recommended.totalCost)})`
                  : 'None eligible'
              } />
            </div>

            <div className="flex gap-3">
              <button
                disabled={redCount > 0}
                className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                style={redCount === 0 ? { background: 'var(--green)', boxShadow: 'var(--shadow), 0 0 20px var(--green-glow)' } : undefined}
                onClick={() => alert('Booking marked as ready. This MVP prepares a booking-ready summary. It does not book, collect, or dispatch freight with a carrier.')}
              >
                {redCount > 0 ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    Fix blockers first
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Looks good, mark ready
                  </>
                )}
              </button>
              <button onClick={() => setActiveTab('checks')} className="btn btn-secondary">
                I need to change something
              </button>
            </div>

            <p className="mt-4 text-xs" style={{ color: 'var(--fg-subtle)' }}>
              This MVP prepares a booking-ready summary. It does <strong>not</strong> book, collect, or dispatch freight.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableRow({ label, value, field, editing, editValue, onStart, onChange, onSave }: {
  label: string;
  value: string;
  field: string;
  editing: string | null;
  editValue: string;
  onStart: (field: string, value: string) => void;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  if (editing === field) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'var(--bg-muted)' }}>
        <span className="text-[11px] font-medium uppercase tracking-wider shrink-0" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
        <input
          autoFocus
          value={editValue}
          onChange={e => onChange(e.target.value)}
          onBlur={() => onSave(editValue)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editValue); if (e.key === 'Escape') onSave(value); }}
          className="input text-sm !py-1 !px-2 w-32"
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors"
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      onClick={() => onStart(field, value)}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <span className={`text-sm ${value ? 'font-medium' : 'italic'}`} style={{ color: value ? 'var(--fg)' : 'var(--fg-subtle)' }}>
        {value || '—'}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{value}</span>
    </div>
  );
}
