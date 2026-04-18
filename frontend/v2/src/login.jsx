// Login overlay — rendered when no valid token is present.
function LoginGate({ onAuthed }) {
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('admin123');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await API.login(username, password);
      onAuthed && onAuthed();
    } catch (ex) {
      setErr(ex.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card" style={{ width: 380, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="brand-mark" style={{ width: 36, height: 36 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 12 C 5 7, 9 5, 12 5 S 19 7, 19 12" />
              <path d="M8 15 C 8 11, 10 10, 12 10 S 16 11, 16 15" opacity="0.6" />
            </svg>
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>EchoCenter</div>
            <div className="mono dim" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
              Sign in · v2 redesign
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Username</span>
            <input
              className="input"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {err ? (
            <div style={{
              color: 'var(--red)',
              fontSize: 12,
              padding: '8px 10px',
              background: 'color-mix(in oklab, var(--red) 10%, transparent)',
              borderRadius: 8,
            }}>
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn accent"
            disabled={busy}
            style={{ marginTop: 6, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mono dim" style={{ fontSize: 10, textAlign: 'center', marginTop: 2 }}>
            backend: {API.base}
          </div>
        </form>
      </div>
    </div>
  );
}

Object.assign(window, { LoginGate });
