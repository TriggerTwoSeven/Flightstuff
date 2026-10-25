'use client';

import { RATE_CARD } from '@/lib/constants';

interface Props {
  onStartConversation: () => void;
  onStartUpload: () => void;
}

const SAMPLE_CONVERSATION = `I run Northfield Goods. Need to send ceramic mugs from Manchester to a warehouse in Frankfurt. Three pallets ready 05-11-2026. Each mug is £5 and we have 1,080 units, 12 per carton. Each mug weighs 0.5 kg. Total gross weight is 620 kg. HS code 691200. Made in the UK. Priority is cheapest. Appointment is booked.`;

const RULES = [
  { id: 'R-01', label: 'HS code format', severity: 'red' },
  { id: 'R-02', label: 'Declared value', severity: 'red' },
  { id: 'R-03', label: 'Quantity math', severity: 'red' },
  { id: 'R-04', label: 'Carton totals', severity: 'red' },
  { id: 'R-05', label: 'Pallet weight', severity: 'red' },
  { id: 'R-06', label: 'Prohibited goods', severity: 'red' },
  { id: 'R-07', label: 'Gross weight', severity: 'amber' },
  { id: 'R-08', label: 'Appointment', severity: 'amber' },
  { id: 'R-09', label: 'Country of origin', severity: 'amber' },
  { id: 'R-10', label: 'Ship date', severity: 'amber' },
];

export function HomeScreen({ onStartConversation, onStartUpload }: Props) {
  const handleDownloadSample = async () => {
    const { generateSampleWorkbook } = await import('@/lib/sample-data');
    generateSampleWorkbook();
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mt-8 mb-12 animate-fade-in">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 animate-fade-in-scale"
          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-ring" style={{ background: 'var(--green)' }} />
          10 validation rules active
        </div>
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 animate-fade-in delay-100"
          style={{ color: 'var(--fg)', lineHeight: 1.1 }}
        >
          Shipment <span className="gradient-text">Pre-Flight</span> Checks
        </h1>
        <p className="text-lg max-w-2xl mx-auto animate-fade-in delay-200" style={{ color: 'var(--fg-muted)', lineHeight: 1.6 }}>
          Catch booking mistakes before your goods leave the warehouse.
          Reconcile the numbers, check the carrier, know exactly what to fix.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-5 mb-10">
        <button
          onClick={onStartConversation}
          className="card card-interactive group text-left p-0 overflow-hidden animate-fade-in delay-200 active-press"
        >
          <div className="p-6 pb-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'var(--gradient-accent)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Describe a shipment</h2>
                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Conversational booking</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              Tell us about your shipment in plain language. We&apos;ll extract the details,
              ask only what&apos;s missing, and run all pre-flight checks live.
            </p>
          </div>
          <div
            className="px-6 py-3 flex items-center justify-between border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--gradient-card)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Start typing
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </button>

        <button
          onClick={onStartUpload}
          className="card card-interactive group text-left p-0 overflow-hidden animate-fade-in delay-300 active-press"
        >
          <div className="p-6 pb-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Upload bookings</h2>
                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Batch Excel check</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              Upload an Excel file with Bookings and Items sheets. We&apos;ll validate
              every booking against all 10 rules and recommend carriers.
            </p>
          </div>
          <div
            className="px-6 py-3 flex items-center justify-between border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--gradient-card)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--green)' }}>
              Upload .xlsx
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10 animate-fade-in delay-400">
        <button
          onClick={() => {
            onStartConversation();
            setTimeout(() => {
              const textarea = document.querySelector('textarea');
              if (textarea) {
                textarea.value = SAMPLE_CONVERSATION;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }, 100);
          }}
          className="btn btn-secondary text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Try sample conversation
        </button>
        <button
          onClick={handleDownloadSample}
          className="btn btn-secondary text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
          Download sample workbook
        </button>
      </div>

      {/* Rules overview */}
      <div className="card p-6 mb-8 animate-fade-in delay-400">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--fg-muted)' }}>
          10 Pre-Flight Rules
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {RULES.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
              style={{
                background: rule.severity === 'red' ? 'var(--red-light)' : 'var(--amber-light)',
                color: rule.severity === 'red' ? 'var(--red)' : 'var(--amber)',
              }}
            >
              <span className="font-bold">{rule.id}</span>
              <span className="truncate">{rule.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rate card */}
      <div className="card overflow-hidden animate-fade-in delay-500">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>
              Rate Card
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
              UK to Europe &middot; GBP per pallet &middot; Fixed test data
            </p>
          </div>
          <div className="badge badge-blue">
            {RATE_CARD.length} routes
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Carrier</th>
                <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Service</th>
                <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Destination</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Price</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Transit</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>On-time</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Max kg</th>
              </tr>
            </thead>
            <tbody>
              {RATE_CARD.map((r, i) => (
                <tr key={i} className="table-row border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2.5 px-4 font-medium">{r.carrier}</td>
                  <td className="py-2.5 px-4" style={{ color: 'var(--fg-muted)' }}>{r.service}</td>
                  <td className="py-2.5 px-4">{r.destinationCountry}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                    £{r.pricePerPallet}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className="badge badge-blue">{r.transitDays}d</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span style={{ color: r.onTimePercent >= 95 ? 'var(--green)' : 'var(--amber)' }}>
                      {r.onTimePercent}%
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{r.maxKgPerPallet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 mb-4 animate-fade-in delay-500">
        <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          Preflight Desk &middot; Hackathon MVP &middot; Session-scoped, no database
        </p>
      </div>
    </div>
  );
}
