import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setV(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const n = Math.round(v);
  return <>{n.toLocaleString()}</>;
}

interface StatCardProps {
  label: string;
  value: number;
  unit?: string | null;
  delta?: string | null;
  trend?: 'up' | 'down' | 'flat';
  placeholder?: boolean;
  extra?: ReactNode;
}

export function StatCard({ label, value, unit, delta, trend = 'up', placeholder = false, extra }: StatCardProps) {
  const deltaColor = trend === 'down' ? 'var(--red)' : trend === 'flat' ? 'var(--fg-dim)' : 'var(--green)';
  return (
    <div className="v3-card hoverable v3-stat-card">
      <div className="eyebrow">{label}</div>
      <div
        className="tnum"
        style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}
      >
        {placeholder ? <span style={{ color: 'var(--fg-dim)' }}>—</span> : <AnimatedNumber value={value} />}
        {unit ? <span style={{ fontSize: 14, color: 'var(--fg-dim)', fontWeight: 400 }}>{unit}</span> : null}
      </div>
      {delta ? (
        <div
          className="v3-mono"
          style={{ fontSize: 11, color: deltaColor, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {delta}
        </div>
      ) : null}
      {extra}
    </div>
  );
}
