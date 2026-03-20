import React, { useEffect, useState } from 'react';
import { Terminal, MessageSquare } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types';
import { userService } from '@/services/userService';
import { useAuth } from '@/context/AuthContext';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
  selectedAgentId?: number;
  excludeRoles?: string[];
  excludeAgentKinds?: string[];
  reloadKey?: number;
  searchQuery?: string;
  compact?: boolean;
}

const AgentList: React.FC<AgentListProps> = ({
  onSelectAgent,
  selectedAgentId,
  excludeRoles = [],
  excludeAgentKinds = [],
  reloadKey = 0,
  searchQuery = '',
  compact = false,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { isWsConnected } = useAuth();

  useEffect(() => {
    let alive = true;

    const fetchAgents = async () => {
      try {
        const data = await userService.getAgents();
        if (!alive) return;
        setAgents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      }
    };

    const init = async () => {
      setLoading(true);
      await fetchAgents();
      if (alive) setLoading(false);
    };

    void init();
    const interval = window.setInterval(fetchAgents, 10000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [reloadKey]);

  const normalizedExcludeRoles = excludeRoles.map((role) => role.toUpperCase());
  const normalizedExcludeKinds = excludeAgentKinds.map((kind) => kind.toLowerCase());
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredAgents = agents.filter((agent) => {
    if (normalizedExcludeRoles.includes((agent.role || '').toUpperCase())) {
      return false;
    }
    if (normalizedExcludeKinds.includes((agent.agent_kind || '').toLowerCase())) {
      return false;
    }
    if (!normalizedSearch) return true;
    return (
      (agent.username || '').toLowerCase().includes(normalizedSearch) ||
      (agent.role || '').toLowerCase().includes(normalizedSearch)
    );
  });

  const getDialogueStatus = (agentId: number) => {
    const agent = agents.find((a) => a.id === agentId);
    const status = String(agent?.status || '').toUpperCase();
    const online = agent?.online;

    if (online === true || status === 'ONLINE') {
      return { variant: 'success' as const, pulse: true, label: 'Online' };
    }
    if (status === 'IDLE') {
      return { variant: 'info' as const, pulse: false, label: 'Idle' };
    }
    if (online === false || status === 'OFFLINE') {
      return { variant: 'muted' as const, pulse: false, label: 'Offline' };
    }
    if (!isWsConnected) {
      return { variant: 'warning' as const, pulse: false, label: 'Gateway Down' };
    }
    return { variant: 'muted' as const, pulse: false, label: 'Unknown' };
  };

  if (loading) return <div className="p-4 text-center text-xs text-muted-foreground">Syncing hive...</div>;

  return (
    <div className="flex flex-col divide-y h-full overflow-y-auto border-r">
      {filteredAgents.map((agent) => {
        const dialogueStatus = getDialogueStatus(agent.id);

        return (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={cn(
              `w-full flex items-center ${compact ? 'justify-center px-2 py-4' : 'gap-3 p-4 text-left'} transition-all group`,
              selectedAgentId === agent.id ? "bg-primary/10 border-r-2 border-r-primary" : "hover:bg-accent"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg border shadow-sm transition-colors",
              selectedAgentId === agent.id ? "bg-background border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground group-hover:text-primary"
            )}>
              <Terminal className="h-4 w-4" />
            </div>
            {!compact && (
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-sm font-semibold truncate",
                    selectedAgentId === agent.id ? "text-primary" : "text-foreground"
                  )}>
                    {agent.username}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <StatusIndicator variant={dialogueStatus.variant} pulse={dialogueStatus.pulse} className="h-1.5 w-1.5" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {dialogueStatus.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{agent.role}</span>
                </div>
              </div>
            )}
          </button>
        );
      })}
      {filteredAgents.length === 0 && (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          No active agents detected.
        </div>
      )}
    </div>
  );
};

export default AgentList;
