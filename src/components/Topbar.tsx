'use client';

import { hrefFor, type Route } from '@/lib/route';
import { useDesk } from '@/lib/desk';
import { ThemeToggle } from './ui/ThemeToggle';

const LINKS: { label: string; route: Route; match: Route['name'][] }[] = [
  { label: 'Describe', route: { name: 'describe' }, match: ['describe'] },
  { label: 'Upload', route: { name: 'upload' }, match: ['upload'] },
  { label: 'History', route: { name: 'history' }, match: ['history'] },
  { label: 'Rulebook', route: { name: 'rules' }, match: ['rules'] },
];

export function Topbar({ route }: { route: Route }) {
  const { history } = useDesk();
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <a className="wordmark" href={hrefFor({ name: 'home' })} aria-label="ReadyRoute home">Ready<i>Route</i></a>
        <nav className="nav" aria-label="Main">
          {LINKS.map(l => (
            <a key={l.label} href={hrefFor(l.route)} aria-current={l.match.includes(route.name) || (l.route.name === 'describe' && route.name === 'report' && route.source === 'chat') || (l.route.name === 'upload' && route.name === 'report' && route.source === 'batch') || (l.route.name === 'history' && route.name === 'report' && route.source === 'saved') ? 'page' : undefined}>
              {l.label}{l.label === 'History' && history.length > 0 && <span className="hide-narrow"> ({history.length})</span>}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        <ThemeToggle />
      </div>
    </header>
  );
}
