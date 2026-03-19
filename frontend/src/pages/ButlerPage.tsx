import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Plus, ShieldAlert, Sparkles } from 'lucide-react';
import ChatView from '@/components/agent/ChatView';
import ButlerDialogueMonitor from '@/components/butler/ButlerDialogueMonitor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { userService } from '@/services/userService';
import type { Agent, ConversationThread } from '@/types';

const ButlerPage = () => {
  const { tx } = useI18n();
  const [butler, setButler] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
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
      if (butlerAgent?.id) {
        const nextThreads = await userService.listConversationThreads(butlerAgent.id, 'butler_direct');
        setThreads(Array.isArray(nextThreads) ? nextThreads : []);
      } else {
        setThreads([]);
      }
      if (!butlerAgent) {
        setError(tx('Butler is not available yet.', 'Butler 暂不可用。'));
      }
    } catch (_err) {
      setError(tx('Failed to load Butler channel.', '加载 Butler 通道失败。'));
      setButler(null);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (threads.length === 0) {
      setSelectedThreadId(null);
      return
    }
    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id)
    }
  }, [selectedThreadId, threads])

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null

  const createThread = async () => {
    if (!butler?.id) return
    const created = await userService.createConversationThread({
      peer_id: butler.id,
      channel_kind: 'butler_direct',
      title: tx('New Butler Conversation', '新的 Butler 会话'),
    })
    const nextThreads = await userService.listConversationThreads(butler.id, 'butler_direct')
    setThreads(Array.isArray(nextThreads) ? nextThreads : [])
    setSelectedThreadId(created.id)
  }

  return (
    <div className="h-[calc(100dvh-110px)] min-h-[680px]">
      {loading ? (
        <Card className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Loading Butler Channel...', '加载 Butler 通道中...')}</span>
          </div>
        </Card>
      ) : !butler || error ? (
        <Card className="flex h-full items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">{tx('Butler Unavailable', 'Butler 不可用')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || tx('No Butler instance was found in current agents.', '当前 agent 列表中未找到 Butler 实例。')}
            </p>
            <Button onClick={fetchAgents} variant="outline" className="mt-6">
              {tx('Retry', '重试')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 bg-card/60">
            <div className="border-b px-5 py-4">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3 w-3" />
                {tx('Butler Workspace', 'Butler 工作区')}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border bg-primary/10 p-2 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{butler.username}</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {tx('Chief Butler', '首席管家')}
                    </div>
                  </div>
                </div>
                <Button onClick={createThread} size="sm" className="h-9 rounded-xl text-[10px] uppercase tracking-[0.18em]">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {tx('New', '新建')}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                      selectedThreadId === thread.id
                        ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-38px_rgba(255,255,255,0.55)]'
                        : 'border-border/70 bg-background/60 hover:border-border'
                    )}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <div className="text-sm font-semibold">{thread.title}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {thread.summary || tx('Direct conversation with Butler.', '与你的 Butler 直接对话。')}
                    </div>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : tx('Fresh thread', '新会话')}
                    </div>
                  </button>
                ))}
                {threads.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                    {tx('No Butler conversation yet. Create one to get started.', '还没有 Butler 会话，先创建一个开始吧。')}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="min-h-0 overflow-hidden border-border/70 bg-background">
            {selectedThread ? (
              <ChatView agent={butler} thread={selectedThread} renderAssistantAsMarkdown showRuntimePanel />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-sm space-y-3 px-8">
                  <div className="text-lg font-bold">{tx('Pick a Butler thread', '选择一个 Butler 会话')}</div>
                  <p className="text-sm text-muted-foreground">
                    {tx('Use the left rail to resume an existing conversation or create a new one.', '使用左侧会话栏恢复已有对话，或创建一个新的会话。')}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <div className="flex min-h-0 flex-col gap-4">
            <Card className="border-border/70 bg-card/60 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">
                {tx('Runtime Context', '运行时上下文')}
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-base font-black">{tx('Butler stays conversational; execution stays inspectable.', 'Butler 负责对话，执行链路保持可观测。')}</div>
                <p className="text-sm text-muted-foreground">
                  {tx('The main canvas focuses on your conversation, while the side rail keeps approvals and delegated execution visible without interrupting reading.', '主画布聚焦你的对话，右侧栏则保留审批和委派执行，不打断阅读。')}
                </p>
              </div>
            </Card>
            <ButlerDialogueMonitor butler={butler} agents={agents} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ButlerPage;
