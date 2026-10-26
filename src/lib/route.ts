'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'describe' }
  | { name: 'upload' }
  | { name: 'history' }
  | { name: 'rules' }
  | { name: 'report'; source: 'chat' | 'batch' | 'saved'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'describe': return { name: 'describe' };
    case 'upload': return { name: 'upload' };
    case 'history': return { name: 'history' };
    case 'rules': return { name: 'rules' };
    case 'report': {
      const source = parts[1] === 'batch' || parts[1] === 'saved' ? parts[1] : 'chat';
      return { name: 'report', source, id: parts.slice(2).join('/') };
    }
    default: return { name: 'home' };
  }
}

export function hrefFor(r: Route): string {
  switch (r.name) {
    case 'home': return '#/';
    case 'report': return `#/report/${r.source}${r.id ? `/${encodeURIComponent(r.id)}` : ''}`;
    default: return `#/${r.name}`;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getSnapshot = () => window.location.hash;
const getServerSnapshot = () => '';

export function useRoute(): { route: Route; go: (r: Route) => void } {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const go = useCallback((r: Route) => {
    window.location.hash = hrefFor(r);
    window.scrollTo({ top: 0 });
  }, []);
  return { route: parseHash(hash), go };
}
