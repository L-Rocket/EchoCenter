import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Sparkles, ShieldAlert } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import { PulseDot } from '@/components/v3/PulseDot';
import { Pill } from '@/components/v3/Pill';
import { AgentAvatar } from '@/components/v3/AgentAvatar';
import { userService } from '@/services/userService';
import { useAuth } from '@/context/AuthContext';
import type { Agent, ConversationThread } from '@/types';

const ButlerPage = () => {
  const { isWsConnected } = useAuth();
  const [butler, setButler] = useState<Agent | null>(null);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAgents();
      const agentList = Array.isArray(data) ? data : [];
      const butlerAgent =
        agentList.find((agent) => (agent.role || '').toUpperCase() === 'BUTLER') ||
        agentList.find((agent) => (agent.username || '').toLowerCase() === 'butler');

      setButler(butlerAgent ?? null);
      if (butlerAgent?.id) {
        const nextThreads = await userService.listConversationThreads(butlerAgent.id, 'butler_direct');
        setThreads(Array.isArray(nextThreads) ? nextThreads : []);
      } else {
        setThreads([]);
      }
      if (!butlerAgent) setError('Butler is not available yet.');
    } catch {
      setError('Failed to load Butler channel.');
      setButler(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (threads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !threads.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const createThread = async () => {
    if (!butler?.id) return;
    const created = await userService.createConversationThread({
      peer_id: butler.id,
      channel_kind: 'butler_direct',
      title: 'New Butler Conversation',
    });
    const next = await userService.listConversationThreads(butler.id, 'butler_direct');
    setThreads(Array.isArray(next) ? next : []);
    setSelectedThreadId(created.id);
  };

  const filteredThreads = threads.filter(
    (t) => !query || (t.title + (t.summary || '')).toLowerCase().includes(query.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--fg-dim)', fontSize: 13 }}>
        <div className="thinking-chip"><span className="dots"><span /><span /><span /></span>Loading Butler channel…</div>
      </div>
    );
  }

  if (!butler || error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
        <div className="v3-card" style={{ padding: 28, maxWidth: 380, textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 14, background: 'var(--bg-sunken)', margin: '0 auto 14px', color: 'var(--fg-muted)' }}>
            <ShieldAlert size={22} />
          </div>
          <h2 className="h2-display" style={{ margin: 0 }}>Butler Unavailable</h2>
          <p style={{ margin: '10px 0 18px', color: 'var(--fg-muted)', fontSize: 13 }}>
            {error || 'No Butler instance was found in the current agents list.'}
          </p>
          <button
            onClick={fetchAgents}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-faint)',
              color: 'var(--fg)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v3-chat-shell" style={{ height: '100%' }}>
      {/* Threads rail */}
      <div>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-faint)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Butler · Direct</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>Conversations</div>
            </div>
            <button onClick={createThread} title="New thread" style={railIconBtn}>
              <Plus size={14} />
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads"
            style={{
              width: '100%',
              height: 32,
              padding: '0 12px',
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-faint)',
              color: 'var(--fg)',
              borderRadius: 8,
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {filteredThreads.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13, textAlign: 'center' }}>
              {threads.length === 0 ? 'No Butler conversations yet. Create one to get started.' : 'No threads match.'}
            </div>
          ) : (
            filteredThreads.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selectedThreadId === t.id ? 'var(--bg-sunken)' : 'transparent',
                  border: selectedThreadId === t.id ? '1px solid var(--border-faint)' : '1px solid transparent',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: selectedThreadId === t.id ? 'var(--accent-hue)' : 'transparent',
                        marginRight: 6,
                        verticalAlign: 'middle',
                      }}
                    />
                    {t.title}
                  </div>
                  <div className="v3-mono" style={{ fontSize: 10, color: 'var(--fg-dim)', flexShrink: 0 }}>
                    {t.last_message_at ? new Date(t.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                  </div>
                </div>
                {t.summary ? (
                  <div
                    style={{
                      color: 'var(--fg-dim)',
                      fontSize: 12,
                      marginTop: 4,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {t.summary}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat main */}
      <div style={{ background: 'var(--bg-sunken)' }}>
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-faint)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-hue), oklch(0.6 0.2 325))',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 0 24px -4px var(--accent-glow)',
              color: 'var(--accent-ink)',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
              {butler.username}
              <Pill kind={isWsConnected ? 'green' : 'amber'}>
                <PulseDot size={5} tone={isWsConnected ? 'green' : 'amber'} />
                {isWsConnected ? 'WS live' : 'WS offline'}
              </Pill>
            </div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 2 }}>
              {(butler.agent_kind || 'butler')} · id {butler.id}
              {selectedThread ? ` · thread #${selectedThread.id}` : ''}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {selectedThread ? (
            <ChatView agent={butler} thread={selectedThread} renderAssistantAsMarkdown />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', flex: 1, color: 'var(--fg-dim)', padding: 40 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="h2-display">Pick a Butler thread</div>
                <p style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 360, margin: '8px auto 0' }}>
                  Use the left rail to resume an existing conversation or create a new one.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context rail */}
      <div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-faint)' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Session</div>
          <KV k="Thread" v={selectedThread ? `#${selectedThread.id}` : '—'} />
          <KV k="Butler id" v={butler.id} />
          <KV k="Kind" v={butler.agent_kind || '—'} />
          <KV k="Threads" v={threads.length} />
        </div>
        {selectedThread ? (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-faint)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Thread</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedThread.title}</div>
            {selectedThread.summary ? (
              <div style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                {selectedThread.summary}
              </div>
            ) : null}
          </div>
        ) : null}
        <div style={{ padding: '16px 20px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Butler peer</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AgentAvatar name={butler.username || 'Butler'} status={butler.online ? 'online' : 'offline'} size={32} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{butler.username}</div>
              <div className="eyebrow" style={{ fontSize: 10 }}>{butler.runtime_kind || 'websocket'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--fg-muted)' }}>{k}</span>
      <span className="v3-mono" style={{ fontSize: 12 }}>{v}</span>
    </div>
  );
}

const railIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  borderRadius: 6,
};

export default ButlerPage;
