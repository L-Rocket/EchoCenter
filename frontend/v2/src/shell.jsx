// Sidebar + Topbar
const NAV = [
  { id: 'dashboard',  label: 'Dashboard',   icon: 'dashboard',  group: 'Workspace' },
  { id: 'butler',     label: 'Butler',      icon: 'butler',     group: 'Workspace', badge: '2' },
  { id: 'agents',     label: 'Agents',      icon: 'agents',     group: 'Workspace', badge: '12' },
  { id: 'operator',   label: 'Operator',    icon: 'terminal',   group: 'Admin' },
  { id: 'monitor',    label: 'Dialogue Monitor', icon: 'monitor',    group: 'Admin' },
  { id: 'operations', label: 'Operations',  icon: 'operations', group: 'Admin' },
  { id: 'settings',   label: 'Settings',    icon: 'settings',   group: 'Admin' },
];

function Sidebar({ page, setPage }) {
  const groups = {};
  NAV.forEach(n => { (groups[n.group] ||= []).push(n); });
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 12 C 5 7, 9 5, 12 5 S 19 7, 19 12" />
            <path d="M8 15 C 8 11, 10 10, 12 10 S 16 11, 16 15" opacity="0.6" />
          </svg>
        </div>
        <div style={{ lineHeight: 1 }}>
          <div className="brand-title">EchoCenter</div>
          <div className="brand-sub">v2.1 · hive</div>
        </div>
      </div>

      {Object.entries(groups).map(([g, items]) => (
        <div key={g}>
          <div className="nav-section-label">{g}</div>
          {items.map(it => (
            <div
              key={it.id}
              className={`nav-item ${page === it.id ? 'active' : ''}`}
              onClick={() => setPage(it.id)}
            >
              <Icon name={it.icon} size={15} stroke={1.7} style={{ color: 'currentColor' }} />
              <span>{it.label}</span>
              {it.badge ? <span className="nav-badge mono">{it.badge}</span> : null}
            </div>
          ))}
        </div>
      ))}

      <div className="sidebar-foot">
        <div className="user-chip" title="Click the arrow to sign out">
          <div className="avatar">{DATA.user.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{DATA.user.name}</div>
            <div className="user-role">{String(DATA.user.role || 'USER').toUpperCase()}</div>
          </div>
          <button
            className="icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={() => API.logout()}
            title="Sign out"
          >
            <Icon name="arrowright" size={12} style={{ color: 'var(--fg-dim)' }} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, onToggleTweaks, theme, setTheme }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <span className="slash">/</span> : null}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="spacer" />
      <div className="cmdk">
        <Icon name="search" size={13} />
        <span style={{ flex: 1 }}>Search agents, messages, commands…</span>
        <kbd>⌘</kbd><kbd>K</kbd>
      </div>
      <span className="ws-chip">
        <span className="pulse-dot" /> Live · WS
      </span>
      <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
      <button className="icon-btn" title="Notifications"><Icon name="bell" size={15} /></button>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, NAV });
