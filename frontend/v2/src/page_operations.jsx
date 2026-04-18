// Operations (agent lifecycle + token management) + Operator pages
function OperationsPage() {
  const [tab, setTab] = React.useState('agents');
  return (
    <div>
      <div className="page-hero">
        <div className="title-stack">
          <div className="eyebrow">Admin · Operations</div>
          <h1 className="h1">Agent lifecycle & access.</h1>
          <p>Register new agents, rotate API tokens, review connection state. Raw tokens are never shown — only hints.</p>
        </div>
        <Btn variant="accent" icon="plus">Register agent</Btn>
      </div>

      <div style={{ display:'flex', gap: 4, borderBottom: '1px solid var(--border-faint)', marginBottom: 18 }}>
        {[['agents','Agents'],['users','Users & Roles'],['tokens','Tokens'],['feishu','Feishu Integration']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: tab === k ? 'var(--fg)' : 'var(--fg-dim)',
            borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
            transition: 'all var(--dur) var(--ease)',
          }}>{v}</button>
        ))}
      </div>

      {tab === 'agents' && <OpAgents />}
      {tab === 'users'  && <OpUsers />}
      {tab === 'tokens' && <OpTokens />}
      {tab === 'feishu' && <OpFeishu />}
    </div>
  );
}

function OpAgents() {
  const [agents, setAgents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [query, setQuery] = React.useState('');

  const refresh = React.useCallback(() => {
    setLoading(true);
    setErr('');
    API.agents()
      .then(setAgents)
      .catch(ex => setErr(ex.message || 'Failed to load agents.'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(refresh, [refresh]);

  const filtered = agents.filter(a =>
    !query || (a.name + a.role + a.kind).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="card flush">
      <div className="panel-header">
        <div className="left"><h3 className="h3">Registered Agents</h3><Pill>{agents.length}</Pill></div>
        <div style={{ display:'flex', gap: 8 }}>
          <input className="input" placeholder="Search…" style={{ width: 200, height: 32 }}
            value={query} onChange={e => setQuery(e.target.value)} />
          <Btn variant="ghost" size="sm" icon="refresh" onClick={refresh}>Refresh</Btn>
        </div>
      </div>
      {err ? <div style={{ padding: '10px 20px', color: 'var(--red)', fontSize: 12 }}>{err}</div> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th><th>Role</th><th>Kind</th><th>Token hint</th><th>Last seen</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {loading && agents.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 30 }}>Loading…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 30 }}>No agents match.</td></tr>
          ) : filtered.map(a => (
            <tr key={a.id}>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <AgentAvatar name={a.name} status={a.status} size={26} />
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                </div>
              </td>
              <td><Pill>{a.role}</Pill></td>
              <td className="mono dim">{a.kind}</td>
              <td className="mono">{a.tokenHint}</td>
              <td className="mono dim">{a.lastSeen}</td>
              <td><Pill kind={a.status === 'online' ? 'green' : a.status === 'busy' ? 'amber' : ''}>{a.status}</Pill></td>
              <td style={{ textAlign:'right', paddingRight: 20 }}>
                <button className="icon-btn" style={{ width: 26, height: 26, display:'inline-grid' }} title="Refresh" onClick={refresh}><Icon name="refresh" size={12}/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpUsers() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    API.users()
      .then(list => { if (!cancelled) setUsers(list); })
      .catch(ex => { if (!cancelled) setErr(ex.message || 'Failed to load users.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card flush">
      <div className="panel-header">
        <div className="left"><h3 className="h3">Team Members</h3><Pill>{users.length}</Pill></div>
        <Btn variant="accent" size="sm" icon="plus">Invite</Btn>
      </div>
      {err ? <div style={{ padding: '10px 20px', color: 'var(--red)', fontSize: 12 }}>{err}</div> : null}
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last active</th><th></th></tr></thead>
        <tbody>
          {loading && users.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 30 }}>Loading…</td></tr>
          ) : users.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign:'center', color: 'var(--fg-dim)', padding: 30 }}>No users.</td></tr>
          ) : users.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                    {u.name.split(/\s|_/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase() || '—'}
                  </div>
                  <span style={{ fontWeight: 500 }}>{u.name}</span>
                </div>
              </td>
              <td className="mono dim">{u.email}</td>
              <td><Pill kind={u.role === 'Admin' ? 'accent' : ''}>{u.role}</Pill></td>
              <td className="mono dim">{u.lastActive}</td>
              <td style={{ textAlign:'right', paddingRight: 20 }}><button className="icon-btn" style={{ width: 26, height: 26, display:'inline-grid' }}><Icon name="dots" size={12}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpTokens() {
  const tokens = [
    { name: 'Butler Production', scope: 'BUTLER', created: 'Mar 14 2026', expires: 'Sep 14 2026', hint: 'ec_9f3…a12' },
    { name: 'CI Runner', scope: 'WORKER', created: 'Feb 02 2026', expires: '—', hint: 'ec_4c1…9b8' },
    { name: 'Feishu Bridge', scope: 'INTEGRATION', created: 'Jan 22 2026', expires: '—', hint: 'ec_21e…7cc' },
  ];
  return (
    <div className="card flush">
      <div className="panel-header">
        <div className="left"><h3 className="h3">API Tokens</h3></div>
        <Btn variant="accent" size="sm" icon="plus">Generate token</Btn>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Scope</th><th>Token hint</th><th>Created</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          {tokens.map(t => (
            <tr key={t.name}>
              <td style={{ fontWeight: 500 }}>{t.name}</td>
              <td><Pill>{t.scope}</Pill></td>
              <td className="mono">{t.hint}</td>
              <td className="mono dim">{t.created}</td>
              <td className="mono dim">{t.expires}</td>
              <td style={{ textAlign:'right', paddingRight: 20 }}>
                <button className="icon-btn" style={{ width: 26, height: 26, display:'inline-grid' }}><Icon name="refresh" size={12}/></button>
                <button className="icon-btn" style={{ width: 26, height: 26, display:'inline-grid', marginLeft: 4 }}><Icon name="trash" size={12}/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpFeishu() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Long-connection bridge</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Connection status</div>
        <div style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 13 }}>
          <span className="pulse-dot" /> Connected · rtt 21ms · 2 open streams
        </div>
        <div className="divider" style={{ margin: '16px 0' }} />
        <div className="kv"><span className="k">App ID</span><span className="v">cli_a0f8b9c…</span></div>
        <div className="kv"><span className="k">Verification token</span><span className="v">v_token_7d3…</span></div>
        <div className="kv"><span className="k">Encrypt mode</span><span className="v">aes-256-cbc</span></div>
        <div style={{ display:'flex', gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" size="sm" icon="refresh">Test connection</Btn>
          <Btn variant="ghost" size="sm">Edit config</Btn>
        </div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Routing policies</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Inbound filters</div>
        {[
          ['Forward @butler mentions', true],
          ['Forward approval card replies', true],
          ['Forward DMs to Butler', true],
          ['Forward channel messages (all)', false],
        ].map(([p, on]) => (
          <div key={p} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '8px 0', borderBottom: '1px dashed var(--border-faint)' }}>
            <span style={{ fontSize: 13 }}>{p}</span>
            <div className={`switch ${on ? 'on' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OperatorPage() {
  const [status, setStatus] = React.useState(null);
  const [tasks, setTasks] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const liveRef = React.useRef(null);

  const runningRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    try {
      const [st, ts] = await Promise.all([
        API.openHandsStatus(),
        API.openHandsTasks(10),
      ]);
      setStatus(st);
      setTasks(ts);
      runningRef.current = ts.some(t => String(t.status || '').toLowerCase() === 'running');
      setErr('');
    } catch (ex) {
      setErr(ex.message || 'Failed to load operator data.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    // Poll every 1.5s while something runs, 4s when idle.
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const delay = runningRef.current ? 1500 : 4000;
      return setTimeout(async () => {
        await refresh();
        timerRef = schedule();
      }, delay);
    };
    let timerRef = schedule();
    return () => {
      cancelled = true;
      if (timerRef) clearTimeout(timerRef);
    };
  }, [refresh]);

  const selected = React.useMemo(() => {
    if (!tasks.length) return null;
    if (selectedId) {
      const found = tasks.find(t => t.id === selectedId);
      if (found) return found;
    }
    return tasks.find(t => String(t.status || '').toLowerCase() === 'running') || tasks[0];
  }, [tasks, selectedId]);

  // Auto-scroll live output to the bottom as it updates.
  React.useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [selected?.live_output]);

  const runningCount = tasks.filter(t => String(t.status || '').toLowerCase() === 'running').length;

  const liveText = selected
    ? (selected.live_output || selected.summary || selected.error || '(no output yet)')
    : '';

  return (
    <div>
      <div className="page-hero">
        <div className="title-stack">
          <div className="eyebrow">Admin · Operator</div>
          <h1 className="h1">OpenHands operator console.</h1>
          <p>
            {loading ? 'Loading…' :
              !status ? 'Operator status unavailable.' :
              `${status.worker_reachable ? 'Worker reachable' : 'Worker unreachable'} · mode ${status.worker_mode || '—'} · ${runningCount} running / ${tasks.length} recent`}
            {err ? <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {err}</span> : null}
          </p>
        </div>
        <Btn variant="ghost" icon="refresh" onClick={refresh}>Refresh</Btn>
      </div>
      <div className="panel-row">
        <div className="card flush">
          <div className="panel-header">
            <div className="left">
              <h3 className="h3">Recent Runs</h3>
              <Pill kind={runningCount ? 'green' : ''}>
                {runningCount ? <><span className="pulse-dot" style={{ width:5, height:5 }} /> {runningCount} running</> : `${tasks.length} total`}
              </Pill>
            </div>
          </div>
          <div style={{ padding: 16, maxHeight: 540, overflowY: 'auto' }}>
            {loading && tasks.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>Loading…</div>
            ) : tasks.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>No OpenHands tasks recorded.</div>
            ) : tasks.map(r => {
              const st = String(r.status || '').toLowerCase();
              const isRunning = st === 'running';
              const isFailed = st === 'failed' || r.success === false;
              const pillKind = isRunning ? 'green' : isFailed ? 'red' : 'blue';
              const active = selected && selected.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="card"
                  style={{
                    padding: 14, marginBottom: 10, cursor: 'pointer',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    boxShadow: active ? '0 0 0 1px var(--accent-glow)' : undefined,
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
                    <Icon name="terminal" size={14} style={{ color:'var(--accent)' }} />
                    <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={r.task}>
                      {r.task || '(untitled task)'}
                    </div>
                    <Pill kind={pillKind}>
                      {isRunning ? <span className="pulse-dot" style={{ width:5, height:5 }} /> : null}
                      {r.status || 'unknown'}
                    </Pill>
                  </div>
                  <div className="mono dim" style={{ fontSize: 11, display:'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>{r.id}</span>
                    <span>{r.worker_mode || '—'}</span>
                    <span>{formatDuration(r)}</span>
                    {r.current_step ? <span>step: {r.current_step}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card flush">
          <div className="panel-header">
            <div className="left">
              <h3 className="h3">Live Output</h3>
              <Pill kind="accent">{selected ? selected.id : '—'}</Pill>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="mono dim" style={{ fontSize: 10 }}>
                {selected ? (String(selected.status || '').toLowerCase() === 'running' ? 'streaming · 1.5s poll' : 'final · 4s poll') : ''}
              </span>
            </div>
          </div>
          <pre
            ref={liveRef}
            style={{
              padding: 20, margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
              color:'var(--fg-muted)', maxHeight: 540, minHeight: 240, overflow:'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
{selected ? liveText : '(select a run on the left)'}
          </pre>
        </div>
      </div>
    </div>
  );
}

function formatDuration(r) {
  if (r.duration_ms && r.duration_ms > 0) {
    const s = Math.round(r.duration_ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }
  if (r.started_at) {
    const d = new Date(r.started_at);
    const diff = Date.now() - d.getTime();
    if (diff > 0) {
      const s = Math.round(diff / 1000);
      if (s < 60) return `${s}s elapsed`;
      const m = Math.floor(s / 60);
      return `${m}m ${s % 60}s elapsed`;
    }
  }
  return '—';
}

Object.assign(window, { OperationsPage, OperatorPage });
