function SettingsPage() {
  const [tab, setTab] = React.useState('profile');
  return (
    <div>
      <div className="page-hero">
        <div className="title-stack">
          <div className="eyebrow">Workspace · Settings</div>
          <h1 className="h1">Preferences.</h1>
          <p>Personal preferences and workspace defaults.</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        <nav style={{ display:'flex', flexDirection:'column', gap: 2 }}>
          {[
            ['profile','Profile'],
            ['appearance','Appearance'],
            ['notifications','Notifications'],
            ['shortcuts','Keyboard shortcuts'],
            ['language','Language & region'],
            ['advanced','Advanced'],
          ].map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '8px 10px',
              textAlign:'left',
              borderRadius: 8,
              fontSize: 13,
              color: tab === k ? 'var(--fg)' : 'var(--fg-muted)',
              background: tab === k ? 'var(--bg-sunken)' : 'transparent',
              fontWeight: tab === k ? 500 : 400,
              transition: 'all var(--dur) var(--ease)',
            }}>{v}</button>
          ))}
        </nav>

        <div style={{ maxWidth: 620 }}>
          {tab === 'profile' && <ProfilePane />}
          {tab === 'appearance' && <AppearancePane />}
          {tab === 'notifications' && <NotificationsPane />}
          {tab === 'shortcuts' && <ShortcutsPane />}
          {tab === 'language' && <LanguagePane />}
          {tab === 'advanced' && <AdvancedPane />}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--border-faint)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {desc ? <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{desc}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ProfilePane() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', gap: 16, marginBottom: 20 }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>LW</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Lin Wei</div>
          <div className="mono dim" style={{ fontSize: 12 }}>lin@echocenter.ai</div>
        </div>
        <Btn variant="ghost" size="sm" style={{ marginLeft:'auto' }}>Upload photo</Btn>
      </div>
      <SettingRow label="Display name" desc="Shown in chats and audit logs.">
        <input className="input" defaultValue="Lin Wei" style={{ width: 240 }} />
      </SettingRow>
      <SettingRow label="Email" desc="Used for sign-in and alerts.">
        <input className="input" defaultValue="lin@echocenter.ai" style={{ width: 240 }} />
      </SettingRow>
      <SettingRow label="Role" desc="Admins can manage agents and tokens.">
        <Pill kind="accent">Admin</Pill>
      </SettingRow>
      <div style={{ display:'flex', gap: 8, marginTop: 16 }}>
        <Btn variant="accent">Save changes</Btn>
        <Btn variant="ghost">Cancel</Btn>
      </div>
    </div>
  );
}
function AppearancePane() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <SettingRow label="Theme" desc="Follow the OS or pick one.">
        <div className="chipset">
          {['System','Light','Dark'].map(t => <button key={t} className={`chip ${t==='Dark'?'active':''}`}>{t}</button>)}
        </div>
      </SettingRow>
      <SettingRow label="Density" desc="How compact rows and cards appear.">
        <div className="chipset">
          {['Cozy','Compact'].map(t => <button key={t} className={`chip ${t==='Cozy'?'active':''}`}>{t}</button>)}
        </div>
      </SettingRow>
      <SettingRow label="Reduce motion" desc="Disable non-essential animations.">
        <div className="switch" />
      </SettingRow>
      <SettingRow label="Monospace in messages" desc="Force code-style font for agent replies.">
        <div className="switch on" />
      </SettingRow>
    </div>
  );
}
function NotificationsPane() {
  return (
    <div className="card" style={{ padding: 24 }}>
      {[
        ['Authorization requests','Butler requests your approval', true],
        ['Agent offline','Any agent disconnects', true],
        ['High error rate','>5% errors in 5 minutes', true],
        ['Feishu bridge events','Inbound cards and relays', false],
        ['Digest email','Daily summary at 9am', false],
      ].map(([l, d, on], i) => (
        <SettingRow key={i} label={l} desc={d}><div className={`switch ${on?'on':''}`} /></SettingRow>
      ))}
    </div>
  );
}
function ShortcutsPane() {
  const rows = [
    ['Open command palette','⌘ K'],
    ['New Butler thread','⌘ ⇧ B'],
    ['Jump to Dashboard','G D'],
    ['Jump to Agents','G A'],
    ['Approve pending auth','⌘ ↵'],
    ['Toggle theme','⌘ ⇧ L'],
  ];
  return (
    <div className="card flush">
      <table className="table">
        <tbody>{rows.map(([l, k]) => <tr key={l}><td>{l}</td><td style={{ textAlign:'right', paddingRight: 20 }}><kbd style={{ fontFamily:'var(--font-mono)', fontSize: 11, padding: '2px 6px', border:'1px solid var(--border-faint)', borderRadius: 4, background:'var(--bg-sunken)' }}>{k}</kbd></td></tr>)}</tbody>
      </table>
    </div>
  );
}
function LanguagePane() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <SettingRow label="Interface language">
        <div className="chipset">
          {['English','简体中文'].map((t, i) => <button key={t} className={`chip ${i===0?'active':''}`}>{t}</button>)}
        </div>
      </SettingRow>
      <SettingRow label="Time zone"><select className="input" style={{ width: 240 }} defaultValue="gmt8"><option value="gmt8">Asia / Shanghai (GMT+8)</option><option value="utc">UTC</option><option value="pst">America / Los Angeles</option></select></SettingRow>
      <SettingRow label="Date format"><div className="chipset">{['YYYY-MM-DD','MMM DD, YYYY','DD/MM/YYYY'].map((t,i)=><button key={t} className={`chip ${i===0?'active':''}`}>{t}</button>)}</div></SettingRow>
    </div>
  );
}
function AdvancedPane() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <SettingRow label="Developer mode" desc="Expose raw WS frames and API debug panel."><div className="switch" /></SettingRow>
      <SettingRow label="Experimental features" desc="Preview features in active development."><div className="switch" /></SettingRow>
      <SettingRow label="Clear local cache" desc="Flushes cached threads and agent metadata.">
        <Btn variant="ghost" icon="trash">Clear</Btn>
      </SettingRow>
      <SettingRow label="Sign out of all devices">
        <Btn variant="ghost">Sign out</Btn>
      </SettingRow>
    </div>
  );
}

Object.assign(window, { SettingsPage });
