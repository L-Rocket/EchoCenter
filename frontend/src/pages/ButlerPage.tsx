import { useEffect, useState } from 'react';
import { Bot, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import ButlerDialogueMonitor from '@/components/butler/ButlerDialogueMonitor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { userService } from '@/services/userService';
import type { Agent } from '@/types';

type ButlerPanelMode = 'me_butler' | 'butler_monitor';

const ButlerPage = () => {
  const [mode, setMode] = useState<ButlerPanelMode>('me_butler');

  const [butler, setButler] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelHeightClass = 'h-[calc(100dvh-330px)] min-h-[460px]';

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await userService.getAgents();
      const agentList = Array.isArray(data) ? data : [];
      setAgents(agentList);
      const butlerAgent =
        agentList.find((agent) => (agent.role || '').toUpperCase() === 'BUTLER') ||
        agentList.find((agent) => (agent.username || '').toLowerCase() === 'butler');

      setButler(butlerAgent ?? null);
      if (!butlerAgent) {
        setError('Butler is not available yet.');
      }
    } catch (_err) {
      setError('Failed to load Butler channel.');
      setButler(null);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-lg grid-cols-2 gap-1 rounded-xl border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setMode('me_butler')}
          className={cn(
            'h-8 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
            mode === 'me_butler' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Me {'<>'} Butler
        </button>
        <button
          type="button"
          onClick={() => setMode('butler_monitor')}
          className={cn(
            'h-8 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
            mode === 'butler_monitor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Butler {'<>'} Agents
        </button>
      </div>

      {loading ? (
        <Card className={cn(panelHeightClass, 'flex items-center justify-center')}>
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loading Butler Channel...</span>
          </div>
        </Card>
      ) : !butler || error ? (
        <Card className={cn(panelHeightClass, 'flex items-center justify-center p-8')}>
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">Butler Unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || 'No Butler instance was found in current agents.'}
            </p>
            <Button onClick={fetchAgents} variant="outline" className="mt-6">
              Retry
            </Button>
          </div>
        </Card>
      ) : mode === 'me_butler' ? (
        <Card className={cn(panelHeightClass, 'overflow-hidden flex flex-col md:flex-row')}>
          <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-5">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3 w-3" />
                Core Channel
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border bg-primary/10 p-2 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">{butler.username}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chief Butler</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dedicated channel for your direct conversation with Butler.
                </p>
              </div>
              <div className="rounded-lg border bg-background/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Priority Link Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex-grow min-w-0 min-h-0">
            <ChatView agent={butler} />
          </div>
        </Card>
      ) : (
        <ButlerDialogueMonitor butler={butler} agents={agents} className={panelHeightClass} />
      )}
    </div>
  );
};

export default ButlerPage;
