import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { BrandMark } from '@/components/v3/BrandMark';

const LoginForm = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { token, user } = await authService.login(username, password);
      login(token, user);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="app-shell-bg"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        zIndex: 10,
      }}
    >
      <div
        className="v3-card page-in"
        style={{
          width: 380,
          padding: 28,
          boxShadow: '0 28px 64px -32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <BrandMark size={36} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>EchoCenter</div>
            <div className="eyebrow" style={{ marginTop: 2 }}>Sign in · v3</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Username</span>
            <input
              className="v3-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </label>

          {error ? (
            <div
              style={{
                color: 'var(--red)',
                fontSize: 12,
                padding: '8px 10px',
                background: 'color-mix(in oklab, var(--red) 10%, transparent)',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 6,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              background: 'var(--accent-hue)',
              color: 'var(--accent-ink)',
              border: '1px solid transparent',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              boxShadow: '0 0 0 1px var(--accent-glow), 0 8px 28px -10px var(--accent-glow)',
              transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="eyebrow" style={{ fontSize: 10, textAlign: 'center', marginTop: 2 }}>
            default dev · admin / admin123
          </div>
        </form>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--bg-sunken)',
  border: '1px solid var(--border-faint)',
  color: 'var(--fg)',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  transition: 'border 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};

export default LoginForm;
