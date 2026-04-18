import React, { useEffect, useMemo, useState } from 'react';
import { Braces, CheckCircle2, FileCode2, Loader2, ShieldCheck, Terminal, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { userService } from '@/services/userService';
import { parseOpenHandsWorkflow } from '@/lib/openhands';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';
import type { ChatMessage, OpenHandsTaskRecord } from '@/types';

interface OpenHandsExecutionPanelProps {
  messages: ChatMessage[];
  isPeerPending: boolean;
}

interface ApprovedDirective {
  actionId: string;
  timestamp: string;
  command?: string;
  targetAgentName?: string;
}

const toPayload = (message: ChatMessage): Record<string, unknown> | null => {
  if (typeof message.payload === 'string') {
    try {
      return JSON.parse(message.payload) as Record<string, unknown>;
    } catch (_err) {
      return null;
    }
  }
  return message.payload as Record<string, unknown>;
};

const findLatestApprovedDirective = (messages: ChatMessage[]): ApprovedDirective | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'AUTH_REQUEST') continue;
    const payload = toPayload(message);
    if (!payload) continue;
    if (String(payload.status || '').toUpperCase() !== 'APPROVED') continue;
    return {
      actionId: String(payload.action_id || ''),
      timestamp: message.timestamp,
      command: typeof payload.command === 'string' ? payload.command : undefined,
      targetAgentName: typeof payload.target_agent_name === 'string' ? payload.target_agent_name : undefined,
    };
  }
  return null;
};

const pickTaskForDirective = (tasks: OpenHandsTaskRecord[], directive: ApprovedDirective | null) => {
  if (tasks.length === 0) return null;
  if (!directive?.timestamp) return tasks[0];

  const approvedAt = new Date(directive.timestamp).getTime();
  if (Number.isNaN(approvedAt)) return tasks[0];

  return tasks.find((task) => {
    const startedAt = new Date(task.started_at).getTime();
    const finishedAt = new Date(task.finished_at).getTime();
    return startedAt >= approvedAt - 30_000 || finishedAt >= approvedAt - 30_000;
  }) || tasks[0];
};

