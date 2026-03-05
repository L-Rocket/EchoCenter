import { useCallback, useMemo, useState } from 'react';
import { Bot, Loader2, RefreshCw, Search, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { userService } from '@/services/userService';
import { useChatStore } from '@/store/useChatStore';
import type { Agent, ChatMessage } from '@/types';

type DialogueSource = 'backend' | 'derived' | 'mock';
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
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const buildMockEntries = (agentName: string): DialogueEntry[] => {
  const now = Date.now();
  return [
    {
      id: `mock-${agentName}-1`,
      speaker: 'agent',
      content: `Telemetry for ${agentName} is stable. No critical alerts.`,
      timestamp: new Date(now - 90 * 1000).toISOString(),
    },
    {
      id: `mock-${agentName}-2`,
      speaker: 'butler',
      content: `Confirming routing policy and fallback path for ${agentName}.`,
      timestamp: new Date(now - 3 * 60 * 1000).toISOString(),
    },
    {
      id: `mock-${agentName}-3`,
      speaker: 'agent',
      content: 'Policy confirmed. Last command batch finished successfully.',
      timestamp: new Date(now - 6 * 60 * 1000).toISOString(),
    },
  ];
};

const getSourceLabel = (source: DialogueSource) => {
  if (source === 'backend') return 'Backend';
  if (source === 'derived') return 'Local Derived';
  return 'Mock Fallback';
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

const ButlerDialogueMonitor = ({ butler, agents, className }: ButlerDialogueMonitorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [loadingAgentId, setLoadingAgentId] = useState<number | null>(null);
  const [dialogues, setDialogues] = useState<Record<number, DialogueEntry[]>>({});
  const [sources, setSources] = useState<Record<number, DialogueSource>>({});
  const [notices, setNotices] = useState<Record<number, string>>({});

  const chatMessages = useChatStore((state) => state.messages);

  const monitorAgents = useMemo(() => {
    return agents.filter((agent) => {
      const role = (agent.role || '').toUpperCase();
      return agent.id !== butler.id && role !== 'BUTLER';
    });
  }, [agents, butler.id]);

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

  const getFallbackConversation = useCallback(
    (agent: Agent) => {
      const localMessages = chatMessages[agent.id] || [];
      const derived = mapToDialogueEntries(localMessages, agent.id);
      if (derived.length > 0) {
        return { entries: derived, source: 'derived' as DialogueSource, notice: '' };
      }
      return {
        entries: buildMockEntries(agent.username || `Agent #${agent.id}`),
        source: 'mock' as DialogueSource,
        notice: 'Backend monitor stream is not available yet. Showing simulated timeline.',
      };
    },
    [chatMessages]
  );

  const loadConversation = useCallback(
    async (agent: Agent) => {
      setLoadingAgentId(agent.id);
      let nextSource: DialogueSource = 'mock';
      let entries: DialogueEntry[] = [];
      let nextNotice = '';

      try {
        const backendMessages = await userService.getButlerAgentConversation(agent.id);
        const mapped = mapToDialogueEntries(Array.isArray(backendMessages) ? backendMessages : [], agent.id);
        if (mapped.length > 0) {
          entries = mapped;
          nextSource = 'backend';
        }
      } catch (_err) {
        // backend endpoint not ready yet, fall back below
      }

      if (entries.length === 0) {
        const fallback = getFallbackConversation(agent);
        entries = fallback.entries;
        nextSource = fallback.source;
        nextNotice = fallback.notice;
      }

      setDialogues((prev) => ({ ...prev, [agent.id]: entries }));
      setSources((prev) => ({ ...prev, [agent.id]: nextSource }));
      setNotices((prev) => ({ ...prev, [agent.id]: nextNotice }));
      setLoadingAgentId((prev) => (prev === agent.id ? null : prev));
    },
    [getFallbackConversation]
  );

  const selectedAgent = useMemo(
    () => monitorAgents.find((agent) => agent.id === activeAgentId) ?? null,
    [monitorAgents, activeAgentId]
  );

  const fallbackSelected = useMemo(
    () => (selectedAgent ? getFallbackConversation(selectedAgent) : null),
    [selectedAgent, getFallbackConversation]
  );

  const selectedEntries = selectedAgent ? dialogues[selectedAgent.id] || fallbackSelected?.entries || [] : [];
  const selectedSource = selectedAgent ? sources[selectedAgent.id] || fallbackSelected?.source : undefined;
  const selectedNotice = selectedAgent ? notices[selectedAgent.id] ?? fallbackSelected?.notice ?? '' : '';
  const isLoading = selectedAgent ? loadingAgentId === selectedAgent.id : false;

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
                      <p className="truncate text-xs font-semibold">{agent.username}</p>
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

          <div className="min-h-0 flex flex-col">
            <div className="border-b px-4 py-2.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">
                  {selectedAgent ? `${butler.username} <> ${selectedAgent.username}` : 'No agent selected'}
                </p>
                <p className="text-[10px] text-muted-foreground">Timeline feed</p>
              </div>
              {selectedSource && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {getSourceLabel(selectedSource)}
                </Badge>
              )}
            </div>

            {selectedNotice && (
              <div className="border-b px-4 py-2 text-[10px] text-amber-700 bg-amber-50">{selectedNotice}</div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3 p-4">
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Syncing monitor stream...
                  </div>
                )}

                {!isLoading && selectedEntries.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No monitor messages yet.
                  </div>
                )}

                {!isLoading &&
                  selectedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'max-w-[92%] rounded-lg border px-3 py-2',
                        entry.speaker === 'agent' ? 'ml-auto bg-muted/50' : 'bg-primary/5 border-primary/20'
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {entry.speaker === 'agent' ? <Terminal className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          {entry.speaker === 'agent' ? 'Agent' : 'Butler'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
                      </div>
                      <p className="text-xs leading-relaxed break-words">{entry.content}</p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ButlerDialogueMonitor;
