// Dashboard page — live data from the Go backend.
function DashboardPage() {
  const [agents, setAgents] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [filter, setFilter] = React.useState('ALL');
  const [query, setQuery] = React.useState('');

  const refresh = React.useCallback(async () => {
    setErr('');
    try {
      const [ags, msgs] = await Promise.all([
        API.agents().catch(() => []),
        API.messages({ limit: 200 }).catch(() => []),
      ]);
      setAgents(ags);
      setLogs(msgs);
    } catch (ex) {
      setErr(ex.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const online = agents.filter(a => a.status === 'online');
  const offline = agents.filter(a => a.status === 'offline');
  const now = Date.now();
  const last24hCount = logs.filter(l => {
    const t = l.ts ? new Date(l.ts).getTime() : 0;
    return t && now - t < 24 * 3600 * 1000;
  }).length;
  const pendingAuth = logs.filter(l => l.lvl === 'AUTH').slice(0, 3);

  const stats = [
    { label: 'Active Agents', value: online.length, unit: agents.length ? `/ ${agents.length}` : null, delta: `${offline.length} offline`, up: offline.length === 0 },
    { label: 'Messages · 24h', value: last24hCount, unit: null, delta: `${logs.length} total`, up: true },
    { label: 'Avg Latency', value: 0, unit: 'ms', delta: 'n/a', up: true, placeholder: true },
    { label: 'Open Authorizations', value: pendingAuth.length, unit: null, delta: pendingAuth.length ? 'review below' : 'all clear', up: pendingAuth.length === 0 },
  ];

  const filtered = logs.filter(l =>
    (filter === 'ALL' || l.lvl === filter) &&
    (!query ||
      l.msg.toLowerCase().includes(query.toLowerCase()) ||
      l.agent.toLowerCase().includes(query.toLowerCase()))
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Still up,';
    if (h < 12) return 'Good morning,';
    if (h < 18) return 'Good afternoon,';
    return 'Good evening,';
  })();
  const firstName = String(DATA.user.name || '').split(/\s|_/)[0] || 'there';

  return (
    <div>
      <div className="page-hero">
        <div className="title-stack">
          <div className="eyebrow">Overview · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <h1 className="h1">{greeting} {firstName}.</h1>
          <p>
            {loading ? 'Loading…' :
              `${online.length} of ${agents.length} agents online. ${last24hCount} messages in the last 24 hours.`}
            {err ? <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {err}</span> : null}
          </p>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="ghost" icon="refresh" onClick={refresh}>Refresh</Btn>
          <Btn variant="accent" icon="plus">Deploy Agent</Btn>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="card stat-card hoverable">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value tnum">
              {s.placeholder ? <span className="dim">—</span> : <AnimatedNumber value={s.value} />}
              {s.unit ? <span className="unit">{s.unit}</span> : null}
            </div>
            <div className={`stat-delta ${s.up ? '' : 'down'}`}>
              <Icon name="arrowright" size={10} /> {s.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-row">
        <div className="card flush">
          <div className="panel-header">
            <div className="left">
              <h3 className="h3">System Logs</h3>
              <Pill kind="accent" icon="activity">Live</Pill>
            </div>
            <div style={{ display:'flex', gap: 8 }}>
              <Btn variant="ghost" size="sm" icon="refresh" onClick={refresh}>Refresh</Btn>
            </div>
          </div>
          <div className="feed-filterbar">
            <input className="input" placeholder="Filter messages…" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="chipset">
              {['ALL','INFO','DEBUG','AUTH','WARN','ERROR'].map(l => (
                <button key={l} className={`chip ${filter===l?'active':''}`} onClick={() => setFilter(l)}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {loading && logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Loading logs…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>No log entries match.</div>
            ) : filtered.map((l) => {
              const lvlColor = l.lvl === 'ERROR' ? 'red' : l.lvl === 'WARN' ? 'amber' : l.lvl === 'AUTH' ? 'amber' : l.lvl === 'DEBUG' ? 'dim' : 'accent';
              const dotColor = lvlColor === 'dim' ? 'var(--fg-faint)' : `var(--${lvlColor === 'accent' ? 'accent' : lvlColor})`;
              return (
                <div key={l.id} className="log-row">
                  <div className="t">{l.t}</div>
                  <div className="agent">
                    <span className="dot" style={{ background: dotColor }} />
                    <span style={{ fontWeight: 500 }}>{l.agent}</span>
                  </div>
                  <div className="lvl" style={{ color: dotColor }}>{l.lvl}</div>
                  <div className="msg">{l.msg}</div>
                  <Icon name="chevright" size={13} style={{ color: 'var(--fg-faint)' }} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card flush">
          <div className="panel-header">
            <div className="left">
              <h3 className="h3">Active Agents</h3>
              <Pill kind="green">
                <span className="pulse-dot" style={{ width:6, height:6 }} /> {online.length} online
              </Pill>
            </div>
            <Btn variant="ghost" size="sm" icon="arrowright">All</Btn>
          </div>
          <div style={{ padding: 8 }}>
            {loading && agents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Loading agents…</div>
            ) : agents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>No agents registered.</div>
            ) : agents.slice(0, 7).map(a => (
              <div key={a.id} className="agent-mini">
                <AgentAvatar name={a.name} status={a.status} />
                <div style={{ minWidth: 0 }}>
                  <div className="name">{a.name}</div>
                  <div className="role">{a.role} · {a.kind}</div>
                </div>
                <div className="meta">{a.lastSeen}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-row triple">
        <div className="card flush">
          <div className="panel-header">
            <div className="left"><h3 className="h3">Throughput · 24h</h3></div>
            <Pill kind="accent">{last24hCount} msgs</Pill>
          </div>
          <ActivityChart logs={logs} />
        </div>
        <div className="card flush">
          <div className="panel-header">
            <div className="left"><h3 className="h3">Top Intents</h3><Pill kind="">static</Pill></div>
          </div>
          <div style={{ padding: '16px 20px 20px', display:'flex', flexDirection:'column', gap: 12 }}>
            {DATA.intents.map(([k, v, c]) => (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>{k}</span><span className="mono dim">{v}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-sunken)', borderRadius: 3 }}>
                  <div style={{ width: `${v*2}%`, maxWidth: '100%', height: '100%', background: c, borderRadius: 3, transition: 'width 700ms var(--ease)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card flush">
          <div className="panel-header">
            <div className="left"><h3 className="h3">Pending Authorizations</h3></div>
            <Pill kind={pendingAuth.length ? 'amber' : 'green'}>{pendingAuth.length}</Pill>
          </div>
          <div style={{ padding: 12 }}>
            {pendingAuth.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--fg-dim)', fontSize: 13 }}>
                No pending authorization requests.
              </div>
            ) : pendingAuth.map((a) => (
              <div key={a.id} className="auth-request" style={{ marginBottom: 8 }}>
                <div className="h">
                  <Icon name="shield" size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{a.msg}</span>
                  <span className="mono dim" style={{ marginLeft: 'auto', fontSize: 10 }}>{a.t}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>From <b style={{ color:'var(--fg)', fontWeight:500 }}>{a.agent}</b></div>
                <div className="actions">
                  <Btn variant="accent" size="sm" icon="check">Approve</Btn>
                  <Btn variant="ghost" size="sm">Deny</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityChart({ logs = [] }) {
  // Bucket logs into the last 24 hours.
  const now = new Date();
  const buckets = new Array(24).fill(0);
  logs.forEach((l) => {
    if (!l.ts) return;
    const d = new Date(l.ts);
    const diffMs = now - d;
    if (isNaN(diffMs) || diffMs < 0 || diffMs >= 24 * 3600 * 1000) return;
    const hoursAgo = Math.floor(diffMs / 3600 / 1000);
    buckets[23 - hoursAgo] += 1;
  });
  const vals = buckets.map(v => v || 0.5); // keep baseline visible
  const max = Math.max(...vals, 1);
  const w = 560, h = 180, pad = { l: 32, r: 16, t: 16, b: 24 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const step = iw / (vals.length - 1);
  const pts = vals.map((v, i) => [pad.l + i * step, pad.t + ih - (v / max) * ih]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = d + ` L ${pad.l + iw},${pad.t + ih} L ${pad.l},${pad.t + ih} Z`;
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          {[0.25, 0.5, 0.75].map(r => (
            <line key={r} x1={pad.l} x2={pad.l + iw} y1={pad.t + ih * r} y2={pad.t + ih * r} />
          ))}
        </g>
        <path className="chart-area" d={area} />
        <path className="chart-line" d={d} />
        <g className="chart-axis">
          {[0, 6, 12, 18, 23].map(i => (
            <text key={i} x={pad.l + i * step} y={h - 6} textAnchor="middle">-{23-i}h</text>
          ))}
        </g>
      </svg>
    </div>
  );
}

Object.assign(window, { DashboardPage });
