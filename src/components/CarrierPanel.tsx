'use client';

import type { Booking, Recommendation } from '@/lib/schemas';
import { SELLER_PRIORITIES } from '@/lib/constants';
import { addWorkingDays, formatDDMMYYYY, fromDDMMYYYY } from '@/lib/normalise';
import { formatCurrency } from '@/lib/utils';

interface Props {
  booking: Booking;
  recommendation: Recommendation | null;
  onPriority?: (priority: string) => void;
}

function arrival(readyDate: string, days: number): string | null {
  const d = fromDDMMYYYY(readyDate);
  if (!d) return null;
  return formatDDMMYYYY(addWorkingDays(d, days));
}

export function CarrierPanel({ booking, recommendation: rec, onPriority }: Props) {
  if (!rec) return <div className="panel panel-pad muted">Add a destination, pallets and weight to see the carriers.</div>;
  const best = rec.recommended;
  const rows = [...rec.allCandidates].sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.totalCost - b.totalCost);

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      {onPriority && (
        <div className="panel panel-pad">
          <div className="label" id="prio-label">What matters most for this shipment?</div>
          <div className="row" role="group" aria-labelledby="prio-label" style={{ gap: 8, marginTop: 10 }}>
            {SELLER_PRIORITIES.map(p => (
              <button key={p} type="button" aria-pressed={rec.priority === p} className={`btn btn-sm ${rec.priority === p ? 'btn-ink' : 'btn-line'}`} onClick={() => onPriority(p)}>{p}</button>
            ))}
          </div>
          {!booking.sellerPriority && <p className="small muted" style={{ margin: '10px 0 0' }}>No priority was given, so Balanced is shown. Pick one to change the recommendation.</p>}
        </div>
      )}

      {best ? (
        <div className="panel panel-pad enter">
          <div className="row" style={{ gap: 10 }}><span className="chip chip-clear">Recommended</span><span className="muted small">{rec.priority}</span></div>
          <h3 className="title" style={{ marginTop: 12 }}>{best.carrier}</h3>
          <p className="lede" style={{ marginTop: 4 }}>{best.service}. {rec.explanation}</p>
          <div className="stats" style={{ marginTop: 18 }}>
            <div className="field" style={{ padding: '12px 14px' }}><div className="label">Total</div><div className="heading num">{formatCurrency(best.totalCost)}</div><div className="xs muted">{formatCurrency(best.pricePerPallet)} per pallet</div></div>
            <div className="field" style={{ padding: '12px 14px' }}><div className="label">Transit</div><div className="heading num">{best.transitDays} days</div><div className="xs muted">{arrival(booking.readyToShipDate, best.transitDays) ? `Arrives about ${arrival(booking.readyToShipDate, best.transitDays)}` : 'Add a ship date for an estimate'}</div></div>
            <div className="field" style={{ padding: '12px 14px' }}><div className="label">On time</div><div className="heading num">{best.onTimePercent}%</div><div className="xs muted">{best.actualKgPerPallet} of {best.maxKgPerPallet} kg per pallet</div></div>
          </div>
          {rec.alternativeTradeoff && (
            <p className="callout blue" style={{ margin: '16px 0 0' }}><span className="strong">Next best: </span>{rec.alternativeTradeoff}</p>
          )}
        </div>
      ) : (
        <div className="callout red enter">
          <div className="strong">No carrier can take this booking</div>
          <p style={{ margin: '4px 0 0' }}>{rec.noEligibleReason ?? rec.explanation}</p>
          {rec.explanation && rec.noEligibleReason && <p style={{ margin: '4px 0 0' }}>{rec.explanation}</p>}
        </div>
      )}

      {rows.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3 className="heading">All services to {booking.destinationCountry}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Carrier</th><th className="r">Per pallet</th><th className="r">Total</th><th className="r">Transit</th><th className="r">On time</th><th className="r">Limit</th></tr></thead>
              <tbody>
                {rows.map(c => {
                  const isBest = best && c.carrier === best.carrier && c.service === best.service;
                  return (
                    <tr key={`${c.carrier}-${c.service}`} className={isBest ? 'best' : c.eligible ? undefined : 'off'}>
                      <td><span className="strong">{c.carrier}</span><div className="xs muted">{c.service}{!c.eligible && c.ineligibleReason ? `. ${c.ineligibleReason}` : ''}</div></td>
                      <td className="r num">{formatCurrency(c.pricePerPallet)}</td>
                      <td className="r num strong">{formatCurrency(c.totalCost)}</td>
                      <td className="r num">{c.transitDays} d</td>
                      <td className="r num">{c.onTimePercent}%</td>
                      <td className="r num">{c.maxKgPerPallet} kg</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="xs muted" style={{ padding: '10px 16px 14px', margin: 0 }}>Fixed test rate card, not live rates. Arrival dates skip weekends but not bank holidays.</p>
        </div>
      )}
    </div>
  );
}
