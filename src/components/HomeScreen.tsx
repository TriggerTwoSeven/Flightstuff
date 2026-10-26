'use client';

import { useDesk } from '@/lib/desk';
import { EXAMPLES } from '@/lib/examples';
import { RULES } from '@/lib/rules-meta';
import { hrefFor, useRoute } from '@/lib/route';
import { ArrowRight } from './ui/Icons';

const GROUPS = ['Customs paperwork', 'Load and carrier', 'Delivery'] as const;

export function HomeScreen() {
  const { send } = useDesk();
  const { go } = useRoute();

  const tryExample = (text: string) => {
    go({ name: 'describe' });
    void send(text, { fresh: true });
  };

  return (
    <div className="page wrap">
      <section className="hero-grid enter">
        <div className="stack" style={{ ['--gap' as string]: '20px' }}>
          <p className="label">Pre-flight check for UK to EU freight</p>
          <h1 className="display">Know it is ready before it ships.</h1>
          <p className="lede">
            Tell us about a shipment in your own words, or upload your booking sheet. ReadyRoute checks ten customs and carrier rules,
            says what is wrong in plain English, fixes it in one tap and picks the right carrier.
          </p>
        </div>
        <ul className="rule-list" style={{ margin: 0 }} aria-label="What you get">
          <li><span className="rule-id tone-clear">01</span><span><b className="strong">Ten checks</b> that stop customs holds, overweight pallets and banned goods.</span></li>
          <li><span className="rule-id tone-clear">02</span><span><b className="strong">One question at a time</b>, with quick answers you can tap.</span></li>
          <li><span className="rule-id tone-clear">03</span><span><b className="strong">Carrier pick</b> by price, speed or reliability, with the reason.</span></li>
        </ul>
      </section>

      <section className="entry enter-2" style={{ marginTop: 36 }} aria-label="Start a check">
        <a className="entry-card primary" href={hrefFor({ name: 'describe' })}>
          <h2 className="title">Describe a shipment</h2>
          <p className="muted">Type it like a message to a colleague. We pull out the details and ask only for what is missing.</p>
          <span className="go">Start chatting <ArrowRight className="arrow" width={18} height={18} /></span>
        </a>
        <a className="entry-card" href={hrefFor({ name: 'upload' })}>
          <h2 className="title">Upload a booking sheet</h2>
          <p className="muted">Check a whole spreadsheet at once. No file handy? Run the practice file in one click.</p>
          <span className="go">Check a file <ArrowRight className="arrow" width={18} height={18} /></span>
        </a>
      </section>

      <section style={{ marginTop: 48 }} className="enter-3" aria-labelledby="try-h">
        <div className="row row-between" style={{ marginBottom: 12 }}>
          <h2 id="try-h" className="heading">Or try a sample shipment</h2>
          <span className="xs muted">One tap runs the whole check</span>
        </div>
        <div className="example-grid">
          {EXAMPLES.map(e => (
            <button key={e.id} type="button" className="example" onClick={() => tryExample(e.text)}>
              <span className="t">{e.title}</span>
              <span className="small muted">{e.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 56 }} aria-labelledby="rules-h">
        <div className="row row-between">
          <h2 id="rules-h" className="heading">What gets checked</h2>
          <a className="btn btn-quiet btn-sm" href={hrefFor({ name: 'rules' })}>Read the full rulebook</a>
        </div>
        <div className="rule-cols" style={{ marginTop: 8 }}>
          {GROUPS.map(g => (
            <div key={g}>
              <p className="label">{g}</p>
              <ul className="rule-list">
                {RULES.filter(r => r.group === g).map(r => (
                  <li key={r.id}>
                    <span className={`rule-id ${r.severity === 'Red' ? 'tone-blocked' : 'tone-review'}`}>{r.id}</span>
                    <span>{r.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="xs muted" style={{ marginTop: 12 }}>Red rules block a booking. Amber rules need a look before it goes.</p>
      </section>
    </div>
  );
}
