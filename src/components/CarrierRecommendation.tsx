'use client';

import { useState } from 'react';
import type { Recommendation, CarrierCandidate } from '@/lib/schemas';
import { BALANCED_WEIGHTS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

interface Props {
  recommendation: Recommendation;
  compact?: boolean;
}

export function CarrierRecommendation({ recommendation, compact }: Props) {
  const [showScoring, setShowScoring] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const { recommended, allCandidates, bestAlternative, explanation, alternativeTradeoff, priority, noEligibleReason } = recommendation;

  if (!recommended) {
    return (
      <div className="card animate-fade-in" style={{ background: 'var(--red-light)', border: '1px solid var(--red-border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--red-glow)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--red)' }}>No Eligible Service</h3>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>No carrier matches the booking requirements</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--fg)' }}>{noEligibleReason || explanation}</p>
      </div>
    );
  }

  const eligibleCount = allCandidates.filter(c => c.eligible).length;
  const ineligibleCount = allCandidates.length - eligibleCount;

  return (
    <div className="card overflow-hidden p-0 animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Carrier Recommendation</h3>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>From the fixed test rate card</p>
          </div>
        </div>
        <span className="badge badge-blue">{priority}</span>
      </div>

      {/* Recommended carrier */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--green-light)' }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--green)', color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base" style={{ color: 'var(--fg)' }}>{recommended.carrier}</span>
              <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{recommended.service}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <span className="font-mono font-semibold" style={{ color: 'var(--fg)' }}>{formatCurrency(recommended.totalCost)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="font-mono" style={{ color: 'var(--fg)' }}>{recommended.transitDays}d transit</span>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={recommended.onTimePercent >= 95 ? 'var(--green)' : 'var(--amber)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span className="font-mono" style={{ color: 'var(--fg)' }}>{recommended.onTimePercent}% on-time</span>
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm mb-3" style={{ color: 'var(--fg)' }}>{explanation}</p>

        {/* Capacity bar */}
        {recommended.actualKgPerPallet > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.5)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Pallet capacity</span>
              <span className="text-xs font-mono" style={{ color: 'var(--fg)' }}>
                {recommended.actualKgPerPallet} / {recommended.maxKgPerPallet} kg
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (recommended.actualKgPerPallet / recommended.maxKgPerPallet) * 100)}%`,
                  background: recommended.actualKgPerPallet / recommended.maxKgPerPallet > 0.9
                    ? 'var(--amber)'
                    : 'var(--green)',
                  animation: 'progress-fill 1s ease-out',
                }}
              />
            </div>
            {recommended.actualKgPerPallet / recommended.maxKgPerPallet > 0.9 && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                </svg>
                Near capacity limit
              </p>
            )}
          </div>
        )}
      </div>

      {/* Best alternative */}
      {bestAlternative && alternativeTradeoff && (
        <div className="px-5 py-4 border-b flex items-start gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Best alternative</span>
            <p className="text-sm mt-0.5" style={{ color: 'var(--fg)' }}>{alternativeTradeoff}</p>
          </div>
        </div>
      )}

      {/* Comparison table */}
      {!compact && (
        <div className="p-5">
          <button
            onClick={() => setShowAllServices(!showAllServices)}
            className="w-full text-left text-xs font-bold flex items-center justify-between mb-3 transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              Compare all {allCandidates.length} services ({eligibleCount} eligible, {ineligibleCount} ineligible)
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: showAllServices ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showAllServices && (
            <div className="rounded-xl overflow-hidden border animate-fade-in" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <th className="text-left py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Service</th>
                    <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Cost</th>
                    <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Transit</th>
                    <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>On-time</th>
                    <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Capacity</th>
                    <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)', fontSize: '10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allCandidates.map((c, i) => {
                    const isRecommended = c === recommended;
                    return (
                      <tr
                        key={i}
                        className="border-t transition-colors"
                        style={{
                          borderColor: 'var(--border)',
                          opacity: c.eligible ? 1 : 0.5,
                          background: isRecommended ? 'var(--accent-light)' : 'transparent',
                        }}
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-medium">{c.carrier}</span>
                          <span className="ml-1" style={{ color: 'var(--fg-muted)' }}>{c.service}</span>
                          {isRecommended && (
                            <svg className="inline ml-1.5" width="12" height="12" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium" style={{ color: isRecommended ? 'var(--accent)' : 'var(--fg)' }}>
                          {formatCurrency(c.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="badge badge-blue" style={{ fontSize: '10px', padding: '1px 6px' }}>{c.transitDays}d</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono" style={{ color: c.onTimePercent >= 95 ? 'var(--green)' : 'var(--amber)' }}>
                          {c.onTimePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-[10px]">{c.actualKgPerPallet}/{c.maxKgPerPallet}</span>
                            <div className="w-12 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(100, (c.actualKgPerPallet / c.maxKgPerPallet) * 100)}%`,
                                background: c.actualKgPerPallet / c.maxKgPerPallet > 0.9 ? 'var(--amber)' : 'var(--green)',
                              }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.eligible ? (
                            <span className="inline-flex items-center gap-1" style={{ color: 'var(--green)' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1" style={{ color: 'var(--red)' }} title={c.ineligibleReason}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                              Ineligible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Balanced scoring */}
          {priority === 'Balanced' && (
            <div className="mt-3">
              <button
                onClick={() => setShowScoring(!showScoring)}
                className="text-xs font-bold flex items-center gap-1.5 transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                {showScoring ? 'Hide scoring' : 'How we scored this'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: showScoring ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {showScoring && (
                <div className="mt-3 rounded-xl p-4 animate-fade-in" style={{ background: 'var(--bg-muted)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: 'var(--fg)' }}>Balanced scoring formula</p>
                  <div className="rounded-lg p-2.5 mb-3 font-mono text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    score = {BALANCED_WEIGHTS.cost} x costN + {BALANCED_WEIGHTS.transit} x transitN + {BALANCED_WEIGHTS.reliability} x (1 - reliabilityN)
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>
                    Each dimension is min-max normalised across eligible services. Lower score wins. Tie-break: higher reliability, then lower cost.
                  </p>
                  {allCandidates.filter(c => c.eligible && c.score != null).length > 0 && (
                    <div className="space-y-1.5">
                      {allCandidates.filter(c => c.eligible && c.score != null).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs rounded-lg px-3 py-2 transition-colors"
                          style={{ background: c === recommended ? 'var(--accent-light)' : 'transparent' }}>
                          <span className="font-medium">{c.carrier} {c.service}</span>
                          <span className="font-mono font-bold" style={{ color: c === recommended ? 'var(--accent)' : 'var(--fg)' }}>
                            {c.score?.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
