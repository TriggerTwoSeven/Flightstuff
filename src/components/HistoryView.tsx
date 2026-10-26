'use client';

import { useDesk } from '@/lib/desk';
import { hrefFor } from '@/lib/route';
import { formatCurrency } from '@/lib/utils';
import { StatusChip } from './ui/StatusChip';
import { Trash } from './ui/Icons';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function HistoryView() {
  const { history, removeSaved, clearSaved, notify } = useDesk();

  return (
    <div className="page wrap">
      <div className="row row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="title">History</h1>
          <p className="muted small" style={{ marginTop: 6 }}>Saved on this device only. Nothing is uploaded.</p>
        </div>
        {history.length > 0 && (
          <button type="button" className="btn btn-line btn-sm" onClick={() => { clearSaved(); notify('History cleared'); }}>
            <Trash width={16} height={16} /> Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="panel panel-pad" style={{ maxWidth: 560 }}>
          <h2 className="heading">Nothing saved yet</h2>
          <p className="muted" style={{ marginTop: 8 }}>Finished chat checks save here by themselves, and you can save any uploaded booking from its report.</p>
          <div className="row" style={{ marginTop: 20 }}>
            <a className="btn btn-primary" href={hrefFor({ name: 'describe' })}>Describe a shipment</a>
            <a className="btn btn-line" href={hrefFor({ name: 'upload' })}>Upload a file</a>
          </div>
        </div>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th><th>Seller</th><th>Route</th><th className="r">Value</th><th>Status</th><th>Saved</th><th><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {history.map(s => {
                const b = s.report.booking;
                return (
                  <tr key={s.key}>
                    <td><a className="rowlink" href={hrefFor({ name: 'report', source: 'saved', id: s.key })}>{b.bookingId}</a></td>
                    <td>{b.sellerName || <span className="muted">No name</span>}</td>
                    <td>{b.originCity} to {b.destinationCity}</td>
                    <td className="r num">{b.totalDeclaredValue != null ? formatCurrency(b.totalDeclaredValue) : '–'}</td>
                    <td><StatusChip status={s.report.status} /></td>
                    <td className="muted small">{when(s.savedAt)}</td>
                    <td className="r">
                      <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${b.bookingId}`} onClick={() => removeSaved(s.key)}>
                        <Trash width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
