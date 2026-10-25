'use client';

const RULES = [
  { id: 'R-01', label: 'HS Code Format', severity: 'Red', description: 'Every item must have a valid 6-digit HS code. Missing or malformed codes block the shipment.' },
  { id: 'R-02', label: 'Declared Value', severity: 'Red', description: 'Sum of (quantity x unit price) per item must equal the booking\'s total declared value within ±£1.' },
  { id: 'R-03', label: 'Quantity vs Cartons', severity: 'Red', description: 'quantity must equal cartons x per_carton for every line item.' },
  { id: 'R-04', label: 'Carton Totals', severity: 'Red', description: 'Sum of item-level cartons must equal the booking-level carton count.' },
  { id: 'R-05', label: 'Pallet Weight', severity: 'Red', description: 'Gross weight / pallets must not exceed the carrier\'s max kg per pallet (default 750 kg).' },
  { id: 'R-06', label: 'Prohibited Goods', severity: 'Red', description: 'Item descriptions are screened against a prohibited-terms list (e.g. "lithium battery", "firearm").' },
  { id: 'R-07', label: 'Gross vs Item Weight', severity: 'Red', description: 'Total gross weight must be ≥ sum of (quantity x weight_per_unit) across all items.' },
  { id: 'R-08', label: 'Appointment Booked', severity: 'Amber', description: 'Delivery appointment should be confirmed. Missing appointment triggers a warning.' },
  { id: 'R-09', label: 'Country of Origin', severity: 'Amber', description: 'Every item should declare a country of origin for customs.' },
  { id: 'R-10', label: 'Ship Date', severity: 'Amber', description: 'Ready-to-ship date must be in the future. Past dates trigger a warning.' },
];

interface Props {
  onBack: () => void;
}

export function RulesView({ onBack }: Props) {
  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Pre-Flight Rules</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-subtle)' }}>
            10 validation rules checked on every booking
          </p>
        </div>
        <button onClick={onBack} className="btn btn-secondary text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {RULES.map((rule) => (
          <div
            key={rule.id}
            className="card p-5 border-l-4 hover-lift"
            style={{
              borderLeftColor: rule.severity === 'Red' ? 'var(--status-blocked)' : 'var(--status-review)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold"
                style={{
                  background: rule.severity === 'Red' ? 'var(--status-blocked-bg)' : 'var(--status-review-bg)',
                  color: rule.severity === 'Red' ? 'var(--status-blocked)' : 'var(--status-review)',
                }}
              >
                {rule.id}
              </span>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{rule.label}</h3>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: rule.severity === 'Red' ? 'var(--status-blocked-bg)' : 'var(--status-review-bg)',
                    color: rule.severity === 'Red' ? 'var(--status-blocked)' : 'var(--status-review)',
                  }}
                >
                  {rule.severity === 'Red' ? 'Blocker' : 'Warning'}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>
              {rule.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
