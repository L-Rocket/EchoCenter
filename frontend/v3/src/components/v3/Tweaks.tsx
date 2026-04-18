import { useContext, useEffect, useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { ThemeProviderContext, type Theme } from '@/context/ThemeProvider';

type Accent = 'violet' | 'cyan' | 'lime' | 'orange';
type Density = 'cozy' | 'compact';

const ACCENT_KEY = 'ec-v3-accent';
const DENSITY_KEY = 'ec-v3-density';
const MOTION_KEY = 'ec-v3-motion';

function applyAccent(a: Accent) {
  const root = document.documentElement;
  (['accent-violet', 'accent-cyan', 'accent-lime', 'accent-orange'] as const).forEach((c) =>
    root.classList.remove(c)
  );
  root.classList.add(`accent-${a}`);
}
function applyDensity(d: Density) {
  const root = document.documentElement;
  root.classList.toggle('density-compact', d === 'compact');
}
function applyMotion(m: boolean) {
  const root = document.documentElement;
  root.classList.toggle('no-motion', !m);
}

export function Tweaks() {
  const { theme, setTheme } = useContext(ThemeProviderContext);
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<Accent>(
    () => (localStorage.getItem(ACCENT_KEY) as Accent) || 'violet'
  );
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem(DENSITY_KEY) as Density) || 'cozy'
  );
  const [motion, setMotion] = useState<boolean>(
    () => localStorage.getItem(MOTION_KEY) !== 'off'
  );

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);
  useEffect(() => {
    applyDensity(density);
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);
  useEffect(() => {
    applyMotion(motion);
    localStorage.setItem(MOTION_KEY, motion ? 'on' : 'off');
  }, [motion]);

  if (!open) {
    return (
      <button
        className="v3-card"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          color: 'var(--fg-muted)',
          zIndex: 50,
          cursor: 'pointer',
          border: '1px solid var(--border-base)',
          background: 'var(--bg-card)',
        }}
        title="Theme tweaks"
      >
        <SlidersHorizontal size={15} />
      </button>
    );
  }

  const themes: Theme[] = ['dark', 'light', 'system'];
  const accents: Accent[] = ['violet', 'cyan', 'lime', 'orange'];
  const densities: Density[] = ['cozy', 'compact'];

  return (
    <div
      className="v3-card"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 300,
        zIndex: 50,
        overflow: 'hidden',
        boxShadow: '0 28px 64px -32px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span className="eyebrow">Tweaks</span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border: 0,
            color: 'var(--fg-dim)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <X size={13} />
        </button>
      </div>
      <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TweakRow label="Theme">
          <TweakOpts
            options={themes}
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
          />
        </TweakRow>
        <TweakRow label="Accent">
          <div style={{ display: 'flex', gap: 8 }}>
            {accents.map((a) => (
              <button
                key={a}
                onClick={() => setAccent(a)}
                aria-label={a}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: accent === a ? '2px solid var(--accent-hue)' : '2px solid transparent',
                  boxShadow: '0 0 0 1px var(--border-faint)',
                  background:
                    a === 'violet' ? 'oklch(0.72 0.18 295)' :
                    a === 'cyan'   ? 'oklch(0.78 0.14 200)' :
                    a === 'lime'   ? 'oklch(0.84 0.17 135)' :
                                     'oklch(0.76 0.17 55)',
                  cursor: 'pointer',
                  transform: accent === a ? 'scale(1.08)' : 'none',
                  transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              />
            ))}
          </div>
        </TweakRow>
        <TweakRow label="Density">
          <TweakOpts options={densities} value={density} onChange={(v) => setDensity(v as Density)} />
        </TweakRow>
        <TweakRow label="Motion">
          <button
            onClick={() => setMotion((m) => !m)}
            style={{
              width: 36,
              height: 20,
              background: motion ? 'var(--accent-hue)' : 'var(--bg-sunken)',
              border: motion ? '1px solid transparent' : '1px solid var(--border-faint)',
              borderRadius: 999,
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: motion ? 'var(--accent-ink)' : 'var(--fg-muted)',
                transform: motion ? 'translateX(16px)' : 'none',
                transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            />
          </button>
        </TweakRow>
      </div>
    </div>
  );
}

function TweakRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function TweakOpts<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 8px',
              borderRadius: 6,
              background: active ? 'var(--accent-soft)' : 'var(--bg-sunken)',
              border: active ? '1px solid transparent' : '1px solid var(--border-faint)',
              color: active ? 'var(--accent-hue)' : 'var(--fg-muted)',
              cursor: 'pointer',
              transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
