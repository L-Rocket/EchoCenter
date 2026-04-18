import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, LayoutGrid, RefreshCw } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import { PulseDot } from '@/components/v3/PulseDot';
import { Pill } from '@/components/v3/Pill';
import { AgentAvatar } from '@/components/v3/AgentAvatar';
import { userService } from '@/services/userService';
import type { Agent, ConversationThread } from '@/types';

type View = 'split' | 'grid';
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

const AgentsPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('split');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await userService.getAgents();
      const list = (Array.isArray(data) ? data : []).filter(
        (a) => (a.role || '').toUpperCase() !== 'BUTLER' && a.agent_kind !== 'openhands_ops'
      );
      setAgents(list);
      setSelected((prev) => prev && list.find((a) => a.id === prev.id) ? prev : list[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected?.id) {
      setThreads([]);
      setSelectedThreadId(null);
      return;
    }
    let cancelled = false;
    userService
      .listConversationThreads(selected.id, 'agent_direct')
      .then((list) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setThreads(arr);
        setSelectedThreadId(arr[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setThreads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const filtered = useMemo(
    () =>
      agents.filter(
        (a) =>
          !query ||
          (a.username + (a.role || '') + (a.description || '') + (a.agent_kind || ''))
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [agents, query]
  );

  const createThread = async () => {
    if (!selected?.id) return;
    const created = await userService.createConversationThread({
      peer_id: selected.id,
      channel_kind: 'agent_direct',
      title: 'New Agent Conversation',
    });
    const next = await userService.listConversationThreads(selected.id, 'agent_direct');
    setThreads(Array.isArray(next) ? next : []);
    setSelectedThreadId(created.id);
  };

  const onlineCount = agents.filter((a) => agentStatus(a) === 'online').length;
  const offlineCount = agents.filter((a) => agentStatus(a) === 'offline').length;

  if (view === 'grid') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
          <div style={{ maxWidth: 720 }}>
            <div className="eyebrow">Workspace · Agents</div>
            <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>Your agent fleet.</h1>
            <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
              {loading ? 'Loading…' : `${onlineCount} online, ${offlineCount} offline.`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('split')} style={ghostBtn}>
              <LayoutGrid size={13} /> Split view
            </button>
            <button onClick={refresh} style={ghostBtn}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map((a) => {
            const st = agentStatus(a);
            return (
              <div
                key={a.id}
                className="v3-card hoverable"
                style={{ padding: 18, cursor: 'pointer' }}
                onClick={() => {
                  setSelected(a);
                  setView('split');
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <AgentAvatar name={a.username || ''} status={st} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{a.username}</div>
                    <div className="eyebrow" style={{ fontSize: 10 }}>{a.id}</div>
                  </div>
                  <Pill kind={st === 'online' ? 'green' : st === 'busy' ? 'amber' : 'default'}>{st}</Pill>
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55, minHeight: 38 }}>
                  {a.description || 'No description provided.'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-faint)',
                    fontSize: 12,
                    color: 'var(--fg-dim)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Pill>{a.role || 'AGENT'}</Pill>
                    <Pill>{a.runtime_kind || a.agent_kind || 'generic'}</Pill>
                  </div>
                  <span className="v3-mono" style={{ marginLeft: 'auto' }}>
                    {timeAgo(a.last_seen_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Split view
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', height: '100%' }}>
      {/* Left rail */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-faint)', minHeight: 0 }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-faint)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Agent Fleet</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{agents.length} agents</div>
            </div>
            <button onClick={() => setView('grid')} title="Grid view" style={iconBtn}>
              <LayoutGrid size={14} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--fg-dim)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents"
              style={{
                width: '100%',
                height: 32,
                padding: '0 12px 0 28px',
                background: 'var(--bg-sunken)',
                border: '1px solid var(--border-faint)',
                color: 'var(--fg)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {loading && agents.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>No agents match.</div>
          ) : (
            filtered.map((a) => {
              const st = agentStatus(a);
              const active = selected?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: active ? 'var(--bg-sunken)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 2,
                  }}
                >
                  <AgentAvatar name={a.username || ''} status={st} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.username}</div>
                    <div className="eyebrow" style={{ fontSize: 10 }}>
                      {(a.role || 'AGENT')} · {a.runtime_kind || a.agent_kind || 'generic'}
                    </div>
                  </div>
                  <div className="v3-mono" style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
                    {timeAgo(a.last_seen_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              padding: '24px 28px 20px',
              borderBottom: '1px solid var(--border-faint)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 18,
            }}
          >
            <AgentAvatar name={selected.username || ''} status={agentStatus(selected)} size={56} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <h2 className="h2-display" style={{ margin: 0 }}>{selected.username}</h2>
                <Pill kind={agentStatus(selected) === 'online' ? 'green' : agentStatus(selected) === 'busy' ? 'amber' : 'default'}>
                  <PulseDot size={5} tone={agentStatus(selected) === 'online' ? 'green' : 'amber'} />
                  {agentStatus(selected)}
                </Pill>
                <Pill>{selected.role || 'AGENT'}</Pill>
                <Pill>{selected.runtime_kind || selected.agent_kind || 'generic'}</Pill>
              </div>
              <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>{selected.description || 'No description provided.'}</div>
              <div
                className="v3-mono"
                style={{ fontSize: 11, marginTop: 6, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--fg-dim)' }}
              >
                <span>id: {selected.id}</span>
                <span>last seen: {timeAgo(selected.last_seen_at)}</span>
                <span>token: {selected.token_hint || '—'}</span>
              </div>
            </div>
            <button onClick={createThread} disabled={!selected} style={accentBtn}>
              <Plus size={13} /> New thread
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {selectedThread ? (
              <ChatView agent={selected} thread={selectedThread} />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 40 }}>
                <div style={{ textAlign: 'center', maxWidth: 360 }}>
                  <div className="h2-display">Start a conversation</div>
                  <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 8 }}>
                    {threads.length === 0 ? `No threads yet with ${selected.username}.` : 'Pick a thread on the left or create a new one.'}
                  </p>
                  <button onClick={createThread} style={{ ...accentBtn, marginTop: 14 }}>
                    <Plus size={13} /> New thread
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', color: 'var(--fg-dim)', fontSize: 13 }}>Select an agent from the list.</div>
      )}
    </div>
  );
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  background: 'var(--bg-sunken)',
  color: 'var(--fg)',
  border: '1px solid var(--border-faint)',
  cursor: 'pointer',
};

const accentBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '5px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--accent-hue)',
  color: 'var(--accent-ink)',
  border: 0,
  cursor: 'pointer',
  boxShadow: '0 0 0 1px var(--accent-glow), 0 8px 28px -10px var(--accent-glow)',
};

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  borderRadius: 6,
};

export default AgentsPage;
