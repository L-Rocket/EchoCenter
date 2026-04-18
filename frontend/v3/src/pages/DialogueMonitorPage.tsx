import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import ButlerDialogueMonitor from '@/components/butler/ButlerDialogueMonitor';
import { Pill } from '@/components/v3/Pill';
import { PulseDot } from '@/components/v3/PulseDot';
import { ThinkingChip } from '@/components/v3/ThinkingChip';
import { userService } from '@/services/userService';
import type { Agent } from '@/types';

const DialogueMonitorPage = () => {
  const [butler, setButler] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAgents();
      const agentList = Array.isArray(data) ? data : [];
      const butlerAgent =
        agentList.find((a) => (a.role || '').toUpperCase() === 'BUTLER') ||
        agentList.find((a) => (a.username || '').toLowerCase() === 'butler');
      setAgents(agentList);
      setButler(butlerAgent ?? null);
      if (!butlerAgent) setError('Butler is not available yet.');
    } catch {
      setError('Failed to load monitor resources.');
      setAgents([]);
      setButler(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <ThinkingChip label="Loading dialogue monitor" />
      </div>
    );
  }

  if (!butler || error) {
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
          <h2 className="h2-display" style={{ margin: 0 }}>Monitor Unavailable</h2>
          <p style={{ margin: '10px 0 18px', color: 'var(--fg-muted)', fontSize: 13 }}>
            {error || 'No Butler instance was found in current agents.'}
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
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">Admin · Monitor</div>
          <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>Butler ↔ agent dialogue.</h1>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
            Inspect the hidden coordination channel between Butler and downstream agents in real time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill kind="green">
            <PulseDot size={5} /> Streaming
          </Pill>
          <button onClick={fetchAgents} style={ghostBtn}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="v3-card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100dvh - 260px)', minHeight: 560 }}>
        <ButlerDialogueMonitor butler={butler} agents={agents} className="h-full" />
      </div>
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

export default DialogueMonitorPage;
