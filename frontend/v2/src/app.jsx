// Main App with auth gate.
function App() {
  const initial = window.__TWEAKS__ || {};
  const [authed, setAuthed] = React.useState(() => API.isAuthed());
  const [page, setPage] = React.useState(initial.startPage || 'dashboard');
  const [tweaks, setTweaks] = React.useState({
    theme: initial.theme || 'dark',
    accent: initial.accent || 'violet',
    density: initial.density || 'cozy',
    motion: initial.motion !== false,
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [editModeOn, setEditModeOn] = React.useState(false);

  // React to auth changes fired by the API client (login / 401 logout).
  React.useEffect(() => {
    const onAuth = () => setAuthed(API.isAuthed());
    window.addEventListener('ec:auth-changed', onAuth);
    return () => window.removeEventListener('ec:auth-changed', onAuth);
  }, []);

  // Verify token still works when already authed, and bring up WS.
  React.useEffect(() => {
    if (!authed) { window.WS && window.WS.disconnect(); return; }
    let cancelled = false;
    API.agents().catch(() => { if (!cancelled) API.logout(); });
    window.WS && window.WS.connect();
    return () => { cancelled = true; };
  }, [authed]);

  // Edit mode wiring (design tool protocol)
  React.useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') { setEditModeOn(true); setTweaksOpen(true); }
      else if (d.type === '__deactivate_edit_mode') { setEditModeOn(false); setTweaksOpen(false); }
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Apply theme classes to body
  React.useEffect(() => {
    const body = document.body;
    body.className = '';
    body.classList.add(`theme-${tweaks.theme}`);
    body.classList.add(`accent-${tweaks.accent}`);
    if (tweaks.density === 'compact') body.classList.add('density-compact');
    if (!tweaks.motion) body.classList.add('no-motion');
  }, [tweaks]);

  const setTweak = (k, v) => {
    setTweaks(prev => {
      const next = { ...prev, [k]: v };
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
      return next;
    });
  };

  if (!authed) {
    return <LoginGate onAuthed={() => setAuthed(true)} />;
  }

  const nav = NAV.find(n => n.id === page);
  const crumbs = ['EchoCenter', nav?.group || '', nav?.label || ''].filter(Boolean);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <DashboardPage />;
      case 'butler':     return <ButlerPage />;
      case 'agents':     return <AgentsPage />;
      case 'operator':   return <OperatorPage />;
      case 'monitor':    return <MonitorPage />;
      case 'operations': return <OperationsPage />;
      case 'settings':   return <SettingsPage />;
      default:           return <DashboardPage />;
    }
  };

  const fullBleed = page === 'butler' || page === 'agents';

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} />
      <main className="main">
        <Topbar crumbs={crumbs} onToggleTweaks={() => setTweaksOpen(v => !v)} theme={tweaks.theme} setTheme={(t) => setTweak('theme', t)} />
        <div className={`page ${fullBleed ? 'nopad' : ''}`} key={page}>
          {renderPage()}
        </div>
      </main>
      <Tweaks open={tweaksOpen && editModeOn} onClose={() => setTweaksOpen(false)} tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
