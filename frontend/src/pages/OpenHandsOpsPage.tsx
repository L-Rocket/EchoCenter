import { useCallback, useEffect, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Loader2, Plus, ShieldAlert, Wrench } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { userService } from '@/services/userService';
import type { Agent, ConversationThread } from '@/types';

const OpenHandsOpsPage = () => {
  const { tx } = useI18n();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const fetchAgent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await userService.getAgents();
      const agentList = Array.isArray(data) ? data : [];
      const opsAgent =
        agentList.find((item) => item.agent_kind === 'openhands_ops') ||
        agentList.find((item) => (item.username || '').toLowerCase() === 'openhands-ops');

      setAgent(opsAgent ?? null);
      if (opsAgent?.id) {
        const nextThreads = await userService.listConversationThreads(opsAgent.id, 'agent_direct');
        setThreads(Array.isArray(nextThreads) ? nextThreads : []);
      } else {
        setThreads([]);
      }
      if (!opsAgent) {
        setError(tx('OpenHands Ops is not available yet.', 'OpenHands Ops 暂不可用。'));
      }
    } catch (_err) {
      setError(tx('Failed to load OpenHands Ops workspace.', '加载 OpenHands Ops 工作区失败。'));
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  useEffect(() => {
    if (threads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const createThread = async () => {
    if (!agent?.id) return;
    const created = await userService.createConversationThread({
      peer_id: agent.id,
      channel_kind: 'agent_direct',
      title: tx('New Operator Conversation', '新的运维官会话'),
    });
    const nextThreads = await userService.listConversationThreads(agent.id, 'agent_direct');
    setThreads(Array.isArray(nextThreads) ? nextThreads : []);
    setSelectedThreadId(created.id);
  };

  return (
    <div className="h-[calc(100dvh-110px)] min-h-[680px]">
      {loading ? (
        <Card className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {tx('Loading Operator Workspace...', '加载运维官工作区中...')}
            </span>
          </div>
        </Card>
      ) : !agent || error ? (
        <Card className="flex h-full items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">{tx('Operator Unavailable', '运维官不可用')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || tx('No OpenHands Ops runtime was found in current agents.', '当前 agent 列表中未找到 OpenHands Ops 运行时。')}
            </p>
            <Button onClick={fetchAgent} variant="outline" className="mt-6">
              {tx('Retry', '重试')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className={`grid h-full min-h-0 gap-4 ${sidebarCollapsed ? 'xl:grid-cols-[82px_minmax(0,1fr)]' : 'xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
          <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 bg-card/60">
            <div className="border-b px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                {!sidebarCollapsed && (
                  <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary/85">
                    <Wrench className="h-3 w-3" />
                    {tx('Operator Workspace', '运维官工作区')}
                  </div>
                )}
                <button
                  type="button"
                  className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              </div>
              <div className={`mt-4 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border bg-primary/10 p-2 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div>
                      <div className="text-sm font-bold">{tx('Operator', '运维官')}</div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {agent.username}
                      </div>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <Button onClick={createThread} size="sm" className="h-9 rounded-xl text-[10px] uppercase tracking-[0.18em]">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {tx('New', '新建')}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={cn(
                      `w-full rounded-2xl border ${sidebarCollapsed ? 'px-3 py-3 text-center' : 'px-4 py-3 text-left'} transition-all`,
                      selectedThreadId === thread.id
                        ? 'border-primary/40 bg-primary/5 shadow-[0_18px_50px_-42px_rgba(255,255,255,0.4)]'
                        : 'border-border/70 bg-background/50 hover:border-border hover:bg-background/70'
                    )}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    {sidebarCollapsed ? (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-xs font-black text-foreground">
                          {(thread.title || 'T').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          #{thread.id}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="line-clamp-1 text-sm font-semibold">{thread.title}</div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                          {thread.summary || tx('Direct workstream with the OpenHands operator.', '与 OpenHands 运维官的直接工作流。')}
                        </div>
                        <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : tx('Fresh thread', '新会话')}
                        </div>
                      </>
                    )}
                  </button>
                ))}
                {threads.length === 0 && (
                  sidebarCollapsed ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-2 py-6 text-center text-[10px] text-muted-foreground">
                      {tx('Empty', '空')}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                      {tx('No operator conversation yet. Create one to get started.', '还没有运维官会话，先创建一个开始吧。')}
                    </div>
                  )
                )}
              </div>
            </div>
            {sidebarCollapsed && (
              <div className="border-t p-3">
                <Button onClick={createThread} size="icon" className="h-10 w-full rounded-2xl">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>

          <Card className="min-h-0 overflow-hidden border-border/70 bg-background">
            {selectedThread ? (
              <ChatView agent={agent} thread={selectedThread} renderAssistantAsMarkdown />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-sm space-y-3 px-8">
                  <div className="text-lg font-bold">{tx('Pick an operator thread', '选择一个运维官会话')}</div>
                  <p className="text-sm text-muted-foreground">
                    {tx('Use the left rail to resume an existing operator session or create a new one.', '使用左侧会话栏恢复已有运维官会话，或创建一个新的会话。')}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default OpenHandsOpsPage;