const OpenHandsExecutionPanel: React.FC<OpenHandsExecutionPanelProps> = ({ messages, isPeerPending }) => {
  const { tx } = useI18n();
  const [tasks, setTasks] = useState<OpenHandsTaskRecord[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  const approvedDirective = useMemo(() => findLatestApprovedDirective(messages), [messages]);
  const currentTask = useMemo(
    () => pickTaskForDirective(tasks, approvedDirective),
    [approvedDirective, tasks]
  );
  const workflow = useMemo(
    () => (currentTask ? parseOpenHandsWorkflow(currentTask).slice(0, 4) : []),
    [currentTask]
  );

  const shouldShow = Boolean(approvedDirective || currentTask || isPeerPending);

  useEffect(() => {
    if (!shouldShow) {
      setTasks([]);
      setIsPolling(false);
      return;
    }

    let mounted = true;

    const fetchTasks = async () => {
      try {
        setIsPolling(true);
        const next = await userService.listOpenHandsTasks(6);
        if (mounted) {
          setTasks(Array.isArray(next) ? next : []);
        }
      } catch (_err) {
        if (mounted) {
          setTasks([]);
        }
      } finally {
        if (mounted) {
          setIsPolling(false);
        }
      }
    };

    void fetchTasks();
    const intervalId = window.setInterval(() => {
      void fetchTasks();
    }, isPeerPending ? 2500 : 6000);

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isPeerPending, shouldShow]);

  if (!shouldShow) return null;

  const stages = [
    {
      key: 'approval',
      label: tx('Approval', '审批'),
      description: approvedDirective
        ? tx('Directive approved and released to runtime.', '指令已批准，准备交给运行时执行。')
        : tx('Waiting for approval before execution can start.', '需要先批准，执行才能开始。'),
      state: approvedDirective ? 'done' : 'active',
      icon: ShieldCheck,
    },
    {
      key: 'dispatch',
      label: tx('Dispatch', '派发'),
      description: currentTask
        ? tx('Butler handed the task to OpenHands.', 'Butler 已经把任务交给 OpenHands。')
        : tx('Waiting for OpenHands to claim the delegated task.', '等待 OpenHands 接管这次委派任务。'),
      state: currentTask ? 'done' : approvedDirective ? 'active' : 'idle',
      icon: Wrench,
    },
    {
      key: 'execution',
      label: tx('Execution', '执行'),
      description: currentTask
        ? tx('OpenHands finished at least one execution pass.', 'OpenHands 已完成至少一轮执行。')
        : tx('Runtime has not produced a task record yet.', '运行时尚未产出任务记录。'),
      state: currentTask ? 'done' : approvedDirective ? 'active' : 'idle',
      icon: Terminal,
    },
    {
      key: 'reply',
      label: tx('Butler Reply', 'Butler 汇总'),
      description: isPeerPending
        ? tx('Butler is still assembling the final response.', 'Butler 正在整理最终回复。')
        : tx('Final response can be sent back to the chat stream.', '最终回复已经可以回到聊天流里。'),
      state: isPeerPending ? 'active' : currentTask ? 'done' : 'idle',
      icon: CheckCircle2,
    },
  ] as const;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[680px] rounded-[24px] border border-primary/20 bg-gradient-to-br from-card via-card to-muted/30 p-4 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.85)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                {tx('Execution Session', '执行会话')}
              </span>
            </div>
            <div className="text-sm font-bold">
              {approvedDirective?.targetAgentName
                ? tx(`Working through ${approvedDirective.targetAgentName}`, `正在通过 ${approvedDirective.targetAgentName} 执行`)
                : tx('OpenHands runtime is handling this request', 'OpenHands 运行时正在处理这次请求')}
            </div>
            <div className="text-xs text-muted-foreground">
              {approvedDirective?.command || tx('Waiting for the delegated command payload.', '等待具体的委派命令载荷。')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
              {isPeerPending ? tx('Running', '执行中') : tx('Ready', '已就绪')}
            </Badge>
            <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
              {isPolling ? tx('Syncing', '同步中') : tx('Live', '实时')}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.state === 'active';
            const isDone = stage.state === 'done';
            return (
              <div
                key={stage.key}
                className={cn(
                  'rounded-2xl border p-3 transition-all',
                  isDone && 'border-emerald-300/70 bg-emerald-500/10',
                  isActive && 'border-primary/30 bg-primary/10',
                  stage.state === 'idle' && 'border-border/70 bg-background/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border',
                    isDone && 'border-emerald-300 bg-emerald-500/10 text-emerald-600',
                    isActive && 'border-primary/30 bg-primary/10 text-primary',
                    stage.state === 'idle' && 'border-border/70 bg-muted/20 text-muted-foreground'
                  )}>
                    {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stage.label}</div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {stage.description}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-background/65 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              {tx('Recent Runtime Output', '近期运行输出')}
            </div>
            {currentTask && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {currentTask.worker_mode || '--'} · {currentTask.duration_ms}ms
              </div>
            )}
          </div>
          {workflow.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
              {tx('No task output yet. As soon as OpenHands writes logs or a result file, the latest steps will appear here.', '还没有拿到任务输出。一旦 OpenHands 写出日志或结果文件，最新步骤会显示在这里。')}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {workflow.map((step, index) => (
                <div key={`${step.title}-${index}`} className="rounded-xl border border-border/60 bg-card/70 p-3">
                  <div className="flex items-center gap-2">
                    {step.kind === 'code' && <FileCode2 className="h-3.5 w-3.5 text-violet-500" />}
                    {step.kind === 'command' && <Terminal className="h-3.5 w-3.5 text-sky-500" />}
                    {step.kind === 'stdout' && <Braces className="h-3.5 w-3.5 text-emerald-500" />}
                    {step.kind === 'stderr' && <Wrench className="h-3.5 w-3.5 text-amber-500" />}
                    {step.kind === 'result' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{step.title}</div>
                  </div>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/20 p-3 text-xs text-foreground/90">
                    {step.body}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenHandsExecutionPanel;
