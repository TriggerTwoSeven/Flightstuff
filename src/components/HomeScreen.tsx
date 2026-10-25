'use client';

import { useEffect, useRef, useState } from 'react';
import { RATE_CARD } from '@/lib/constants';

interface Props {
  onStartConversation: () => void;
  onStartUpload: () => void;
}

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

const STATS = [
  { label: 'Rules Active', value: '10', suffix: '' },
  { label: 'Carriers', value: '3', suffix: '' },
  { label: 'Routes', value: '9', suffix: '' },
  { label: 'Uptime', value: '99.9', suffix: '%' },
];

function AnimatedGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let cols: number[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
      const colCount = Math.floor(canvas.offsetWidth / 20);
      cols = Array.from({ length: colCount }, () => Math.random() * canvas.offsetHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    const chars = '01アイウエオカキクケコサシスセソ';

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      ctx.font = '12px monospace';

      for (let i = 0; i < cols.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 20;
        const y = cols[i];

        const brightness = Math.random();
        if (brightness > 0.95) {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
        } else if (brightness > 0.8) {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        } else {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
        }

        ctx.fillText(char, x, y);

        if (y > canvas.offsetHeight && Math.random() > 0.98) {
          cols[i] = 0;
        }
        cols[i] += 14;
      }
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.4 }}
    />
  );
}

function FloatingOrb({ delay, size, x, y }: { delay: number; size: number; x: string; y: string }) {
  return (
    <div
      className="absolute rounded-full hero-orb"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
        animationDelay: `${delay}s`,
        filter: 'blur(40px)',
      }}
    />
  );
}

