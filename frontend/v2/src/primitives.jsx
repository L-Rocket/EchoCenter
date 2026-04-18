// Small shared primitives
function Pill({ kind, children, icon }) {
  return <span className={`pill ${kind || ''}`}>{icon ? <Icon name={icon} size={10} /> : null}{children}</span>;
}
function Btn({ variant = 'ghost', size, icon, children, onClick, disabled }) {
  const cls = `btn ${variant} ${size || ''}`.trim();
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </button>
  );
}
function AgentAvatar({ name, status, size = 32 }) {
  const letters = (name || '??').split(/[-\s]/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const hue = Array.from(name || 'x').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className="agent-ava" style={{ width: size, height: size, background: `linear-gradient(135deg, oklch(0.32 0.05 ${hue}), oklch(0.22 0.04 ${hue}))`, color: 'var(--fg)' }}>
      {letters}
      {status ? <span className={`status ${status === 'offline' ? 'off' : status === 'busy' ? 'busy' : ''}`} /> : null}
    </div>
  );
}

// AnimatedNumber — counts up on mount
function AnimatedNumber({ value, duration = 900 }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (now) => {
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

Object.assign(window, { Pill, Btn, AgentAvatar, AnimatedNumber });
