import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { messageService } from '@/services/messageService';
import { userService } from '@/services/userService';
import { PulseDot } from '@/components/v3/PulseDot';
import { Pill } from '@/components/v3/Pill';
import { AgentAvatar } from '@/components/v3/AgentAvatar';
import { StatCard } from '@/components/v3/StatCard';
import type { Agent, LogMessage } from '@/types';

type AgentStatus = 'online' | 'busy' | 'offline';

function agentStatus(a: Agent): AgentStatus {
  if (a.online === true) return 'online';
  if ((a.status || '').toUpperCase() === 'BUSY') return 'busy';
  if ((a.status || '').toUpperCase() === 'ONLINE') return 'online';
  return 'offline';
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const LEVEL_FILTERS = ['ALL', 'INFO', 'DEBUG', 'AUTH', 'WARN', 'ERROR'];

const DashboardPage = () => {
  const { logout } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setErr('');
    try {
      const [ags, msgs] = await Promise.all([
        userService.getAgents().catch(() => []),
        messageService.getMessages({ limit: 200 }).catch(() => [] as LogMessage[]),
      ]);
      setAgents(Array.isArray(ags) ? ags : []);
      setLogs(Array.isArray(msgs) ? msgs : []);
    } catch (ex) {
      const e = ex as { response?: { status: number }; message?: string };
      if (e.response?.status === 401) logout();
      setErr(e.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const { online, offline, last24h, pendingAuth, filtered } = useMemo(() => {
    const online = agents.filter((a) => agentStatus(a) === 'online');
    const offline = agents.filter((a) => agentStatus(a) === 'offline');
    const now = Date.now();
    const last24h = logs.filter((l) => {
      if (!l.timestamp) return false;
      const t = new Date(l.timestamp).getTime();
      return !isNaN(t) && now - t < 24 * 3600 * 1000;
    });
    const pendingAuth = logs.filter((l) => (l.level || '').toUpperCase() === 'AUTH').slice(0, 3);
    const filtered = logs.filter((l) => {
      const lvl = (l.level || '').toUpperCase() === 'WARNING' ? 'WARN' : (l.level || '').toUpperCase();
      const okLvl = filter === 'ALL' || lvl === filter;
      const okQuery =
        !query ||
        (l.content || '').toLowerCase().includes(query.toLowerCase()) ||
        (l.agent_id || '').toLowerCase().includes(query.toLowerCase());
      return okLvl && okQuery;
    });
    return { online, offline, last24h, pendingAuth, filtered };
  }, [agents, logs, filter, query]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const greeting = (() => {
    const h = now.getHours();
    if (h < 5) return 'Still up,';
    if (h < 12) return 'Good morning,';
    if (h < 18) return 'Good afternoon,';
    return 'Good evening,';
  })();

  return (
    <div>
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">Overview · {dateLabel}</div>
          <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>{greeting} there.</h1>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
            {loading
              ? 'Loading…'
              : `${online.length} of ${agents.length} agents online. ${last24h.length} messages in the last 24 hours.`}
            {err ? <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {err}</span> : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostBtn onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </GhostBtn>
          <AccentBtn>
            <Plus size={13} /> Deploy Agent
          </AccentBtn>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Active Agents"        value={online.length}      unit={agents.length ? `/ ${agents.length}` : null} delta={`${offline.length} offline`} trend={offline.length ? 'flat' : 'up'} />
        <StatCard label="Messages · 24h"       value={last24h.length}     unit={null}                                         delta={`${logs.length} total`}       trend="up" />
        <StatCard label="Avg Latency"          value={0}                  unit="ms"                                           delta="n/a"                           trend="flat" placeholder />
        <StatCard label="Open Authorizations"  value={pendingAuth.length} unit={null}                                         delta={pendingAuth.length ? 'review below' : 'all clear'} trend={pendingAuth.length ? 'down' : 'up'} />
      </div>

      {/* Panel row: logs (2fr) + agents (1fr) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="v3-card" style={{ padding: 0 }}>
          <PanelHeader title="System Logs" right={
            <div style={{ display: 'flex', gap: 8 }}>
              <Pill kind="accent">Live</Pill>
              <GhostBtn size="sm" onClick={refresh}><RefreshCw size={12} /> Refresh</GhostBtn>
            </div>
          } />
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter messages…"
              style={{
                flex: 1,
                maxWidth: 360,
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-faint)',
                color: 'var(--fg)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {LEVEL_FILTERS.map((l) => (
                <button key={l} onClick={() => setFilter(l)} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '5px 10px',
                  borderRadius: 7,
                  background: filter === l ? 'var(--accent-soft)' : 'var(--bg-sunken)',
                  border: filter === l ? '1px solid transparent' : '1px solid var(--border-faint)',
                  color: filter === l ? 'var(--accent-hue)' : 'var(--fg-muted)',
                  cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {loading && logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Loading logs…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>No log entries match.</div>
            ) : (
              filtered.map((l) => {
                const raw = (l.level || 'INFO').toUpperCase();
                const lvl = raw === 'WARNING' ? 'WARN' : raw;
                const lvlColor =
                  lvl === 'ERROR' ? 'var(--red)' :
                  lvl === 'WARN'  ? 'var(--amber)' :
                  lvl === 'AUTH'  ? 'var(--amber)' :
                  lvl === 'DEBUG' ? 'var(--fg-faint)' :
                                    'var(--accent-hue)';
                return (
                  <div key={l.id} className="v3-log-row">
                    <div className="t">{l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour12: false }) : '—'}</div>
                    <div className="agent">
                      <span className="dot" style={{ background: lvlColor }} />
                      <span className="name">{l.agent_id || 'system'}</span>
                    </div>
                    <div className="lvl" style={{ color: lvlColor }}>{lvl}</div>
                    <div className="msg">{l.content}</div>
                    <ChevronRight size={13} style={{ color: 'var(--fg-faint)' }} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="v3-card" style={{ padding: 0 }}>
          <PanelHeader title="Active Agents" right={
            <Pill kind="green"><PulseDot size={6} /> {online.length} online</Pill>
          } />
          <div style={{ padding: 8 }}>
            {loading && agents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Loading agents…</div>
            ) : agents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>No agents registered.</div>
            ) : (
              agents.slice(0, 7).map((a) => {
                const st = agentStatus(a);
                return (
                  <div
                    key={a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <AgentAvatar name={a.username || ''} status={st} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.username}</div>
                      <div className="eyebrow" style={{ fontSize: 10 }}>{(a.agent_kind || a.role || 'agent')} · {a.runtime_kind || '—'}</div>
                    </div>
                    <div className="v3-mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>{timeAgo(a.last_seen_at)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pending authorizations (single panel spanning full width) */}
      <div className="v3-card" style={{ padding: 0 }}>
        <PanelHeader
          title="Pending Authorizations"
          right={<Pill kind={pendingAuth.length ? 'amber' : 'green'}>{pendingAuth.length}</Pill>}
        />
        <div style={{ padding: 16 }}>
          {pendingAuth.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--fg-dim)', fontSize: 13 }}>
              No pending authorization requests. Butler will surface them here when agents need approval.
            </div>
          ) : (
            pendingAuth.map((a) => (
              <div
                key={a.id}
                className="v3-card"
                style={{
                  padding: '14px 16px',
                  marginBottom: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background:
                    'linear-gradient(180deg, color-mix(in oklab, var(--accent-soft) 50%, transparent), transparent 60%), var(--bg-card)',
                  borderColor: 'var(--border-base)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{a.content}</span>
                  <span className="v3-mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-dim)' }}>
                    {a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour12: false }) : '—'}
                  </span>
                </div>
                <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
                  From <b style={{ color: 'var(--fg)', fontWeight: 500 }}>{a.agent_id}</b>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <AccentBtn size="sm">Approve</AccentBtn>
                  <GhostBtn size="sm">Deny</GhostBtn>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function PanelHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 className="h3-display" style={{ margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );
}

function GhostBtn({ children, onClick, size }: { children: React.ReactNode; onClick?: () => void; size?: 'sm' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: size === 'sm' ? '5px 10px' : '7px 12px',
        borderRadius: size === 'sm' ? 7 : 8,
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500,
        background: 'var(--bg-sunken)',
        color: 'var(--fg)',
        border: '1px solid var(--border-faint)',
        cursor: 'pointer',
        transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function AccentBtn({ children, size, onClick }: { children: React.ReactNode; size?: 'sm'; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: size === 'sm' ? '5px 10px' : '7px 12px',
        borderRadius: size === 'sm' ? 7 : 8,
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500,
        background: 'var(--accent-hue)',
        color: 'var(--accent-ink)',
        border: '1px solid transparent',
        cursor: 'pointer',
        boxShadow: '0 0 0 1px var(--accent-glow), 0 8px 28px -10px var(--accent-glow)',
        transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export default DashboardPage;