function DashboardPreview() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 800);
    return () => clearTimeout(t);
  }, []);

  const bars = [65, 45, 78, 52, 88, 40, 72, 58, 82, 48, 90, 55];

  return (
    <div
      className={`hero-dashboard ${animate ? 'hero-dashboard-visible' : ''}`}
      style={{
        background: 'rgba(15, 15, 25, 0.85)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      <div className="flex" style={{ minHeight: 280 }}>
        {/* Sidebar */}
        <div
          className="hidden sm:flex flex-col gap-1 p-3 border-r"
          style={{ borderColor: 'rgba(255,255,255,0.06)', width: 160 }}
        >
          <div className="text-xs font-bold mb-2 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>NAVIGATION</div>
          {['Dashboard', 'Bookings', 'Carriers', 'Analytics', 'Settings'].map((item, i) => (
            <div
              key={item}
              className="px-2 py-1.5 rounded-md text-xs flex items-center gap-2"
              style={{
                background: i === 0 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: i === 0 ? 'rgba(99, 102, 241, 1)' : 'rgba(255,255,255,0.4)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? 'rgb(99, 102, 241)' : 'rgba(255,255,255,0.15)' }} />
              {item}
            </div>
          ))}
          <div className="mt-auto px-2">
            <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>AI Credits</div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full hero-bar-fill" style={{ width: '72%', background: 'linear-gradient(90deg, rgb(99,102,241), rgb(168,85,247))' }} />
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>72/100 used</div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 p-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Total Bookings', value: '1,247', change: '+12%', up: true },
              { label: 'Checked Today', value: '38', change: '+5', up: true },
              { label: 'Pass Rate', value: '94.2%', change: '+2.1%', up: true },
              { label: 'Avg. Value', value: '£8.4k', change: '-0.3%', up: false },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="p-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>{stat.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: stat.up ? '#10b981' : '#ef4444' }}>{stat.change}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Bookings Volume</div>
              <div className="flex gap-1">
                {['1W', '1M', '3M'].map((p, i) => (
                  <span key={p} className="px-2 py-0.5 rounded text-[10px]" style={{
                    background: i === 1 ? 'rgba(99,102,241,0.2)' : 'transparent',
                    color: i === 1 ? 'rgb(99,102,241)' : 'rgba(255,255,255,0.3)',
                  }}>{p}</span>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm hero-bar"
                  style={{
                    height: animate ? `${h}%` : '0%',
                    background: h > 75 ? 'linear-gradient(to top, rgb(99,102,241), rgb(129,140,248))' : 'rgba(99,102,241,0.3)',
                    transitionDelay: `${0.8 + i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="grid grid-cols-5 text-[10px] py-1.5 px-3" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)' }}>
              <span>ID</span><span>Seller</span><span>Destination</span><span>Status</span><span className="text-right">Value</span>
            </div>
            {[
              { id: 'BK-7291', seller: 'Northfield', dest: 'Frankfurt', status: 'clear', value: '£5,400' },
              { id: 'BK-7292', seller: 'TradeFlow', dest: 'Rotterdam', status: 'review', value: '£12,800' },
              { id: 'BK-7293', seller: 'GreenLeaf', dest: 'Paris', status: 'blocked', value: '£3,200' },
            ].map((row) => (
              <div key={row.id} className="grid grid-cols-5 text-[10px] py-1.5 px-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="font-mono" style={{ color: 'rgb(99,102,241)' }}>{row.id}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{row.seller}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{row.dest}</span>
                <span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{
                    background: row.status === 'clear' ? 'rgba(16,185,129,0.15)' : row.status === 'review' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                    color: row.status === 'clear' ? '#10b981' : row.status === 'review' ? '#f59e0b' : '#ef4444',
                  }}>{row.status}</span>
                </span>
                <span className="text-right font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeScreen({ onStartConversation, onStartUpload }: Props) {
  return (
    <div className="home-immersive">
      {/* Full-bleed hero section */}
      <section className="hero-section" style={{ margin: '0 -16px' }}>
        <div className="hero-bg">
          <AnimatedGrid />
          <FloatingOrb delay={0} size={300} x="10%" y="20%" />
          <FloatingOrb delay={2} size={200} x="70%" y="10%" />
          <FloatingOrb delay={4} size={250} x="50%" y="60%" />
          <div className="hero-gradient-overlay" />
        </div>

        <div className="hero-content">
          {/* Title */}
          <h1 className="hero-title animate-fade-in delay-100">
            Validate, check, and
            <br />
            <span className="hero-title-gradient">ship with confidence.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle animate-fade-in delay-200">
            Catch booking mistakes before your goods leave the warehouse.
            AI-powered extraction, 10-rule validation, and carrier
            recommendations — all in one place.
          </p>

          {/* CTA buttons */}
          <div className="hero-ctas animate-fade-in delay-300">
            <button onClick={onStartConversation} className="hero-btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Start Booking
            </button>
            <button onClick={onStartUpload} className="hero-btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              Upload Excel
            </button>
          </div>

          {/* Stats counters */}
          <div className="hero-stats animate-fade-in delay-400">
            {STATS.map((stat, i) => (
              <div key={stat.label} className="hero-stat" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                <div className="hero-stat-value">
                  {stat.value}<span className="hero-stat-suffix">{stat.suffix}</span>
                </div>
                <div className="hero-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Dashboard preview */}
          <div className="hero-preview animate-fade-in delay-500">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Below hero content */}
      <div className="max-w-5xl mx-auto" style={{ padding: '0 16px' }}>
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
              <h3 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Rate Card</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                UK to Europe &middot; GBP per pallet &middot; Fixed test data
              </p>
            </div>
            <div className="badge badge-blue">{RATE_CARD.length} routes</div>
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
                    <td className="py-2.5 px-4 text-right font-mono font-semibold" style={{ color: 'var(--accent)' }}>£{r.pricePerPallet}</td>
                    <td className="py-2.5 px-4 text-right"><span className="badge badge-blue">{r.transitDays}d</span></td>
                    <td className="py-2.5 px-4 text-right">
                      <span style={{ color: r.onTimePercent >= 95 ? 'var(--green)' : 'var(--amber)' }}>{r.onTimePercent}%</span>
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
            ReadyRoute &middot; Powered by Gemini AI &middot; Neon PostgreSQL
          </p>
        </div>
      </div>
    </div>
  );
}
