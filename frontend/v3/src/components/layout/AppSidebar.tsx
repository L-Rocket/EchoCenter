import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Crown,
  Bot,
  Wrench,
  Radar,
  MessagesSquare,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BrandMark } from '@/components/v3/BrandMark';

type NavGroup = 'Workspace' | 'Admin';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  group: NavGroup;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard',        label: 'Dashboard', path: '/dashboard',        icon: LayoutDashboard, group: 'Workspace' },
  { key: 'butler',           label: 'Butler',    path: '/butler',           icon: Crown,            group: 'Workspace' },
  { key: 'agents',           label: 'Agents',    path: '/agents',           icon: Bot,              group: 'Workspace' },
  { key: 'operator',         label: 'Operator',  path: '/operator',         icon: Wrench,           group: 'Admin', adminOnly: true },
  { key: 'dialogue-monitor', label: 'Monitor',   path: '/dialogue-monitor', icon: MessagesSquare,   group: 'Admin', adminOnly: true },
  { key: 'operations',       label: 'Operations',path: '/operations',       icon: Radar,            group: 'Admin', adminOnly: true },
  { key: 'settings',         label: 'Settings',  path: '/settings',         icon: Settings,         group: 'Admin', adminOnly: true },
];

export function AppSidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const groups: Record<NavGroup, NavItem[]> = { Workspace: [], Admin: [] };
  NAV.filter((n) => !n.adminOnly || isAdmin).forEach((n) => groups[n.group].push(n));

  const initials = user?.username
    ? user.username
        .split(/[-\s_]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('')
    : '??';

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-faint)',
        background: 'color-mix(in oklab, var(--bg-elev) 70%, transparent)',
        backdropFilter: 'blur(20px)',
        padding: '14px 12px 12px',
        gap: 4,
        height: '100dvh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 14px' }}>
        <BrandMark size={30} />
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>EchoCenter</div>
          <div className="eyebrow" style={{ marginTop: 2 }}>v3 · hive</div>
        </div>
      </div>

      {(['Workspace', 'Admin'] as NavGroup[]).map((g) =>
        groups[g].length === 0 ? null : (
          <div key={g}>
            <div className="eyebrow" style={{ padding: '14px 12px 6px' }}>{g}</div>
            {groups[g].map((n) => (
              <NavLink
                key={n.key}
                to={n.path}
                className={({ isActive }) => `v3-nav-item ${isActive ? 'active' : ''}`}
              >
                <n.icon size={15} style={{ opacity: 0.85 }} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </div>
        )
      )}

      <div style={{ marginTop: 'auto', padding: '10px 4px 6px', borderTop: '1px solid var(--border-faint)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 8,
            borderRadius: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-hue), oklch(0.6 0.2 330))',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent-ink)',
              boxShadow: '0 0 0 1px var(--bg)',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username || '—'}
            </div>
            <div className="eyebrow" style={{ fontSize: 10 }}>{(user?.role || '').toUpperCase() || 'USER'}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign out"
            style={{
              width: 26,
              height: 26,
              border: 0,
              background: 'transparent',
              color: 'var(--fg-dim)',
              cursor: 'pointer',
              borderRadius: 6,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
