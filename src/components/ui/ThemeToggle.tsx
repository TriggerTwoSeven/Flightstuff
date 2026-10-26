'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from './Icons';

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  window.addEventListener('theme-change', cb);
  return () => { mq.removeEventListener('change', cb); window.removeEventListener('theme-change', cb); };
};
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* blocked storage: the choice just lasts this visit */ }
    window.dispatchEvent(new Event('theme-change'));
  };
  return (
    <button type="button" className="btn btn-quiet btn-sm" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} suppressHydrationWarning>
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
