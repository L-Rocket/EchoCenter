// Dialogue Monitor — recent backend messages reshaped as inter-agent events.
function MonitorPage() {
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [filter, setFilter] = React.useState('ALL');

  const refresh = React.useCallback(() => {
    setLoading(true);
    setErr('');
    API.messages({ limit: 80 })
      .then((list) => {
        const reshaped = list.map((l) => {
          const kind =
            l.lvl === 'ERROR' ? 'REQUEST' :
            l.lvl === 'WARN'  ? 'REQUEST' :
            l.lvl === 'AUTH'  ? 'AUTHORIZE' :
            l.lvl === 'DEBUG' ? 'DISPATCH' :
            'RESPONSE';
          return {
            id: l.id,
            t: l.t,
            from: l.agent || 'system',
            to: 'Butler',
            kind,
            body: l.msg,
          };
        });
        setEvents(reshaped);
      })
      .catch((ex) => setErr(ex.message || 'Failed to load dialogue.'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const kinds = ['ALL','INTENT','DISPATCH','RESPONSE','REQUEST','AUTHORIZE'];
  const filtered = events.filter(m => filter === 'ALL' || m.kind === filter);

  return (
    <div>
      <div className="page-hero">
        <div className="title-stack">
          <div className="eyebrow">Admin · Monitor</div>
          <h1 className="h1">Butler ↔ agent dialogue.</h1>
          <p>
            {loading ? 'Loading…' : `${events.length} events · polling every 15s`}
            {err ? <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {err}</span> : null}
          </p>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="ghost" icon="refresh" onClick={refresh}>Refresh</Btn>
        </div>
      </div>

      <div className="card flush">
        <div className="panel-header">
          <div className="left">
            <h3 className="h3">Live Timeline</h3>
            <Pill kind="green"><span className="pulse-dot" style={{ width:5, height:5 }} /> streaming</Pill>
          </div>
          <div className="chipset">
            {kinds.map(k => (
              <button key={k} className={`chip ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{k}</button>
            ))}
          </div>
        </div>
        <div className="monitor-track">
          {loading && events.length === 0 ? (
            <div style={{ padding: 30, color: 'var(--fg-dim)', fontSize: 13 }}>Loading events…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 30, color: 'var(--fg-dim)', fontSize: 13 }}>No events match.</div>
          ) : filtered.map((m) => {
            const kindColor = {
              INTENT: 'accent', DISPATCH: 'blue', RESPONSE: 'green', REQUEST: 'amber', AUTHORIZE: 'accent',
            }[m.kind] || '';
            return (
              <div key={m.id} className="monitor-event">
                <div className="ts">{m.t}</div>
                <div>
                  <div className="flow">
                    <Pill kind={kindColor}>{m.kind}</Pill>
                    <span>{m.from}</span>
                    <span className="arrow">→</span>
                    <span style={{ color: 'var(--fg)' }}>{m.to}</span>
                  </div>
                  <div className="content"><strong>{String(m.body).split('·')[0]}</strong>{String(m.body).includes('·') ? ' · ' + String(m.body).split('·').slice(1).join('·') : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MonitorPage });
