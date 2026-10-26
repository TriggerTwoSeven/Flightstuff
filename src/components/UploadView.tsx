'use client';

import { useCallback, useRef, useState } from 'react';
import { useDesk } from '@/lib/desk';
import { parseWorkbook } from '@/lib/parser';
import { evaluateBatch } from '@/lib/evaluate';
import { generateSampleWorkbook, sampleWorkbookBuffer, SAMPLE_FILE_NAME } from '@/lib/sample-data';
import { hrefFor } from '@/lib/route';
import { formatCurrency } from '@/lib/utils';
import type { BookingReport, BookingStatus } from '@/lib/schemas';
import { StatusChip } from './ui/StatusChip';
import { Download, Upload } from './ui/Icons';

const MAX_BYTES = 5 * 1024 * 1024;
const ORDER: Record<BookingStatus, number> = { blocked: 0, review: 1, clear: 2 };

function counts(report: BookingReport) {
  const f = report.findings;
  return {
    blockers: f.filter(x => x.severity === 'Red' && x.status === 'fail').length,
    reviews: f.filter(x => !x.acknowledged && ((x.severity === 'Amber' && x.status === 'fail') || x.status === 'needs_clarification' || (x.severity === 'Red' && x.status === 'not_checked'))).length,
  };
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

function exportCsv(fileName: string, reports: BookingReport[]) {
  const head = ['Booking', 'Seller', 'Origin', 'Destination', 'Status', 'Blocking issues', 'To review', 'Carrier', 'Carrier cost (GBP)'];
  const rows = reports.map(r => {
    const c = counts(r);
    const rec = r.recommendation?.recommended;
    return [r.booking.bookingId, r.booking.sellerName, r.booking.originCity, r.booking.destinationCity, r.status, c.blockers, c.reviews, rec ? `${rec.carrier}, ${rec.service}` : '', rec ? rec.totalCost.toFixed(2) : ''];
  });
  const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.replace(/\.[^.]+$/, '')}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UploadView() {
  const { batch, setBatch, markReady } = useDesk();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [includeExample, setIncludeExample] = useState(false);
  const [filter, setFilter] = useState<BookingStatus | null>(null);
  const [worstFirst, setWorstFirst] = useState(true);
  const buffer = useRef<ArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback((buf: ArrayBuffer, name: string, withExample: boolean) => {
    setError(null);
    setFilter(null);
    try {
      const parsed = parseWorkbook(buf, withExample);
      if (parsed.bookings.length === 0) {
        throw new Error('No bookings were found. Check that the file has a Bookings sheet with a header row, or run the practice file to see the layout.');
      }
      const reports = evaluateBatch(parsed.bookings, parsed.items, parsed.dataIssues);
      // Two rows can share an ID in a messy file. Keep both, but make each openable.
      const seen = new Map<string, number>();
      for (const r of reports) {
        const k = r.booking.bookingId.trim().toLowerCase();
        const n = (seen.get(k) ?? 0) + 1;
        seen.set(k, n);
        if (n > 1) r.booking = { ...r.booking, bookingId: `${r.booking.bookingId} (${n})` };
      }
      buffer.current = buf;
      setBatch({ fileName: name, reports, warnings: parsed.dataIssues });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  }, [setBatch]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setError('Please choose an .xlsx workbook. Save other spreadsheet types as .xlsx first.'); return; }
    if (file.size > MAX_BYTES) { setError('That file is over 5 MB. Split it into smaller batches.'); return; }
    run(await file.arrayBuffer(), file.name, includeExample);
  };

  const practice = () => run(sampleWorkbookBuffer(), SAMPLE_FILE_NAME, false);

  const reports = batch?.reports ?? [];
  const tally: Record<BookingStatus, number> = { blocked: 0, review: 0, clear: 0 };
  reports.forEach(r => { tally[r.status]++; });
  const shown = reports
    .filter(r => !filter || r.status === filter)
    .slice()
    .sort((a, b) => (worstFirst ? ORDER[a.status] - ORDER[b.status] : 0));

  if (!batch) {
    return (
      <div className="page wrap" style={{ maxWidth: 860 }}>
        <h1 className="title">Check a whole booking sheet</h1>
        <p className="lede" style={{ marginTop: 10 }}>Upload an Excel workbook with a Bookings sheet and an Items sheet. Every booking gets the same ten checks and a carrier pick.</p>

        <div style={{ marginTop: 28 }}>
          <label
            className={`drop${over ? ' over' : ''}`}
            style={{ display: 'block', cursor: 'pointer' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); void onFile(e.dataTransfer.files[0]); }}
          >
            <Upload width={28} height={28} aria-hidden />
            <span className="heading" style={{ display: 'block', marginTop: 10 }}>Drop your .xlsx file here</span>
            <span className="muted small" style={{ display: 'block', marginTop: 4 }}>or click to choose one. It is read in your browser and never uploaded.</span>
            <input ref={inputRef} className="sr-only" type="file" accept=".xlsx" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>

        {error && <p role="alert" className="callout red" style={{ marginTop: 16 }}>{error}</p>}

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-primary" onClick={practice}>Run the practice file</button>
          <button type="button" className="btn btn-line" onClick={() => generateSampleWorkbook()}><Download width={16} height={16} /> Download it to see the layout</button>
        </div>
        <label className="row small" style={{ marginTop: 18, gap: 8 }}>
          <input type="checkbox" checked={includeExample} onChange={e => setIncludeExample(e.target.checked)} />
          <span>Include the grey example row from the template</span>
        </label>
      </div>
    );
  }

  return (
    <div className="page wrap">
      <div className="row row-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="title">{reports.length} booking{reports.length === 1 ? '' : 's'} checked</h1>
          <p className="muted small" style={{ marginTop: 6 }}>{batch.fileName}</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-line btn-sm" onClick={() => exportCsv(batch.fileName, reports)}><Download width={16} height={16} /> Export CSV</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setBatch(null); buffer.current = null; setError(null); }}>Check another file</button>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Filter by status">
        {([['blocked', 'Blocked', 'tone-blocked'], ['review', 'Needs review', 'tone-review'], ['clear', 'Clear to ship', 'tone-clear']] as const).map(([k, label, tone]) => (
          <button key={k} type="button" className="stat" aria-pressed={filter === k} onClick={() => setFilter(filter === k ? null : k)}>
            <span className={`n num ${tone}`}>{tally[k]}</span>
            <span className="t">{label}</span>
          </button>
        ))}
      </div>

      {batch.warnings.length > 0 && (
        <div className="callout amber" style={{ marginTop: 16 }}>
          <b className="strong">{batch.warnings.length} thing{batch.warnings.length === 1 ? '' : 's'} to know about the file</b>
          <ul>{batch.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </div>
      )}

      <div className="row row-between" style={{ margin: '20px 0 10px' }}>
        <span className="small muted">{filter ? `Showing ${shown.length} of ${reports.length}` : 'All bookings'}</span>
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={worstFirst} onChange={e => setWorstFirst(e.target.checked)} />
          <span>Worst first</span>
        </label>
      </div>

      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr><th>Booking</th><th>Seller</th><th>Route</th><th>Status</th><th className="c">Blocking</th><th className="c">Review</th><th>Carrier</th><th><span className="sr-only">Save</span></th></tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const c = counts(r);
              const rec = r.recommendation?.recommended;
              return (
                <tr key={r.booking.bookingId}>
                  <td><a className="rowlink" href={hrefFor({ name: 'report', source: 'batch', id: r.booking.bookingId })}>{r.booking.bookingId}</a></td>
                  <td>{r.booking.sellerName || <span className="muted">No name</span>}</td>
                  <td>{r.booking.originCity} to {r.booking.destinationCity}</td>
                  <td><StatusChip status={r.status} /></td>
                  <td className={`c num ${c.blockers ? 'tone-blocked strong' : 'muted'}`}>{c.blockers}</td>
                  <td className={`c num ${c.reviews ? 'tone-review strong' : 'muted'}`}>{c.reviews}</td>
                  <td>{rec ? <><b className="strong">{rec.carrier}</b> <span className="muted small">{rec.service}, <span className="num">{formatCurrency(rec.totalCost)}</span></span></> : <span className="muted">None eligible</span>}</td>
                  <td className="r"><button type="button" className="btn btn-quiet btn-sm" onClick={() => markReady('upload', r)}>Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="callout red" style={{ marginTop: 16 }}>{error}</p>}
    </div>
  );
}
