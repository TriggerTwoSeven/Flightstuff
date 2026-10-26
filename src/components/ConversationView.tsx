'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesk, type ChatMessage } from '@/lib/desk';
import { getMissing } from '@/lib/interpreter';
import { applyQuickFix, editBookingField, editItemField } from '@/lib/report-edit';
import { EXAMPLES } from '@/lib/examples';
import { hrefFor } from '@/lib/route';
import { formatCurrency } from '@/lib/utils';
import { BookingSheet } from './BookingSheet';
import { FindingsPanel } from './FindingsPanel';
import { StatusChip } from './ui/StatusChip';
import { ArrowRight, Reset, Send } from './ui/Icons';

const WHAT_IF = ['Make it fastest', 'Make it cheapest', 'Add a pallet'];

export function ConversationView() {
  const desk = useDesk();
  const { messages, pending, thinking, report, conv } = desk;
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el && messages.length > 0) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    await desk.send(t);
    inputRef.current?.focus();
  };

  const progress = useMemo(() => {
    const b = conv.booking;
    const must: unknown[] = [b.originCity, b.destinationCity, b.destinationType, b.readyToShipDate, b.sellerPriority, b.pallets, b.totalGrossWeight];
    if ((b.destinationType ?? '').toLowerCase() === 'warehouse') must.push(b.deliveryAppointmentBooked);
    if (conv.items.length === 0) must.push(null);
    for (const i of conv.items) must.push(i.quantity, i.unitPrice, i.unitsPerCarton, i.unitWeight, i.hsCode);
    const filled = must.filter(v => v !== null && v !== undefined && v !== '').length;
    return { filled, total: must.length, pct: Math.round((filled / must.length) * 100) };
  }, [conv]);

  const hasSheet = messages.length > 0 && report;
  const blockers = report?.findings.filter(f => f.severity === 'Red' && f.status === 'fail').length ?? 0;
  const rec = report?.recommendation?.recommended;
  const missingRequired = getMissing(conv.booking, conv.items).filter(m => m.required).length;

  const bookingEdit = (key: string, raw: string) => {
    if (!report) return null;
    const r = editBookingField(report, key, raw);
    if (!r.ok) return r.error;
    desk.updateReport('chat', r.report);
    return null;
  };
  const itemEdit = (sku: string, key: string, raw: string) => {
    if (!report) return null;
    const r = editItemField(report, sku, key, raw);
    if (!r.ok) return r.error;
    desk.updateReport('chat', r.report);
    return null;
  };

  return (
    <div className="page wrap">
      <header className="row row-between enter" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 className="title">Describe your shipment</h1>
          <p className="lede" style={{ marginTop: 8 }}>Say it the way you would say it. The booking sheet fills in as you go and all ten rules run on every message.</p>
        </div>
        {messages.length > 0 && <button type="button" className="btn btn-line btn-sm" onClick={desk.resetConversation}><Reset />Start over</button>}
      </header>

      <div className="workspace">
        <section className="panel chat enter-2" aria-label="Conversation">
          <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
            <div className="msg bot">
              <span className="who">ReadyRoute</span>
              <div className="bubble">
                <p style={{ margin: 0 }}>Tell me what you are shipping, where from and where to. Add quantities, prices, weights and an HS code if you have them. I will ask for whatever is missing, one question at a time.</p>
              </div>
            </div>

            {messages.length === 0 && (
              <div className="enter-2">
                <p className="label" style={{ marginBottom: 8 }}>Or try a practice shipment</p>
                <div className="example-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                  {EXAMPLES.map(ex => (
                    <button key={ex.id} type="button" className="example" onClick={() => submit(ex.text)}>
                      <span className="t">{ex.title}</span>
                      <span className="small muted">{ex.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => <Message key={m.id} m={m} onQuick={submit} busy={thinking} />)}

            {thinking && (
              <div className="msg bot" aria-label="Working">
                <span className="who">ReadyRoute</span>
                <div className="bubble"><span className="dots" aria-hidden="true"><span /><span /><span /></span><span className="sr-only">Reading your message</span></div>
              </div>
            )}
          </div>

          <form className="composer" onSubmit={e => { e.preventDefault(); submit(input); }}>
            <label htmlFor="chat-input" className="sr-only">Describe your shipment</label>
            <textarea
              id="chat-input"
              ref={inputRef}
              className="textarea"
              rows={2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); } }}
              placeholder={pending ? pending.question : 'e.g. 500 mugs from Leeds to Rotterdam, 2 pallets, 300 kg'}
            />
            <button type="submit" className="btn btn-primary" disabled={!input.trim() || thinking} aria-label="Send"><Send /></button>
          </form>
        </section>

        <aside className="stack enter-3" style={{ ['--gap' as string]: '16px', minWidth: 0 }} aria-label="Booking summary">
          <div className="panel">
            <div className="panel-head">
              <h2 className="heading">Booking sheet</h2>
              {report && messages.length > 0 ? <StatusChip status={missingRequired > 0 && report.status === 'clear' ? 'review' : report.status} /> : <span className="chip chip-neutral">Empty</span>}
            </div>
            <div style={{ padding: 16 }}>
              {!hasSheet ? (
                <p className="muted" style={{ margin: 0 }}>Nothing yet. Your details will appear here as you type, and you can edit any of them directly.</p>
              ) : (
                <div className="stack" style={{ ['--gap' as string]: '16px' }}>
                  <div>
                    <div className="row row-between small"><span className="strong">{progress.filled} of {progress.total} details in</span><span className="muted num">{progress.pct}%</span></div>
                    <div className="meter" style={{ marginTop: 6 }} role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Booking completeness"><i style={{ width: `${progress.pct}%` }} /></div>
                  </div>
                  <div className="xs muted">Booking {conv.booking.bookingId}</div>
                  <BookingSheet booking={conv.booking} items={conv.items} derived={conv.derived} onBooking={bookingEdit} onItem={itemEdit} />
                </div>
              )}
            </div>
          </div>

          {hasSheet && report && conv.items.length > 0 && (
            <>
              <FindingsPanel report={report} compact onFix={fix => { desk.updateReport('chat', applyQuickFix(report, fix)); desk.notify(`Done: ${fix.label}`); }} />
              {rec && (
                <div className="panel panel-pad row row-between">
                  <div><div className="label">Recommended carrier</div><div className="strong">{rec.carrier}, {rec.service}</div></div>
                  <div style={{ textAlign: 'right' }}><div className="heading num">{formatCurrency(rec.totalCost)}</div><div className="xs muted">{rec.transitDays} days, {rec.onTimePercent}% on time</div></div>
                </div>
              )}
              <a className="btn btn-ink" href={hrefFor({ name: 'report', source: 'chat', id: '' })} style={{ width: '100%' }}>
                Open the full report{blockers > 0 ? ` (${blockers} blocker${blockers === 1 ? '' : 's'})` : ''}<ArrowRight />
              </a>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Message({ m, onQuick, busy }: { m: ChatMessage; onQuick: (t: string) => void; busy: boolean }) {
  if (m.role === 'user') {
    return (
      <div className="msg user">
        <span className="who">You</span>
        <div className="bubble" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
      </div>
    );
  }
  const nothing = !m.understood && m.captured.length === 0 && m.unsupported.length === 0;
  return (
    <div className="msg bot">
      <span className="who">ReadyRoute{m.reader === 'ai' ? ' (read with Gemini)' : ''}</span>
      <div className="bubble">
        {nothing && <p style={{ margin: 0 }}>I could not find a shipment detail in that. Try something like “3 pallets, 620 kg, ready next Monday” or answer the question below.</p>}
        {m.captured.length > 0 && (<><p style={{ margin: 0 }} className="strong">Got it</p><ul>{m.captured.map(c => <li key={c}>{c}</li>)}</ul></>)}
        {m.calculated.length > 0 && (<><p style={{ margin: '10px 0 0' }} className="strong">Worked out for you</p><ul>{m.calculated.map(c => <li key={c}>{c}</li>)}</ul></>)}
        {m.unsupported.map(u => <p key={u} style={{ margin: '10px 0 0' }} className="tone-review strong">{u}</p>)}

        {m.question && (
          <div style={{ marginTop: m.captured.length || m.calculated.length ? 12 : 0 }}>
            <p style={{ margin: 0 }} className="strong">{m.question.question}</p>
            <p className="xs muted" style={{ margin: '2px 0 0' }}>{m.remaining === 1 ? 'That is the last detail I need.' : `${m.remaining} details to go.`}</p>
            {m.question.options && (
              <div className="quick">
                {m.question.options.map(o => <button key={o} type="button" disabled={busy} onClick={() => onQuick(o)}>{o}</button>)}
              </div>
            )}
          </div>
        )}

        {m.outcome && (
          <div style={{ marginTop: m.captured.length || m.calculated.length ? 12 : 0 }}>
            <div className="row" style={{ gap: 10 }}>
              <StatusChip status={m.outcome.status} />
              <span className="small">
                {m.outcome.blockers > 0 ? `${m.outcome.blockers} blocker${m.outcome.blockers === 1 ? '' : 's'}` : 'No blockers'}
                {m.outcome.reviews > 0 ? `, ${m.outcome.reviews} to review` : ''}
              </span>
            </div>
            {m.outcome.carrier && <p style={{ margin: '8px 0 0' }}>Best carrier for you: <span className="strong">{m.outcome.carrier}</span>.</p>}
            {m.outcome.blockers > 0 && <p className="small muted" style={{ margin: '6px 0 0' }}>Use the fix buttons on the right, or tell me what to change.</p>}
            <div className="quick">
              {WHAT_IF.map(o => <button key={o} type="button" disabled={busy} onClick={() => onQuick(o)}>{o}</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
