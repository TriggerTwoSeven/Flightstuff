'use client';

import { useState } from 'react';
import type { Finding } from '@/lib/schemas';

interface Props {
  findings: Finding[];
  compact?: boolean;
  onAcknowledge?: (ruleId: string, itemSku?: string) => void;
  onFix?: (finding: Finding) => void;
}

const SEVERITY_ORDER = ['fail', 'needs_clarification', 'not_checked', 'pass'] as const;

function StatusIcon({ finding }: { finding: Finding }) {
  const isPass = finding.status === 'pass';
  const isRed = finding.severity === 'Red';
  const isFail = finding.status === 'fail';
  const isNeedsClarification = finding.status === 'needs_clarification';
  const isNotChecked = finding.status === 'not_checked';

  if (isPass) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
  if (isRed && isFail) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
  if (isNeedsClarification) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
  if (isNotChecked) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  );
}

export function FindingsPanel({ findings, compact, onAcknowledge, onFix }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showPassed, setShowPassed] = useState(false);

  const sorted = [...findings].sort((a, b) => {
    const sevA = a.severity === 'Red' ? 0 : 1;
    const sevB = b.severity === 'Red' ? 0 : 1;
    if (sevA !== sevB) return sevA - sevB;
    const statA = SEVERITY_ORDER.indexOf(a.status as typeof SEVERITY_ORDER[number]);
    const statB = SEVERITY_ORDER.indexOf(b.status as typeof SEVERITY_ORDER[number]);
    return statA - statB;
  });

  const failed = sorted.filter(f => f.status !== 'pass');
  const passed = sorted.filter(f => f.status === 'pass');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getFindingId = (f: Finding, i: number) => `${f.ruleId}-${f.affectedItem?.sku || ''}-${i}`;

  const blockers = findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
  const warnings = findings.filter(f => (f.severity === 'Amber' && f.status === 'fail') || f.status === 'needs_clarification').length;
  const notChecked = findings.filter(f => f.status === 'not_checked').length;

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Pre-Flight Checks</h3>
        <div className="flex gap-2">
          {blockers > 0 && <span className="badge badge-red">{blockers} blocker{blockers !== 1 ? 's' : ''}</span>}
          {warnings > 0 && <span className="badge badge-amber">{warnings} warning{warnings !== 1 ? 's' : ''}</span>}
          {notChecked > 0 && <span className="badge" style={{ background: 'var(--bg-muted)', color: 'var(--fg-subtle)', border: '1px solid var(--border)' }}>{notChecked} skipped</span>}
          {passed.length > 0 && <span className="badge badge-green">{passed.length} passed</span>}
        </div>
      </div>

      <div className={compact ? 'max-h-64 overflow-y-auto' : ''}>
        {failed.map((finding, i) => {
          const id = getFindingId(finding, i);
          const expanded = expandedIds.has(id);
          return (
            <FindingCard
              key={id}
              finding={finding}
              expanded={expanded}
              onToggle={() => toggleExpand(id)}
              onAcknowledge={onAcknowledge}
              onFix={onFix}
              compact={compact}
            />
          );
        })}

        {passed.length > 0 && (
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setShowPassed(!showPassed)}
              className="w-full px-5 py-3 text-left text-xs font-semibold flex items-center justify-between transition-colors"
              style={{ color: 'var(--green)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--green-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                {passed.length} check{passed.length !== 1 ? 's' : ''} passed
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: showPassed ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showPassed && passed.map((finding, i) => {
              const id = getFindingId(finding, i + failed.length);
              return (
                <FindingCard
                  key={id}
                  finding={finding}
                  expanded={expandedIds.has(id)}
                  onToggle={() => toggleExpand(id)}
                  compact={compact}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding, expanded, onToggle, onAcknowledge, onFix, compact }: {
  finding: Finding;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge?: (ruleId: string, itemSku?: string) => void;
  onFix?: (finding: Finding) => void;
  compact?: boolean;
}) {
  const isRed = finding.severity === 'Red';
  const isFail = finding.status === 'fail';
  const isNeedsClarification = finding.status === 'needs_clarification';
  const isNotChecked = finding.status === 'not_checked';
  const isPass = finding.status === 'pass';

  const bgColor = isPass ? 'transparent'
    : isRed && isFail ? 'var(--red-glow)'
    : isNeedsClarification ? 'var(--amber-glow)'
    : isNotChecked ? 'transparent'
    : isFail ? 'var(--amber-glow)'
    : 'transparent';

  const statusLabel = isPass ? 'Passed'
    : isRed && isFail ? 'Blocker'
    : isNeedsClarification ? 'Needs clarification'
    : isNotChecked ? 'Not checked'
    : isFail ? 'Review required'
    : 'Passed';

  return (
    <div className="border-t" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 text-left flex items-start gap-3 transition-colors"
        style={{ background: bgColor }}
        onMouseEnter={e => { if (!isPass) e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <span className="mt-0.5 shrink-0"><StatusIcon finding={finding} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'var(--bg-muted)', color: 'var(--fg-muted)' }}>
              {finding.ruleId}
            </span>
            <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{finding.ruleName}</span>
            {!isPass && (
              <span className={`badge ${isRed ? 'badge-red' : 'badge-amber'}`}>
                {statusLabel}
              </span>
            )}
            {finding.acknowledged && (
              <span className="badge" style={{ background: 'var(--bg-muted)', color: 'var(--fg-subtle)', border: '1px solid var(--border)' }}>
                Acknowledged
              </span>
            )}
          </div>
          {finding.affectedItem && (
            <div className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
              {finding.affectedItem.sku} — {finding.affectedItem.description}
            </div>
          )}
          {!compact && !expanded && (
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--fg-subtle)' }}>
              {finding.evidence}
            </p>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2" className="shrink-0 mt-1"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-2 space-y-3 text-sm animate-fade-in" style={{ background: bgColor }}>
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-muted)' }}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Evidence</span>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg)' }}>{finding.evidence}</p>
          </div>
          {finding.expected && finding.actual && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--green-light)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--green)' }}>Expected</span>
                <p className="mt-0.5 text-sm font-mono" style={{ color: 'var(--fg)' }}>{finding.expected}</p>
              </div>
              <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--red-light)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--red)' }}>Actual</span>
                <p className="mt-0.5 text-sm font-mono" style={{ color: 'var(--fg)' }}>{finding.actual}</p>
              </div>
            </div>
          )}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Why it matters</span>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--fg-muted)' }}>{finding.whyItMatters}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--accent-light)' }}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>How to fix</span>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg)' }}>{finding.fix}</p>
          </div>
          {!isPass && (
            <div className="flex gap-2 mt-1">
              {onFix && (
                <button onClick={() => onFix(finding)} className="btn btn-primary text-xs py-1.5 px-3">
                  Fix
                </button>
              )}
              {onAcknowledge && finding.severity === 'Amber' && isFail && !finding.acknowledged && (
                <button
                  onClick={() => onAcknowledge(finding.ruleId, finding.affectedItem?.sku)}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Acknowledge
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
