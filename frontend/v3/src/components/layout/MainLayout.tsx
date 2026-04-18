import { useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from './AppSidebar';
import { PulseDot } from '@/components/v3/PulseDot';
import { Tweaks } from '@/components/v3/Tweaks';
import { ThemeProviderContext } from '@/context/ThemeProvider';
import { useAuth } from '@/context/AuthContext';

const PATH_LABELS: Record<string, { group: string; label: string }> = {
  '/dashboard': { group: 'Workspace', label: 'Dashboard' },
  '/butler': { group: 'Workspace', label: 'Butler' },
  '/agents': { group: 'Workspace', label: 'Agents' },
  '/operator': { group: 'Admin', label: 'Operator' },
  '/operations': { group: 'Admin', label: 'Operations' },
  '/dialogue-monitor': { group: 'Admin', label: 'Monitor' },
  '/settings': { group: 'Admin', label: 'Settings' },
};

export function MainLayout() {
  const location = useLocation();
  const { theme, setTheme } = useContext(ThemeProviderContext);
  const { isWsConnected } = useAuth();

  const effectiveTheme =
    theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

  const path = Object.keys(PATH_LABELS).find((p) => location.pathname.startsWith(p));
  const crumbs = ['EchoCenter', path ? PATH_LABELS[path].group : '', path ? PATH_LABELS[path].label : '']
    .filter(Boolean);

  const fullBleed = location.pathname.startsWith('/butler') || location.pathname.startsWith('/agents');

  return (
    <TooltipProvider>
      <div className="app-shell-bg" style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
        <AppSidebar />
        <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1 }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 28px',
              gap: 16,
              borderBottom: '1px solid var(--border-faint)',
              background: 'color-mix(in oklab, var(--bg) 70%, transparent)',
              backdropFilter: 'blur(16px)',
              flex: '0 0 auto',
              minHeight: 58,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-dim)', letterSpacing: '0.02em' }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 ? <span style={{ opacity: 0.5 }}>/</span> : null}
                  <span style={{ color: i === crumbs.length - 1 ? 'var(--fg)' : undefined }}>{c}</span>
                </span>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px 6px 12px',
                border: '1px solid var(--border-faint)',
                borderRadius: 8,
                background: 'var(--bg-sunken)',
                color: 'var(--fg-dim)',
                fontSize: 12,
                minWidth: 260,
                cursor: 'text',
              }}
            >
              <Search size={13} />
              <span style={{ flex: 1 }}>Search agents, messages, commands…</span>
              <kbd
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border-faint)',
                }}
              >
                ⌘K
              </kbd>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px 5px 9px',
                borderRadius: 999,
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-faint)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--fg-muted)',
              }}
            >
              <PulseDot tone={isWsConnected ? 'green' : 'amber'} size={7} />
              {isWsConnected ? 'Live · WS' : 'Offline'}
            </span>
            <button
              onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
              style={iconBtnStyle}
            >
              {effectiveTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button title="Notifications" style={iconBtnStyle}>
              <Bell size={15} />
            </button>
          </header>
          <div
            key={location.pathname}
            className="page-in"
            style={{ flex: 1, overflow: 'auto', padding: fullBleed ? 0 : 28, position: 'relative', minHeight: 0 }}
          >
            <Outlet />
          </div>
        </main>
        <Tweaks />
      </div>
    </TooltipProvider>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 8,
  color: 'var(--fg-muted)',
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};

// Named export alias for App.tsx compatibility
export { MainLayout as default };
