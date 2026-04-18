// Tweaks panel
function Tweaks({ open, onClose, tweaks, setTweak }) {
  if (!open) return null;
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Icon name="sparkle" size={13} style={{ color:'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Tweaks</span>
        </div>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}><Icon name="close" size={12} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <span className="label">Theme</span>
          <div className="opts">
            {['dark','light'].map(t => (
              <button key={t} className={`tweak-opt ${tweaks.theme===t?'active':''}`} onClick={() => setTweak('theme', t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="label">Accent</span>
          <div style={{ display:'flex', gap: 8 }}>
            {[
              ['violet','oklch(0.72 0.18 295)'],
              ['cyan','oklch(0.78 0.14 200)'],
              ['lime','oklch(0.84 0.17 135)'],
              ['orange','oklch(0.76 0.17 55)'],
            ].map(([k, c]) => (
              <button key={k} className={`swatch ${tweaks.accent===k?'active':''}`} style={{ background: c }} onClick={() => setTweak('accent', k)} />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="label">Density</span>
          <div className="opts">
            {['cozy','compact'].map(t => (
              <button key={t} className={`tweak-opt ${tweaks.density===t?'active':''}`} onClick={() => setTweak('density', t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <span className="label">Motion</span>
          <div className={`switch ${tweaks.motion?'on':''}`} onClick={() => setTweak('motion', !tweaks.motion)} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Tweaks });
