import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Terminal, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { userService } from '@/services/userService';
import type { OpenHandsTaskRecord } from '@/types';

interface OpenHandsLiveRunCardProps {
  active?: boolean;
}

const OpenHandsLiveRunCard = ({ active = false }: OpenHandsLiveRunCardProps) => {
  const { tx } = useI18n();
  const [tasks, setTasks] = useState<OpenHandsTaskRecord[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const fetchTasks = async () => {
      try {
        const next = await userService.listOpenHandsTasks(6);
        if (!mounted) return;
        const normalized = Array.isArray(next) ? next : [];
        setTasks(normalized);
        const running = normalized.some((task) => String(task.status || '').toLowerCase() === 'running');
        if (running) {
          setExpanded(true);
        }
      } catch (_err) {
        if (mounted) {
          setTasks([]);
        }
      }
    };

    void fetchTasks();
    timer = window.setInterval(() => {
      void fetchTasks();
    }, active ? 1200 : 4000);

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [active]);

  const currentTask = useMemo(() => tasks.find((task) => String(task.status || '').toLowerCase() === 'running') || tasks[0] || null, [tasks]);

  if (!currentTask) return null;

  const status = String(currentTask.status || '').toLowerCase();
  const isRunning = status === 'running';
  const isFailed = status === 'failed';
  if (!isRunning && !active) return null;
  const indicator = isRunning
    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    : isFailed
      ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;

  const preview = (currentTask.live_output || currentTask.summary || currentTask.error || '').trim();

  const collapsedPreview = preview.split('\n').find((line) => line.trim()) || '';

  return (
    <div className="sticky top-4 z-10 rounded-2xl border border-border/70 bg-card/92 shadow-[0_20px_55px_-42px_rgba(0,0,0,0.88)] backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
          <Terminal className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
            {tx('Live Execution', '实时执行')}
          </div>
          <div className="line-clamp-1 text-sm font-semibold">
            {currentTask.current_step || currentTask.task || tx('OpenHands is preparing the task.', 'OpenHands 正在准备任务。')}
          </div>
          {!expanded && collapsedPreview && (
            <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              {collapsedPreview}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {indicator}
          <span>{isRunning ? tx('Running', '执行中') : isFailed ? tx('Failed', '失败') : tx('Ready', '已完成')}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>{currentTask.worker_mode || '--'}</span>
            <span>·</span>
            <span>{currentTask.duration_ms || 0}ms</span>
            {currentTask.updated_at && (
              <>
                <span>·</span>
                <span>{new Date(currentTask.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/25 p-3 text-xs leading-6 text-foreground/90">
            {preview || tx('Waiting for runtime output...', '等待运行时输出...')}
          </pre>
        </div>
      )}
    </div>
  );
};

export default OpenHandsLiveRunCard;
