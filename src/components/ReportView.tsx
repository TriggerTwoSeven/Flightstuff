'use client';

import { useState } from 'react';
import { useDesk } from '@/lib/desk';
import { hrefFor, type Route } from '@/lib/route';
import { acknowledge, applyQuickFix, editBookingField, editItemField, unacknowledge } from '@/lib/report-edit';
import { evaluateBooking } from '@/lib/evaluate';
import { formatCurrency } from '@/lib/utils';
import type { BookingReport } from '@/lib/schemas';
import { BookingSheet } from './BookingSheet';
import { FindingsPanel } from './FindingsPanel';
import { CarrierPanel } from './CarrierPanel';
import { InvoiceDraft } from './InvoiceDraft';
import { StatusChip } from './ui/StatusChip';
import { ArrowLeft, Check, Copy } from './ui/Icons';

type ReportRoute = Extract<Route, { name: 'report' }>;
type Tab = 'checks' | 'carrier' | 'invoice';

const BACK: Record<ReportRoute['source'], { label: string; route: Route }> = {
  chat: { label: 'Back to the chat', route: { name: 'describe' } },
  batch: { label: 'Back to batch results', route: { name: 'upload' } },
  saved: { label: 'Back to History', route: { name: 'history' } },
};

export function ReportView({ route }: { route: ReportRoute }) {
  const desk = useDesk();
  const [tab, setTab] = useState<Tab>('checks');
  const [copied, setCopied] = useState(false);

  const report: BookingReport | null =
    route.source === 'chat' ? desk.report
    : route.source === 'batch' ? desk.batch?.reports.find(r => r.booking.bookingId === route.id) ?? null
    : desk.history.find(s => s.key === route.id)?.report ?? null;
  const savedEntry = route.source === 'saved' ? desk.history.find(s => s.key === route.id) : undefined;
  const back = BACK[route.source];

  if (!report) {
    return (
      <div className="page wrap">
        <a className="crumb" href={hrefFor(back.route)}><ArrowLeft />{back.label}</a>
        <div className="panel panel-pad" style={{ maxWidth: 560, marginTop: 16 }}>
          <h1 className="title">That booking is not open any more</h1>
          <p className="lede" style={{ marginTop: 8 }}>Reports last for the visit unless they are saved to History. Start a new check and it will appear here.</p>
          <div className="row" style={{ marginTop: 20 }}>
            <a className="btn btn-primary" href={hrefFor({ name: 'describe' })}>Describe a shipment</a>
            <a className="btn btn-line" href={hrefFor({ name: 'upload' })}>Upload a file</a>
          </div>
        </div>
      </div>
    );
  }

  const { booking, items, findings, status, recommendation } = report;
  const commit = (next: BookingReport) => desk.updateReport(route.source, next, savedEntry?.key);
  const blockers = findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
  const reviews = findings.filter(f => !f.acknowledged && ((f.severity === 'Amber' && f.status === 'fail') || f.status === 'needs_clarification' || f.status === 'not_checked')).length;
  const rec = recommendation?.recommended;
  const derived = route.source === 'chat' ? desk.conv.derived : undefined;
  const notes = report.dataIssues.filter(d => d.type !== 'missing_sheet');

  const summary = [
    `Booking ${booking.bookingId} (${status === 'clear' ? 'clear to ship' : status === 'review' ? 'needs review' : 'blocked'})`,
    `${booking.sellerName || 'Seller not set'}: ${booking.originCity || '?'} to ${booking.destinationCity || '?'}, ${booking.destinationCountry || '?'} (${booking.destinationType || 'type not set'})`,
    `Ready to ship ${booking.readyToShipDate || 'date not set'}. ${booking.pallets ?? '?'} pallets, ${booking.cartons ?? '?'} cartons, ${booking.totalGrossWeight ?? '?'} kg gross.`,
    `Declared value ${booking.totalDeclaredValue != null ? formatCurrency(booking.totalDeclaredValue) : 'not set'}.`,
    rec ? `Carrier: ${rec.carrier}, ${rec.service}, ${formatCurrency(rec.totalCost)}, ${rec.transitDays} days.` : 'Carrier: none eligible yet.',
    ...items.map(i => `- ${i.sku} ${i.description}: ${i.quantity ?? '?'} units, HS ${i.hsCode ?? '?'}, made in ${i.countryOfOrigin ?? '?'}`),
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      desk.notify('Summary copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      desk.notify('Could not copy. Select the text instead.');
    }
  };

  return (
    <div className="page wrap">
      <a className="crumb" href={hrefFor(back.route)}><ArrowLeft />{back.label}</a>

      <header className="row row-between enter" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1 className="title">{booking.bookingId}</h1>
            <StatusChip status={status} large />
          </div>
          <p className="lede" style={{ marginTop: 6 }}>
            {booking.sellerName || 'Seller not set'}. {booking.originCity || '?'} to {booking.destinationCity || '?'}{booking.destinationCountry ? `, ${booking.destinationCountry}` : ''}.
          </p>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <div><div className={`heading num ${blockers ? 'tone-blocked' : ''}`} style={{ fontSize: '1.8rem' }}>{blockers}</div><div className="label">Blockers</div></div>
          <div><div className={`heading num ${reviews ? 'tone-review' : ''}`} style={{ fontSize: '1.8rem' }}>{reviews}</div><div className="label">To review</div></div>
        </div>
      </header>

      {notes.length > 0 && (
        <div className="callout amber enter-2" style={{ marginTop: 20 }}>
          <div className="strong">Notes from the spreadsheet</div>
          <ul>{notes.map((n, i) => <li key={i}>{n.message}</li>)}</ul>
        </div>
      )}

      <div className="two-col" style={{ marginTop: 24 }}>
        <aside className="panel sticky-col enter-2" aria-label="Booking sheet">
          <div className="panel-head"><h2 className="heading">Booking sheet</h2><span className="xs muted">Click any value to edit</span></div>
          <div style={{ padding: 16 }}>
            <BookingSheet
              booking={booking}
              items={items}
              derived={derived}
              onBooking={(k, raw) => { const r = editBookingField(report, k, raw); if (!r.ok) return r.error; commit(r.report); return null; }}
              onItem={(sku, k, raw) => { const r = editItemField(report, sku, k, raw); if (!r.ok) return r.error; commit(r.report); return null; }}
            />
          </div>
        </aside>

        <div className="stack enter-3" style={{ ['--gap' as string]: '20px', minWidth: 0 }}>
          <div className="tabs" role="tablist" aria-label="Report sections">
            {([['checks', 'Pre-flight checks'], ['carrier', 'Carrier'], ['invoice', 'Invoice draft']] as [Tab, string][]).map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className="tab" onClick={() => setTab(id)}>
                {label}
                {id === 'checks' && blockers + reviews > 0 && <span className={`count${blockers ? ' red' : ''}`}>{blockers + reviews}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab} className="enter">
            {tab === 'checks' && (
              <FindingsPanel
                report={report}
                onFix={fix => { commit(applyQuickFix(report, fix)); desk.notify(`Done: ${fix.label}`); }}
                onAcknowledge={f => commit(acknowledge(report, f))}
                onUndo={f => commit(unacknowledge(report, f))}
              />
            )}
            {tab === 'carrier' && (
              <CarrierPanel
                booking={booking}
                recommendation={recommendation}
                onPriority={p => commit(evaluateBooking({ ...booking, sellerPriority: p }, items, report.dataIssues, report.acknowledged))}
              />
            )}
            {tab === 'invoice' && <InvoiceDraft booking={booking} items={items} />}
          </div>

          <section className="panel panel-pad" aria-labelledby="ready-h">
            <h2 className="heading" id="ready-h">{blockers > 0 ? 'Fix the blockers to finish' : status === 'clear' ? 'Ready to go' : 'Nearly there'}</h2>
            <p className="muted" style={{ margin: '6px 0 14px', maxWidth: '60ch' }}>
              {blockers > 0
                ? `${blockers} blocker${blockers === 1 ? '' : 's'} left. Use the fix buttons in Pre-flight checks, or edit the sheet.`
                : status === 'clear'
                  ? 'Every rule passes. Save it to History or copy the summary to send on. This tool prepares the booking and does not book, collect or dispatch freight.'
                  : 'No blockers, but some items need a look. You can still save it and come back.'}
            </p>
            <pre className="field small" style={{ whiteSpace: 'pre-wrap', padding: 14, margin: '0 0 14px', fontFamily: 'inherit', overflowWrap: 'anywhere' }}>{summary}</pre>
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={blockers > 0} onClick={() => desk.markReady(route.source === 'saved' ? savedEntry!.source : route.source === 'batch' ? 'upload' : 'chat', report)}>
                <Check />Save to History
              </button>
              <button type="button" className="btn btn-line" onClick={copy}><Copy />{copied ? 'Copied' : 'Copy summary'}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
