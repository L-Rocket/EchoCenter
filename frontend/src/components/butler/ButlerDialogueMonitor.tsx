import { useCallback, useMemo, useState } from 'react';
import { Bot, Loader2, RefreshCw, Search, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/hooks/useI18n';
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

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

const ButlerDialogueMonitor = ({ butler, agents, className }: ButlerDialogueMonitorProps) => {
  const { tx } = useI18n();
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
        notice: tx(
          'Backend monitor stream is not available yet. Showing simulated timeline.',
          '后端监控流暂不可用，当前展示模拟时间线。'
        ),
      };
    },
    [chatMessages, tx]
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
            <CardTitle className="text-sm font-bold uppercase tracking-wider">{tx('Agent Dialogue Monitor', 'agent 对话监控')}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Observe Butler to Agent execution conversations.', '查看 Butler 与 agent 之间的执行对话。')}
            </p>
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
            {tx('Refresh', '刷新')}
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
                  placeholder={tx('Search agents', '搜索 agent')}
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
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{tx(`Agent #${agent.id}`, `agent #${agent.id}`)}</p>
                    </button>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">{tx('No agents available.', '暂无可用 agent。')}</div>
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
                    {selectedAgent ? `${butler.username} ${tx('and', '与')} ${selectedAgent.username}` : tx('No agent selected', '未选择 agent')}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {tx('Monitor Feed', '监控流')}
                    </span>
                  </div>
                </div>
              </div>
              {selectedSource && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                  {selectedSource === 'backend'
                    ? tx('Backend', '后端')
                    : selectedSource === 'derived'
                      ? tx('Local Derived', '本地推导')
                      : tx('Mock Fallback', '模拟回退')}
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
                      {tx('Syncing monitor stream...', '同步监控流中...')}
                    </div>
                  </div>
                )}

                {!isLoading && selectedEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
                    <div className="p-4 bg-muted rounded-full mb-4">
                      <Terminal className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      {tx('No Monitor Messages', '暂无监控消息')}
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
                            {`${isAgent ? tx('Agent', 'agent') : 'Butler'} · ${formatTime(entry.timestamp)}`}
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
                    {tx('Read-Only Monitor Mode', '只读监控模式')}
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {tx('No Input', '不可输入')}
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
