import React, { useEffect, useState } from 'react';
import { Terminal, MessageSquare } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types';
import { userService } from '@/services/userService';
import { useAuth } from '@/context/AuthContext';
import { useChatStore } from '@/store/useChatStore';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
  selectedAgentId?: number;
  excludeRoles?: string[];
  reloadKey?: number;
  searchQuery?: string;
}

const AgentList: React.FC<AgentListProps> = ({
  onSelectAgent,
  selectedAgentId,
  excludeRoles = [],
  reloadKey = 0,
  searchQuery = '',
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { isWsConnected } = useAuth();
  const chatMessages = useChatStore((state) => state.messages);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await userService.getAgents();
        setAgents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [reloadKey]);

  const normalizedExcludeRoles = excludeRoles.map((role) => role.toUpperCase());
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredAgents = agents.filter((agent) => {
    if (normalizedExcludeRoles.includes((agent.role || '').toUpperCase())) {
      return false;
    }
    if (!normalizedSearch) return true;
    return (
      (agent.username || '').toLowerCase().includes(normalizedSearch) ||
      (agent.role || '').toLowerCase().includes(normalizedSearch)
    );
  });

  const getDialogueStatus = (agentId: number) => {
    if (!isWsConnected) {
      return { variant: 'warning' as const, pulse: false, label: 'Gateway Down' };
    }

    const conversation = chatMessages[agentId] || [];
    const latestAgentReply = [...conversation]
      .reverse()
      .find(
        (msg) =>
          msg.sender_id === agentId &&
          (msg.type === 'CHAT' || msg.type === 'CHAT_STREAM' || msg.type === 'CHAT_STREAM_END')
      );

    if (!latestAgentReply?.timestamp) {
      return { variant: 'muted' as const, pulse: false, label: 'No Dialogue' };
    }

    const lastReplyAt = new Date(latestAgentReply.timestamp).getTime();
    if (Number.isNaN(lastReplyAt)) {
      return { variant: 'muted' as const, pulse: false, label: 'Unknown' };
    }

    const elapsed = Date.now() - lastReplyAt;
    if (elapsed <= 5 * 60 * 1000) {
      return { variant: 'success' as const, pulse: true, label: 'Online' };
    }
    if (elapsed <= 30 * 60 * 1000) {
      return { variant: 'info' as const, pulse: false, label: 'Idle' };
    }
    return { variant: 'muted' as const, pulse: false, label: 'Offline' };
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
              "w-full flex items-center gap-3 p-4 text-left transition-all group",
              selectedAgentId === agent.id ? "bg-primary/10 border-r-2 border-r-primary" : "hover:bg-accent"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg border shadow-sm transition-colors",
              selectedAgentId === agent.id ? "bg-background border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground group-hover:text-primary"
            )}>
              <Terminal className="h-4 w-4" />
            </div>
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
