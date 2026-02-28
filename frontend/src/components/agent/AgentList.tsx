import React, { useEffect, useState } from 'react';
import { Terminal, MessageSquare } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';
import { Agent } from '@/types';
import { userService } from '@/services/userService';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
  selectedAgentId?: number;
}

const AgentList: React.FC<AgentListProps> = ({ onSelectAgent, selectedAgentId }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  if (loading) return <div className="p-4 text-center text-xs text-muted-foreground">Syncing hive...</div>;

  return (
    <div className="flex flex-col divide-y h-full overflow-y-auto border-r">
      {agents.map((agent) => (
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
              <StatusIndicator variant="success" className="h-1.5 w-1.5" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{agent.role}</span>
            </div>
          </div>
        </button>
      ))}
      {(agents || []).length === 0 && (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          No active agents detected.
        </div>
      )}
    </div>
  );
};

export default AgentList;
