import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldAlert, SplitSquareVertical } from 'lucide-react';
import ButlerDialogueMonitor from '@/components/butler/ButlerDialogueMonitor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/hooks/useI18n';
import { userService } from '@/services/userService';
import type { Agent } from '@/types';

const DialogueMonitorPage = () => {
  const { tx } = useI18n();
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
        agentList.find((agent) => (agent.role || '').toUpperCase() === 'BUTLER') ||
        agentList.find((agent) => (agent.username || '').toLowerCase() === 'butler');

      setAgents(agentList);
      setButler(butlerAgent ?? null);

      if (!butlerAgent) {
        setError(tx('Butler is not available yet.', 'Butler 暂不可用。'));
      }
    } catch (_err) {
      setError(tx('Failed to load monitor resources.', '加载监控资源失败。'));
      setAgents([]);
      setButler(null);
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  if (loading) {
    return (
      <Card className="flex h-[calc(100dvh-110px)] min-h-[680px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {tx('Loading Dialogue Monitor...', '加载对话监控中...')}
          </span>
        </div>
      </Card>
    );
  }

  if (!butler || error) {
    return (
      <Card className="flex h-[calc(100dvh-110px)] min-h-[680px] items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">{tx('Monitor Unavailable', '监控不可用')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || tx('No Butler instance was found in current agents.', '当前 agent 列表中未找到 Butler 实例。')}
          </p>
          <Button onClick={fetchAgents} variant="outline" className="mt-6">
            {tx('Retry', '重试')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-muted/25 via-background to-background p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
            <SplitSquareVertical className="h-3 w-3" />
            {tx('Dialogue Monitor', '对话监控')}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight lg:text-[2rem]">
              {tx('Butler-Agent Runtime Sidebar', 'Butler-Agent 运行时侧边栏')}
            </h2>
            <p className="max-w-3xl text-[13px] text-muted-foreground">
              {tx(
                'Inspect the hidden coordination channel between Butler and downstream agents without crowding the main conversation workspace.',
                '把 Butler 与下游 Agent 的隐藏协作通道单独拿出来看，不再挤占主对话工作区。'
              )}
            </p>
          </div>
        </div>
      </div>

      <ButlerDialogueMonitor butler={butler} agents={agents} className="h-[calc(100dvh-260px)] min-h-[560px]" />
    </div>
  );
};

export default DialogueMonitorPage;
