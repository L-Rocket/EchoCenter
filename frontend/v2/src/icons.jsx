// Minimal icon set drawn as inline SVGs. Size via style={{width,height}}.
const ICON_PATHS = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
  butler:    'M12 2a5 5 0 00-5 5v2a5 5 0 0010 0V7a5 5 0 00-5-5zm-7 18a7 7 0 0114 0v2H5v-2z',
  agents:    'M16 11a4 4 0 100-8 4 4 0 000 8zm-8 0a4 4 0 100-8 4 4 0 000 8zm0 2c-3.3 0-6 1.7-6 4v2h10v-2c0-.7.2-1.3.5-2H8zm8 0c-1.2 0-2.3.2-3.2.7 1.3 1 2.2 2.3 2.2 3.3v2H22v-2c0-2.3-3.3-4-6-4z',
  operator:  'M3 5h18v14H3V5zm0 3h18M6 14h6',
  monitor:   'M4 4h16v12H4V4zm0 14h16M8 21h8',
  operations:'M3 7h18M3 12h18M3 17h18',
  settings:  'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7.4-2.5l1.7-1a1 1 0 00.4-1.3l-1.7-2.9a1 1 0 00-1.3-.4l-1.7 1-.7-.3-.3-2a1 1 0 00-1-.8h-3.4a1 1 0 00-1 .8l-.3 2-.7.3-1.7-1a1 1 0 00-1.3.4L3.4 10.7a1 1 0 00.4 1.3l1.7 1a7.1 7.1 0 000 2L3.8 16a1 1 0 00-.4 1.3l1.7 2.9a1 1 0 001.3.4l1.7-1 .7.3.3 2a1 1 0 001 .8h3.4a1 1 0 001-.8l.3-2 .7-.3 1.7 1a1 1 0 001.3-.4l1.7-2.9a1 1 0 00-.4-1.3l-1.7-1a7.1 7.1 0 000-2z',
  search:    'M10 18a8 8 0 100-16 8 8 0 000 16zm12 4l-6-6',
  plus:      'M12 5v14M5 12h14',
  send:      'M3 11l18-8-8 18-2-8-8-2z',
  mic:       'M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zm7 9a7 7 0 01-14 0m7 7v4m-4 0h8',
  paperclip: 'M21 11l-8.6 8.6a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5L10.4 17.6a2 2 0 01-3-3L15 7',
  chevdown:  'M6 9l6 6 6-6',
  chevright: 'M9 6l6 6-6 6',
  chevleft:  'M15 6l-6 6 6 6',
  close:     'M18 6L6 18M6 6l12 12',
  bell:      'M12 2a7 7 0 00-7 7v4l-2 3h18l-2-3V9a7 7 0 00-7-7zm-3 16a3 3 0 006 0',
  check:     'M5 13l4 4L19 7',
  sparkle:   'M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
  shield:    'M12 2l8 4v6c0 5-4 9-8 10-4-1-8-5-8-10V6l8-4z',
  zap:       'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  activity:  'M22 12h-4l-3 9L9 3l-3 9H2',
  filter:    'M3 5h18l-7 9v5l-4 2v-7L3 5z',
  terminal:  'M4 4h16v16H4V4zm3 5l3 3-3 3M12 15h6',
  arrowright:'M5 12h14M13 5l7 7-7 7',
  copy:      'M9 3h10a2 2 0 012 2v10M5 7h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z',
  dots:      'M6 12h.01M12 12h.01M18 12h.01',
  moon:      'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  sun:       'M12 3v2m0 14v2M5 12H3m18 0h-2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M5.6 18.4l1.4-1.4m10-10l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z',
  logo:      'M4 12a8 8 0 1116 0',
  user:      'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0',
  trash:     'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6',
  refresh:   'M21 12a9 9 0 01-15 6.7L3 16m0-4a9 9 0 0115-6.7L21 8M3 22v-6h6M21 2v6h-6',
};

function Icon({ name, size = 16, stroke = 1.6, style }) {
  const d = ICON_PATHS[name] || '';
  const fillNames = ['dashboard']; // icons that should be filled instead of stroked
  const isFill = fillNames.includes(name);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style}
      fill={isFill ? 'currentColor' : 'none'}
      stroke={isFill ? 'none' : 'currentColor'}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Sparkline
function Sparkline({ values, width = 80, height = 32, stroke = 'var(--accent)' }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = d + ` L ${width},${height} L 0,${height} Z`;
  const gid = 'sg_' + Math.random().toString(36).slice(2, 8);
  return (
    <svg className="stat-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

Object.assign(window, { Icon, Sparkline });
