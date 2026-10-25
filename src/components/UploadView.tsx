'use client';

import { useState, useRef, useCallback } from 'react';
import { parseWorkbook } from '@/lib/parser';
import { evaluateBatch } from '@/lib/evaluate';
import type { BookingReport, DataIssue } from '@/lib/schemas';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  onBack: () => void;
  reports: BookingReport[];
  onReportsChange: (reports: BookingReport[]) => void;
  onViewBooking: (report: BookingReport) => void;
}

type Stage = 'upload' | 'preview' | 'results';

export function UploadView({ onBack, reports, onReportsChange, onViewBooking }: Props) {
  const [stage, setStage] = useState<Stage>(reports.length > 0 ? 'results' : 'upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<{
    sheetsFound: string[];
    bookingCount: number;
    itemCount: number;
    headerInfo: string;
    sampleRowDetected: boolean;
    includeSample: boolean;
    dataIssues: DataIssue[];
  } | null>(null);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('bookingId');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      setRawBuffer(buffer);
      const result = parseWorkbook(buffer, false);

      setPreviewInfo({
        sheetsFound: result.sheetsFound,
        bookingCount: result.bookings.length,
        itemCount: result.items.length,
        headerInfo: result.bookingSheetInfo
          ? `Headers on row ${result.bookingSheetInfo.headerRow + 1}`
          : 'Header row not detected',
        sampleRowDetected: result.bookingSheetInfo?.sampleRow != null || result.itemSheetInfo?.sampleRow != null,
        includeSample: false,
        dataIssues: result.dataIssues,
      });
      setProcessing(false);
      setStage('preview');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const runChecks = useCallback(() => {
    if (!rawBuffer) return;
    setProcessing(true);
    setTimeout(() => {
      const result = parseWorkbook(rawBuffer, previewInfo?.includeSample ?? false);
      const batchReports = evaluateBatch(result.bookings, result.items, result.dataIssues);
      onReportsChange(batchReports);
      setProcessing(false);
      setStage('results');
    }, 300);
  }, [rawBuffer, previewInfo, onReportsChange]);

  const handleExportCSV = () => {
    if (reports.length === 0) return;
    const rows = [['Booking ID', 'Rule', 'Severity', 'Status', 'Item', 'Evidence', 'Fix']];
    for (const r of reports) {
      for (const f of r.findings) {
        if (f.status === 'pass') continue;
        rows.push([
          r.booking.bookingId,
          `${f.ruleId} ${f.ruleName}`,
          f.severity,
          f.status,
          f.affectedItem ? `${f.affectedItem.sku} ${f.affectedItem.description}` : '',
          f.evidence,
          f.fix,
        ]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preflight-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSample = async () => {
    const { generateSampleWorkbook } = await import('@/lib/sample-data');
    generateSampleWorkbook();
  };

  const filtered = filter === 'all' ? reports
    : reports.filter(r => r.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'status') {
      const order = { blocked: 0, review: 1, clear: 2 };
      return order[a.status] - order[b.status];
    }
    return a.booking.bookingId.localeCompare(b.booking.bookingId);
  });

  const blockedCount = reports.filter(r => r.status === 'blocked').length;
  const reviewCount = reports.filter(r => r.status === 'review').length;
  const clearCount = reports.filter(r => r.status === 'clear').length;

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="btn btn-ghost text-sm mb-4 -ml-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back
      </button>

      {/* Upload stage */}
      {stage === 'upload' && (
        <div className="max-w-xl mx-auto animate-fade-in">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Upload bookings to check</h2>
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Upload an Excel file with Bookings and Items sheets.
            </p>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`drag-area p-14 text-center ${dragOver ? 'drag-area-active' : ''}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            {processing ? (
              <div className="animate-fade-in">
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin-slow 1s linear infinite' }} />
                <p className="font-medium" style={{ color: 'var(--fg-muted)' }}>Parsing file...</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-muted)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                </div>
                <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Drop your file here or click to browse</p>
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  .xlsx with Bookings and Items sheets
                </p>
              </>
            )}
          </div>

          <div className="mt-5 text-center">
            <button onClick={handleDownloadSample} className="btn btn-ghost text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              Download sample workbook with planted errors
            </button>
          </div>
        </div>
      )}

      {/* Preview stage */}
      {stage === 'preview' && previewInfo && (
        <div className="max-w-2xl mx-auto animate-fade-in">
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Import Preview</h2>
          <p className="text-sm mb-5 flex items-center gap-2" style={{ color: 'var(--fg-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
            {fileName}
          </p>

          <div className="card p-5 mb-5">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-muted)' }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Sheets</div>
                <div className="font-semibold" style={{ color: 'var(--fg)' }}>{previewInfo.sheetsFound.join(', ')}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-muted)' }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Headers</div>
                <div className="font-semibold" style={{ color: 'var(--fg)' }}>{previewInfo.headerInfo}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-muted)' }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Bookings</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{previewInfo.bookingCount}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-muted)' }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Items</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{previewInfo.itemCount}</div>
              </div>
            </div>

            {previewInfo.sampleRowDetected && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-3" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--amber)' }}>
                  Sample/example row detected
                </span>
                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium" style={{ color: 'var(--amber)' }}>
                  <input
                    type="checkbox"
                    checked={previewInfo.includeSample}
                    onChange={e => setPreviewInfo({ ...previewInfo, includeSample: e.target.checked })}
                    className="rounded"
                  />
                  Include
                </label>
              </div>
            )}

            {previewInfo.dataIssues.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-border)' }}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--amber)' }}>
                  Data warnings ({previewInfo.dataIssues.length})
                </h4>
                <ul className="space-y-1.5">
                  {previewInfo.dataIssues.map((issue, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--amber)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                      </svg>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={runChecks} className="btn btn-primary" disabled={processing}>
              {processing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent" style={{ animation: 'spin-slow 1s linear infinite' }} />
                  Running...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Run pre-flight checks
                </>
              )}
            </button>
            <button
              onClick={() => { setStage('upload'); setPreviewInfo(null); }}
              className="btn btn-secondary"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}

      {/* Results stage */}
      {stage === 'results' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Batch Results</h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                {reports.length} booking{reports.length !== 1 ? 's' : ''} checked
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="btn btn-secondary text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                </svg>
                Export CSV
              </button>
              <button onClick={() => { setStage('upload'); onReportsChange([]); }} className="btn btn-secondary text-sm">
                New upload
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <button
              onClick={() => setFilter(filter === 'blocked' ? 'all' : 'blocked')}
              className={`card p-4 text-center active-press ${filter === 'blocked' ? 'animate-glow' : ''}`}
              style={{ background: 'var(--red-light)', borderColor: filter === 'blocked' ? 'var(--red)' : 'var(--red-border)' }}
            >
              <div className="text-3xl font-extrabold animate-count" style={{ color: 'var(--red)' }}>{blockedCount}</div>
              <div className="text-xs font-semibold mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--red)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                Blocked
              </div>
            </button>
            <button
              onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
              className={`card p-4 text-center active-press ${filter === 'review' ? 'animate-glow' : ''}`}
              style={{ background: 'var(--amber-light)', borderColor: filter === 'review' ? 'var(--amber)' : 'var(--amber-border)' }}
            >
              <div className="text-3xl font-extrabold animate-count delay-100" style={{ color: 'var(--amber)' }}>{reviewCount}</div>
              <div className="text-xs font-semibold mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--amber)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                </svg>
                Review
              </div>
            </button>
            <button
              onClick={() => setFilter(filter === 'clear' ? 'all' : 'clear')}
              className={`card p-4 text-center active-press ${filter === 'clear' ? 'animate-glow' : ''}`}
              style={{ background: 'var(--green-light)', borderColor: filter === 'clear' ? 'var(--green)' : 'var(--green-border)' }}
            >
              <div className="text-3xl font-extrabold animate-count delay-200" style={{ color: 'var(--green)' }}>{clearCount}</div>
              <div className="text-xs font-semibold mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--green)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Clear
              </div>
            </button>
          </div>

          {/* Filter + sort bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="tab-group">
              {['all', 'blocked', 'review', 'clear'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`tab ${filter === f ? 'tab-active' : ''}`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setSortField(sortField === 'status' ? 'bookingId' : 'status')}
              className="btn btn-ghost text-xs"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
              </svg>
              Sort: {sortField === 'status' ? 'Status' : 'Booking ID'}
            </button>
          </div>

          {/* Results table */}
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Booking</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--fg-subtle)' }}>Seller</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--fg-subtle)' }}>Route</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Status</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--red)' }}>Red</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--amber)' }}>Amber</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--fg-subtle)' }}>Carrier</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const reds = r.findings.filter(f => f.severity === 'Red' && f.status === 'fail').length;
                  const ambers = r.findings.filter(f => f.severity === 'Amber' && f.status === 'fail').length;
                  return (
                    <tr
                      key={r.booking.bookingId}
                      className="table-row border-t cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => onViewBooking(r)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-sm" style={{ color: 'var(--accent)' }}>{r.booking.bookingId}</td>
                      <td className="py-3 px-4 hidden sm:table-cell">{r.booking.sellerName}</td>
                      <td className="py-3 px-4 hidden md:table-cell text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {r.booking.originCity} <span style={{ color: 'var(--fg-subtle)' }}>→</span> {r.booking.destinationCity}
                      </td>
                      <td className="py-3 px-4 text-center"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-4 text-center font-mono font-bold" style={{ color: reds > 0 ? 'var(--red)' : 'var(--fg-subtle)' }}>{reds}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold" style={{ color: ambers > 0 ? 'var(--amber)' : 'var(--fg-subtle)' }}>{ambers}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {r.recommendation?.recommended
                          ? `${r.recommendation.recommended.carrier} ${r.recommendation.recommended.service}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center" style={{ color: 'var(--fg-muted)' }}>
                      <p className="text-sm">No bookings match the current filter.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
