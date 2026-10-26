'use client';

import { RULES } from '@/lib/rules-meta';

export function RulesView() {
  return (
    <div className="page wrap">
      <h1 className="title">The rulebook</h1>
      <p className="lede" style={{ marginTop: 10 }}>
        Ten fixed checks, the same every time. No guessing: every threshold below is exactly what the engine uses.
        Red rules block a booking. Amber rules ask for a decision.
      </p>
      <div className="panel table-wrap" style={{ marginTop: 28 }}>
        <table className="table">
          <thead>
            <tr><th>Rule</th><th>Level</th><th>What is checked</th><th>Threshold</th><th>Why it matters</th></tr>
          </thead>
          <tbody>
            {RULES.map(r => (
              <tr key={r.id} style={{ verticalAlign: 'top' }}>
                <td style={{ minWidth: 170 }}>
                  <span className={`rule-id ${r.severity === 'Red' ? 'tone-blocked' : 'tone-review'}`}>{r.id}</span>{' '}
                  <b className="strong">{r.name}</b>
                  <div className="xs muted">{r.group}</div>
                </td>
                <td><span className={`chip ${r.severity === 'Red' ? 'chip-blocked' : 'chip-review'}`}>{r.severity === 'Red' ? 'Blocks' : 'Review'}</span></td>
                <td style={{ minWidth: 220 }}>{r.check}</td>
                <td style={{ minWidth: 220 }}>{r.threshold}</td>
                <td style={{ minWidth: 220 }} className="muted">{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
