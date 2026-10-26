'use client';

import { useState } from 'react';
import type { BookingReport, Finding } from '@/lib/schemas';
import { getQuickFix, type QuickFix } from '@/lib/fixes';
import { Check, Chevron } from './ui/Icons';

interface Props {
  report: BookingReport;
  compact?: boolean;
  onFix: (fix: QuickFix) => void;
  onAcknowledge?: (f: Finding) => void;
  onUndo?: (f: Finding) => void;
}

type Group = 'block' | 'review' | 'wait' | 'pass';

function groupOf(f: Finding): Group {
  if (f.status === 'pass') return 'pass';
  if (f.acknowledged) return 'pass';
  if (f.severity === 'Red' && f.status === 'fail') return 'block';
  if (f.status === 'not_checked') return 'wait';
  return 'review';
}

const rowId = (f: Finding, i: number) => `${f.ruleId}-${f.affectedItem?.sku ?? ''}-${i}`;

export function FindingsPanel({ report, compact, onFix, onAcknowledge, onUndo }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showPass, setShowPass] = useState(false);
  const indexed = report.findings.map((f, i) => ({ f, i }));
  const by = (g: Group) => indexed.filter(x => groupOf(x.f) === g);
  const blockers = by('block');
  const review = by('review');
  const waiting = by('wait');
  const passed = by('pass');

  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const Row = ({ f, i }: { f: Finding; i: number }) => {
    const id = rowId(f, i);
    const expanded = !compact && open.has(id);
    const fix = getQuickFix(f, report.booking, report.items);
    const tone = f.status === 'pass' || f.acknowledged ? 'clear' : f.severity === 'Red' && f.status === 'fail' ? 'blocked' : 'review';
    const label = f.acknowledged ? 'Confirmed' : f.status === 'pass' ? 'Pass' : f.severity === 'Red' && f.status === 'fail' ? 'Blocker' : f.status === 'not_checked' ? 'Waiting' : f.status === 'needs_clarification' ? 'Question' : 'Review';
    const title = `${f.ruleName}${f.affectedItem ? `: ${f.affectedItem.description || f.affectedItem.sku}` : ''}`;
    return (
      <div className="finding">
        <button
          type="button"
          className="finding-head"
          onClick={() => !compact && toggle(id)}
          aria-expanded={compact ? undefined : expanded}
          style={compact ? { cursor: 'default' } : undefined}
        >
          <span className="finding-id">{f.ruleId}</span>
          <span>
            <span className="strong" style={{ display: 'block' }}>{title}</span>
            <span className="small muted" style={{ display: 'block', marginTop: 2 }}>{f.evidence}</span>
          </span>
          <span className="row" style={{ gap: 8 }}>
            <span className={`chip chip-${tone}`}>{label}</span>
            {!compact && <Chevron style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />}
          </span>
        </button>

        {compact && (fix || (f.status === 'needs_clarification' && onAcknowledge)) && (
          <div style={{ padding: '0 20px 14px' }} className="row">
            {fix && <button type="button" className="btn btn-line btn-sm" onClick={() => onFix(fix)} title={fix.detail}>{fix.label}</button>}
          </div>
        )}

        {expanded && (
          <div className="finding-body enter">
            {(f.expected || f.actual) && (
              <div className="kv">
                <div><div className="label">Expected</div><div className="strong">{f.expected ?? '-'}</div></div>
                <div><div className="label">Found</div><div className="strong">{f.actual ?? '-'}</div></div>
              </div>
            )}
            <div><div className="label">Why it matters</div><p style={{ margin: '2px 0 0' }}>{f.whyItMatters}</p></div>
            {f.status !== 'pass' && (
              <div className="fix-box">
                <div style={{ flex: '1 1 260px' }}>
                  <div className="label">{f.acknowledged ? 'Confirmed by you' : 'How to fix it'}</div>
                  <p style={{ margin: '2px 0 0' }}>{f.fix}</p>
                  {fix && <p className="small muted" style={{ margin: '4px 0 0' }}>{fix.detail}</p>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {fix && !f.acknowledged && <button type="button" className="btn btn-primary btn-sm" onClick={() => onFix(fix)}>{fix.label}</button>}
                  {onAcknowledge && !f.acknowledged && !(f.severity === 'Red' && f.status === 'fail') && f.status !== 'not_checked' && (
                    <button type="button" className="btn btn-line btn-sm" onClick={() => onAcknowledge(f)}>
                      {f.status === 'needs_clarification' ? 'This is fine, continue' : 'I accept this warning'}
                    </button>
                  )}
                  {f.acknowledged && onUndo && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onUndo(f)}>Undo</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const section = ({ title, tone, rows, hint }: { title: string; tone: 'blocked' | 'review' | 'clear' | 'neutral'; rows: { f: Finding; i: number }[]; hint?: string }) =>
    rows.length === 0 ? null : (
      <section aria-label={title}>
        <div className="panel-head">
          <h3 className="heading">{title}</h3>
          <span className={`chip chip-${tone}`}>{rows.length}</span>
        </div>
        {hint && <p className="small muted" style={{ padding: '10px 20px 0', margin: 0 }}>{hint}</p>}
        {rows.map(r => <Row key={rowId(r.f, r.i)} f={r.f} i={r.i} />)}
      </section>
    );

  const allClear = blockers.length === 0 && review.length === 0 && waiting.length === 0;

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      {allClear && (
        <div className="panel-pad row" style={{ gap: 12 }}>
          <span className="chip chip-clear chip-lg"><Check width={14} height={14} />All ten rules pass</span>
          <span className="muted small">Nothing to fix. Look through the carrier and invoice, then mark it ready.</span>
        </div>
      )}
      {section({ title: 'Blockers', tone: 'blocked', rows: blockers, hint: compact ? undefined : 'These must be fixed before the booking can go.' })}
      {section({ title: 'Needs your attention', tone: 'review', rows: review })}
      {!compact && section({ title: 'Could not check yet', tone: 'neutral', rows: waiting, hint: 'A detail is missing, so the rule cannot run.' })}
      {compact && waiting.length > 0 && (
        <p className="small muted" style={{ padding: '12px 20px', margin: 0, borderTop: blockers.length + review.length ? '1px solid var(--line)' : 0 }}>
          {waiting.length} check{waiting.length === 1 ? '' : 's'} waiting for details.
        </p>
      )}
      {!compact && passed.length > 0 && (
        <section aria-label="Passed checks">
          <button type="button" className="panel-head" style={{ width: '100%', background: 'transparent', border: 0, borderTop: allClear ? '1px solid var(--line)' : undefined, textAlign: 'left' }} onClick={() => setShowPass(s => !s)} aria-expanded={showPass}>
            <h3 className="heading">Passed</h3>
            <span className="row" style={{ gap: 8 }}><span className="chip chip-clear">{passed.length}</span><Chevron style={{ transform: showPass ? 'rotate(180deg)' : undefined }} /></span>
          </button>
          {showPass && passed.map(r => <Row key={rowId(r.f, r.i)} f={r.f} i={r.i} />)}
        </section>
      )}
    </div>
  );
}
