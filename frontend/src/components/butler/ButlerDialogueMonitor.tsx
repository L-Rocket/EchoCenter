import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, RefreshCw, Search, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';
import { userService } from '@/services/userService';
import type { Agent, ChatMessage } from '@/types';

type DialogueSpeaker = 'butler' | 'agent';

interface DialogueEntry {
  id: string;
  speaker: DialogueSpeaker;
  content: string;
  timestamp: string;
}

interface ButlerDialogueMonitorProps {
  butler: Agent;
  agents: Agent[];
  className?: string;
}

interface RuntimeStatusBadge {
  variant: 'success' | 'info' | 'muted' | 'warning';
  label: string;
  pulse: boolean;
}

const MONITOR_TYPES = new Set(['CHAT', 'CHAT_STREAM', 'CHAT_STREAM_END']);

const parsePayload = (payload: ChatMessage['payload']): string => {
  if (typeof payload === 'string') return payload.trim();
  try {
    return JSON.stringify(payload);
  } catch (_err) {
    return '';
  }
};

const mapToDialogueEntries = (messages: ChatMessage[], agentId: number): DialogueEntry[] => {
  return messages
    .filter((msg) => MONITOR_TYPES.has(msg.type))
    .map((msg, index) => {
      const content = parsePayload(msg.payload);
      if (!content) return null;

      const speaker: DialogueSpeaker =
        msg.sender_id === agentId || (msg.sender_role || '').toUpperCase() === 'AGENT'
          ? 'agent'
          : 'butler';

      return {
        id: `${msg.id ?? 'volatile'}-${index}-${msg.timestamp}`,
        speaker,
        content,
        timestamp: msg.timestamp,
      };
    })
    .filter((entry): entry is DialogueEntry => Boolean(entry))
    .sort((a, b) => {
      const at = new Date(a.timestamp).getTime();
      const bt = new Date(b.timestamp).getTime();
      if (Number.isNaN(at) || Number.isNaN(bt)) return 0;
      if (at === bt) return a.id.localeCompare(b.id);
      return at - bt;
    });
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

const getRuntimeStatusBadge = (agent?: Agent | null): RuntimeStatusBadge => {
  if (!agent) return { variant: 'warning', label: 'Unknown', pulse: false };
  const status = String(agent.status || '').toUpperCase();
  if (agent.online === true || status === 'ONLINE') {
    return { variant: 'success', label: 'Online', pulse: true };
  }
  if (status === 'IDLE') {
    return { variant: 'info', label: 'Idle', pulse: false };
  }
  if (agent.online === false || status === 'OFFLINE') {
    return { variant: 'muted', label: 'Offline', pulse: false };
  }
  return { variant: 'warning', label: 'Unknown', pulse: false };
};

const ButlerDialogueMonitor = ({ butler, agents, className }: ButlerDialogueMonitorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [loadingAgentId, setLoadingAgentId] = useState<number | null>(null);
  const [dialogues, setDialogues] = useState<Record<number, DialogueEntry[]>>({});
  const [notices, setNotices] = useState<Record<number, string>>({});
  const [liveAgents, setLiveAgents] = useState<Agent[]>(agents);

  useEffect(() => {
    setLiveAgents(agents);
  }, [agents]);

  useEffect(() => {
    let alive = true;

    const refreshAgents = async () => {
      try {
        const data = await userService.getAgents();
        if (!alive) return;
        const agentList = (Array.isArray(data) ? data : []).filter(
          (agent) => (agent.role || '').toUpperCase() !== 'BUTLER'
        );
        setLiveAgents(agentList);
      } catch (_err) {
        // Keep previous snapshot on transient fetch errors.
      }
    };

    const interval = window.setInterval(() => {
      if (!alive) return;
      void refreshAgents();
    }, 10000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const monitorAgents = useMemo(() => {
    return liveAgents.filter((agent) => {
      const role = (agent.role || '').toUpperCase();
      return agent.id !== butler.id && role !== 'BUTLER';
    });
  }, [liveAgents, butler.id]);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return monitorAgents;
    return monitorAgents.filter((agent) => (agent.username || '').toLowerCase().includes(q));
  }, [monitorAgents, searchQuery]);

  const activeAgentId = useMemo(() => {
    if (selectedAgentId && filteredAgents.some((agent) => agent.id === selectedAgentId)) {
      return selectedAgentId;
    }
    return filteredAgents[0]?.id ?? null;
  }, [filteredAgents, selectedAgentId]);

  const loadConversation = useCallback(
    async (agent: Agent) => {
      setLoadingAgentId(agent.id);

      try {
        const backendMessages = await userService.getButlerAgentConversation(agent.id);
        const entries = mapToDialogueEntries(Array.isArray(backendMessages) ? backendMessages : [], agent.id);
        setDialogues((prev) => ({ ...prev, [agent.id]: entries }));
        setNotices((prev) => ({ ...prev, [agent.id]: '' }));
      } catch (_err) {
        setDialogues((prev) => ({ ...prev, [agent.id]: [] }));
        setNotices((prev) => ({ ...prev, [agent.id]: 'Failed to load monitor messages from backend.' }));
      } finally {
        setLoadingAgentId((prev) => (prev === agent.id ? null : prev));
      }
    },
    []
  );

  const selectedAgent = useMemo(
    () => monitorAgents.find((agent) => agent.id === activeAgentId) ?? null,
    [monitorAgents, activeAgentId]
  );

  useEffect(() => {
    if (!selectedAgent) return;
    if (dialogues[selectedAgent.id]) return;
    void loadConversation(selectedAgent);
  }, [selectedAgent, dialogues, loadConversation]);

  const selectedEntries = selectedAgent ? dialogues[selectedAgent.id] || [] : [];
  const selectedNotice = selectedAgent ? notices[selectedAgent.id] ?? '' : '';
  const isLoading = selectedAgent ? loadingAgentId === selectedAgent.id : false;
  const selectedRuntimeBadge = getRuntimeStatusBadge(selectedAgent);

  return (
    <Card className={cn('overflow-hidden py-0 gap-0', className)}>
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Agent Dialogue Monitor</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Observe Butler to Agent execution conversations.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[10px] uppercase tracking-wider"
            onClick={() => {
              if (!selectedAgent) return;
              void loadConversation(selectedAgent);
            }}
            disabled={!selectedAgent || isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full min-h-0">
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[220px_1fr] md:grid-cols-[220px_1fr] md:grid-rows-1">
          <div className="border-b md:border-b-0 md:border-r flex min-h-0 flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agents"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="divide-y">
                {filteredAgents.map((agent) => {
                  const isActive = agent.id === activeAgentId;
                  const runtimeBadge = getRuntimeStatusBadge(agent);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        void loadConversation(agent);
                      }}
                      className={cn(
                        'w-full px-3 py-2.5 text-left transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold">{agent.username}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusIndicator variant={runtimeBadge.variant} pulse={runtimeBadge.pulse} className="h-1.5 w-1.5" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {runtimeBadge.label}
                          </span>
                        </div>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Agent #{agent.id}</p>
                    </button>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">No agents available.</div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 flex flex-col bg-card">
            <header className="h-16 border-b flex items-center justify-between px-6 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-primary/10 p-2 rounded-xl text-primary border border-primary/20 shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight truncate">
                    {selectedAgent ? `${butler.username} and ${selectedAgent.username}` : 'No agent selected'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusIndicator variant={selectedRuntimeBadge.variant} pulse={selectedRuntimeBadge.pulse} className="h-1.5 w-1.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {selectedAgent ? `Agent ${selectedRuntimeBadge.label}` : 'Monitor Feed'}
                    </span>
                  </div>
                </div>
              </div>
              {selectedAgent && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                  Backend
                </Badge>
              )}
            </header>

            <div className="flex-grow overflow-y-auto bg-muted/20 p-4">
              <div className="flex flex-col space-y-4">
                {selectedNotice && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    {selectedNotice}
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-center py-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Syncing monitor stream...
                    </div>
                  </div>
                )}

                {!isLoading && selectedEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                    <div className="p-4 bg-muted rounded-full mb-4">
                      <Terminal className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      No Monitor Messages
                    </p>
                  </div>
                )}

                {!isLoading &&
                  selectedEntries.map((entry) => {
                    const isAgent = entry.speaker === 'agent';
                    return (
                      <div key={entry.id} className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
                        <div className={cn('flex flex-col max-w-[85%] md:max-w-[80%]', isAgent ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm shadow-sm border whitespace-pre-wrap break-words',
                              isAgent
                                ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
                                : 'bg-card text-card-foreground border rounded-tl-none'
                            )}
                          >
                            {entry.content}
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-1 px-1 font-bold uppercase tracking-tighter">
                            {`${isAgent ? 'Agent' : 'Butler'} · ${formatTime(entry.timestamp)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <footer className="p-4 border-t bg-card shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="h-10 rounded-xl border bg-muted/50 px-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Read-Only Monitor Mode
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    No Input
                  </Badge>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ButlerDialogueMonitor;
