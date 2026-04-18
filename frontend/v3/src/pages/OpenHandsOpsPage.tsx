import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, ShieldAlert, Terminal } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import { Pill } from '@/components/v3/Pill';
import { PulseDot } from '@/components/v3/PulseDot';
import { ThinkingChip } from '@/components/v3/ThinkingChip';
import { userService } from '@/services/userService';
import type { Agent, ConversationThread, OpenHandsStatus, OpenHandsTaskRecord } from '@/types';

function formatDuration(r: OpenHandsTaskRecord): string {
  if (r.duration_ms && r.duration_ms > 0) {
    const s = Math.round(r.duration_ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }
  if (r.started_at) {
    const d = new Date(r.started_at);
    const diff = Date.now() - d.getTime();
    if (diff > 0) {
      const s = Math.round(diff / 1000);
      if (s < 60) return `${s}s elapsed`;
      const m = Math.floor(s / 60);
      return `${m}m ${s % 60}s elapsed`;
    }
  }
  return '—';
}

const OpenHandsOpsPage = () => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<OpenHandsTaskRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<OpenHandsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const liveRef = useRef<HTMLPreElement>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const data = await userService.getAgents();
      const list = Array.isArray(data) ? data : [];
      const opsAgent =
        list.find((a) => a.agent_kind === 'openhands_ops') ||
        list.find((a) => (a.username || '').toLowerCase() === 'openhands-ops') ||
        null;
      setAgent(opsAgent);
      if (opsAgent?.id) {
        const next = await userService.listConversationThreads(opsAgent.id, 'agent_direct');
        const arr = Array.isArray(next) ? next : [];
        setThreads(arr);
        setSelectedThreadId((curr) => curr ?? arr[0]?.id ?? null);
      } else {
        setThreads([]);
        setError('Operator is not available yet.');
      }
    } catch {
      setError('Failed to load operator workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  const pollOps = useCallback(async () => {
    try {
      const [st, ts] = await Promise.all([
        userService.getOpenHandsStatus().catch(() => null),
        userService.listOpenHandsTasks(10).catch(() => [] as OpenHandsTaskRecord[]),
      ]);
      setStatus(st);
      setTasks(ts);
      runningRef.current = ts.some((t) => String(t.status || '').toLowerCase() === 'running');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchAgent();
  }, [fetchAgent]);

  useEffect(() => {
    void pollOps();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (cancelled) return;
      const delay = runningRef.current ? 1500 : 4000;
      timer = setTimeout(async () => {
        await pollOps();
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollOps]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const selectedTask = useMemo(() => {
    if (!tasks.length) return null;
    if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return tasks.find((t) => String(t.status || '').toLowerCase() === 'running') || tasks[0];
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [selectedTask?.live_output]);

  const createThread = async () => {
    if (!agent?.id) return;
    const created = await userService.createConversationThread({
      peer_id: agent.id,
      channel_kind: 'agent_direct',
      title: 'New Operator Session',
    });
    const next = await userService.listConversationThreads(agent.id, 'agent_direct');
    setThreads(Array.isArray(next) ? next : []);
    setSelectedThreadId(created.id);
  };

  const runningCount = tasks.filter((t) => String(t.status || '').toLowerCase() === 'running').length;

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <ThinkingChip label="Loading operator" />
      </div>
    );
  }

  if (!agent || error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <div className="v3-card" style={{ padding: 28, maxWidth: 380, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 14px',
              borderRadius: 14,
              background: 'var(--bg-sunken)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--fg-muted)',
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <h2 className="h2-display" style={{ margin: 0 }}>Operator Unavailable</h2>
          <p style={{ margin: '10px 0 18px', color: 'var(--fg-muted)', fontSize: 13 }}>
            {error || 'No operator runtime was found in current agents.'}
          </p>
          <button onClick={fetchAgent} style={ghostBtn}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">Admin · Operator</div>
          <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>OpenHands operator console.</h1>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
            {status
              ? `${status.worker_reachable ? 'Worker reachable' : 'Worker unreachable'} · mode ${status.worker_mode || '—'} · ${runningCount} running / ${tasks.length} recent`
              : 'Loading status…'}
          </p>
        </div>
        <button onClick={pollOps} style={ghostBtn}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="v3-card" style={{ padding: 0 }}>
          <PanelHeader
            title="Recent Runs"
            right={
              <Pill kind={runningCount ? 'green' : 'default'}>
                {runningCount ? (
                  <>
                    <PulseDot size={5} /> {runningCount} running
                  </>
                ) : (
                  `${tasks.length} total`
                )}
              </Pill>
            }
          />
          <div style={{ padding: 16, maxHeight: 420, overflowY: 'auto' }}>
            {tasks.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--fg-dim)', fontSize: 13 }}>No OpenHands tasks recorded.</div>
            ) : (
              tasks.map((r) => {
                const st = String(r.status || '').toLowerCase();
                const isRunning = st === 'running';
                const isFailed = st === 'failed' || r.success === false;
                const pillKind = isRunning ? 'green' : isFailed ? 'red' : 'blue';
                const active = selectedTask && selectedTask.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedTaskId(r.id)}
                    className="v3-card"
                    style={{
                      padding: 14,
                      marginBottom: 10,
                      cursor: 'pointer',
                      borderColor: active ? 'var(--accent-hue)' : 'var(--border-base)',
                      boxShadow: active ? '0 0 0 1px var(--accent-glow)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Terminal size={14} style={{ color: 'var(--accent-hue)' }} />
                      <div
                        style={{
                          fontWeight: 500,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                        title={r.task}
                      >
                        {r.task || '(untitled task)'}
                      </div>
                      <Pill kind={pillKind}>
                        {isRunning ? <PulseDot size={5} /> : null}
                        {r.status || 'unknown'}
                      </Pill>
                    </div>
                    <div
                      className="v3-mono"
                      style={{ fontSize: 11, display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--fg-dim)' }}
                    >
                      <span>{r.id}</span>
                      <span>{r.worker_mode || '—'}</span>
                      <span>{formatDuration(r)}</span>
                      {r.current_step ? <span>step: {r.current_step}</span> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="v3-card" style={{ padding: 0 }}>
          <PanelHeader
            title="Live Output"
            right={
              <>
                <Pill kind="accent">{selectedTask ? selectedTask.id : '—'}</Pill>
                {selectedTask ? (
                  <span className="v3-mono" style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
                    {String(selectedTask.status || '').toLowerCase() === 'running'
                      ? 'streaming · 1.5s poll'
                      : 'final · 4s poll'}
                  </span>
                ) : null}
              </>
            }
          />
          <pre
            ref={liveRef}
            style={{
              padding: 20,
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--fg-muted)',
              maxHeight: 420,
              minHeight: 240,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {selectedTask
              ? selectedTask.live_output || selectedTask.summary || selectedTask.error || '(no output yet)'
              : '(select a run on the left)'}
          </pre>
        </div>
      </div>

      <div className="v3-card" style={{ padding: 0, overflow: 'hidden', minHeight: 420 }}>
        <PanelHeader
          title="Operator Chat"
          right={
            <button onClick={createThread} style={{ ...accentBtn, padding: '5px 10px' }}>
              <Plus size={12} /> New session
            </button>
          }
        />
        <div style={{ minHeight: 360, height: 'calc(100dvh - 720px)' }}>
          {selectedThread ? (
            <ChatView agent={agent} thread={selectedThread} />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--fg-dim)', padding: 24, textAlign: 'center' }}>
              <div>
                <div className="h2-display">Start an operator session</div>
                <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 8 }}>
                  Create a new thread to send instructions to the OpenHands worker.
                </p>
                <button onClick={createThread} style={{ ...accentBtn, marginTop: 14 }}>
                  <Plus size={13} /> New session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function PanelHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-faint)',
      }}
    >
      <h3 className="h3-display" style={{ margin: 0 }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );
}

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
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--accent-hue)',
  color: 'var(--accent-ink)',
  border: 0,
  cursor: 'pointer',
  boxShadow: '0 0 0 1px var(--accent-glow), 0 8px 28px -10px var(--accent-glow)',
};

export default OpenHandsOpsPage;
