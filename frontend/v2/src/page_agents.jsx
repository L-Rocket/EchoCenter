// Agents page — browse + detail (live data from backend).
function AgentsPage() {
  const [agents, setAgents] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [view, setView] = React.useState('split'); // 'grid' or 'split'
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    API.agents()
      .then(list => {
        if (cancelled) return;
        setAgents(list);
        if (list.length && !selected) setSelected(list[0]);
      })
      .catch(ex => { if (!cancelled) setErr(ex.message || 'Failed to load agents.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = agents.filter(a => !query || (a.name + a.role + a.desc).toLowerCase().includes(query.toLowerCase()));

  if (view === 'grid') {
    return (
      <div>
        <div className="page-hero">
          <div className="title-stack">
            <div className="eyebrow">Workspace · Agents</div>
            <h1 className="h1">Your agent fleet.</h1>
            <p>
              {loading ? 'Loading…' :
                `${agents.filter(a => a.status === 'online').length} online, ${agents.filter(a => a.status === 'offline').length} offline.`}
              {err ? <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {err}</span> : null}
            </p>
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => setView('split')}><Icon name="monitor" size={13}/>Split view</button>
            <Btn variant="accent" icon="plus">New agent</Btn>
          </div>
        </div>
        <div className="agents-grid">
          {filtered.map(a => (
            <div key={a.id} className="card agent-card hoverable" onClick={() => { setSelected(a); setView('split'); }}>
              <div className="head">
                <AgentAvatar name={a.name} status={a.status} size={42} />
                <div style={{ flex: 1 }}>
                  <div className="name">{a.name}</div>
                  <div className="id">{a.id}</div>
                </div>
                <Pill kind={a.status === 'online' ? 'green' : a.status === 'busy' ? 'amber' : ''}>{a.status}</Pill>
              </div>
              <div className="desc">{a.desc}</div>
              <div className="foot">
                <div className="tags">
                  <Pill>{a.role}</Pill>
                  <Pill>{a.kind}</Pill>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', gap:12 }}>
                  <span className="mono">{a.lastSeen}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="agents-shell">
      {/* Agent list rail */}
      <div style={{ minHeight: 0, display:'flex', flexDirection:'column' }}>
        <div className="rail-head">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Agent Fleet</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{agents.length} agents</div>
            </div>
            <button className="icon-btn" onClick={() => setView('grid')} title="Grid view"><Icon name="dashboard" size={14}/></button>
          </div>
          <div style={{ position:'relative' }}>
            <Icon name="search" size={12} style={{ position:'absolute', left: 10, top: 11, color:'var(--fg-dim)' }} />
            <input className="input" style={{ paddingLeft: 28, height: 32 }} placeholder="Search agents" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="rail-body">
          {loading && agents.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>No agents.</div>
          ) : filtered.map(a => (
            <div key={a.id} className={`agent-sublist-item ${selected?.id === a.id ? 'active' : ''}`} onClick={() => setSelected(a)}>
              <AgentAvatar name={a.name} status={a.status} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name" style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                <div className="role" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{a.role} · {a.kind}</div>
              </div>
              <div className="mono dim" style={{ fontSize: 10 }}>{a.lastSeen}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail + chat */}
      <AgentDetail agent={selected} />
    </div>
  );
}

function AgentDetail({ agent }) {
  const [tab, setTab] = React.useState('chat');
  if (!agent) {
    return (
      <div style={{ display:'grid', placeItems:'center', minHeight: '100%', color: 'var(--fg-dim)' }}>
        Select an agent from the list.
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight: 0 }}>
      <div className="agent-detail-head">
        <AgentAvatar name={agent.name} status={agent.status} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ display:'flex', gap: 10, alignItems:'center', marginBottom: 4 }}>
            <h2 className="h2" style={{ margin: 0 }}>{agent.name}</h2>
            <Pill kind={agent.status === 'online' ? 'green' : agent.status === 'busy' ? 'amber' : ''}>{agent.status}</Pill>
            <Pill>{agent.role}</Pill>
            <Pill>{agent.kind}</Pill>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{agent.desc}</div>
          <div className="mono dim" style={{ fontSize: 11, marginTop: 6, display:'flex', gap: 18, flexWrap: 'wrap' }}>
            <span>id: {agent.id}</span>
            <span>token: {agent.tokenHint}</span>
            <span>last seen: {agent.lastSeen}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" icon="refresh">Refresh</Btn>
          <Btn variant="accent" size="sm" icon="zap">Invoke</Btn>
        </div>
      </div>

      <div style={{ padding: '0 28px', borderBottom: '1px solid var(--border-faint)', display:'flex', gap: 4 }}>
        {['chat','logs','config'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: tab === t ? 'var(--fg)' : 'var(--fg-dim)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
            textTransform: 'capitalize',
            transition: 'color var(--dur) var(--ease), border var(--dur) var(--ease)',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tab === 'chat' && <AgentChatInline agent={agent} />}
        {tab === 'logs' && <AgentLogsInline agent={agent} />}
        {tab === 'config' && <AgentConfigInline agent={agent} />}
      </div>
    </div>
  );
}

function AgentChatInline({ agent }) {
  const [msgs, setMsgs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.butlerAgentConversation(agent.id)
      .then(list => { if (!cancelled) setMsgs(list); })
      .catch(ex => { if (!cancelled) setErr(ex.message || 'Failed to load conversation.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agent.id]);

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--fg-dim)', fontSize: 13 }}>Loading conversation…</div>;
  }
  if (err) {
    return <div style={{ padding: 40, color: 'var(--red)', fontSize: 13 }}>{err}</div>;
  }
  if (msgs.length === 0) {
    return <div style={{ padding: 40, color: 'var(--fg-dim)', fontSize: 13 }}>No messages yet between Butler and {agent.name}.</div>;
  }
  return (
    <div style={{ padding: '24px 28px', display:'flex', flexDirection:'column', gap: 20 }}>
      {msgs.map((m) => {
        const mine = m.who === 'me';
        return (
          <div key={m.id} className={`msg-group ${mine ? 'mine' : ''}`}>
            <div className={`msg-ava ${mine ? 'me' : ''}`} style={!mine ? { background: 'linear-gradient(135deg, oklch(0.32 0.05 220), oklch(0.22 0.04 220))' } : undefined}>
              {mine ? (DATA.user.initials || 'ME') : agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="msg-meta" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <span className="who">{mine ? 'You' : (m.who === 'butler' ? 'Butler' : agent.name)}</span>
                <span className="at">{m.at}</span>
              </div>
              <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentLogsInline({ agent }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.messages({ agent_id: agent.name, limit: 100 })
      .then(list => { if (!cancelled) setLogs(list); })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agent.name]);

  if (loading) return <div style={{ padding: 40, color: 'var(--fg-dim)', fontSize: 13 }}>Loading logs…</div>;
  if (logs.length === 0) return <div style={{ padding: 40, color: 'var(--fg-dim)', fontSize: 13 }}>No logs for {agent.name}.</div>;
  return (
    <div>
      {logs.map((l) => (
        <div key={l.id} className="log-row">
          <div className="t">{l.t}</div>
          <div className="agent"><span className="dot" style={{ background: 'var(--accent)' }} /><span style={{ fontWeight: 500 }}>{agent.name}</span></div>
          <div className="lvl">{l.lvl}</div>
          <div className="msg">{l.msg}</div>
          <Icon name="chevright" size={13} style={{ color: 'var(--fg-faint)' }} />
        </div>
      ))}
    </div>
  );
}

function AgentConfigInline({ agent }) {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 620, display:'flex', flexDirection:'column', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Connection</div>
        <div className="kv" style={{ padding: '6px 0' }}><span className="k">Runtime kind</span><span className="v">{agent.kind}</span></div>
        <div className="kv" style={{ padding: '6px 0' }}><span className="k">Agent kind</span><span className="v">{agent.raw?.agent_kind || '—'}</span></div>
        <div className="kv" style={{ padding: '6px 0' }}><span className="k">Token hint</span><span className="v">{agent.tokenHint}</span></div>
        <div className="kv" style={{ padding: '6px 0' }}><span className="k">Last seen</span><span className="v">{agent.lastSeen}</span></div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Permissions</div>
        {['Execute tool calls','Read chat history','Write to knowledge base','Send Feishu cards'].map((p, i) => (
          <div key={p} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '8px 0' }}>
            <span style={{ fontSize: 13 }}>{p}</span>
            <div className={`switch ${i < 3 ? 'on' : ''}`} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap: 8 }}>
        <Btn variant="accent">Save changes</Btn>
        <Btn variant="ghost" icon="refresh">Rotate token</Btn>
        <Btn variant="ghost" icon="trash">Delete agent</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { AgentsPage });
