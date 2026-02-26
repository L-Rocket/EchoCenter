import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Terminal, MessageSquare } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';

const API_BASE_URL = 'http://localhost:8080';

export interface Agent {
  id: number;
  username: string;
  role: string;
}

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
        const response = await axios.get(`${API_BASE_URL}/api/users/agents`);
        setAgents(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  if (loading) return <div className="p-4 text-center text-xs text-slate-400">Syncing hive...</div>;

  return (
    <div className="flex flex-col divide-y divide-slate-100 h-full overflow-y-auto bg-white border-r">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={cn(
            "w-full flex items-center gap-3 p-4 text-left transition-all hover:bg-slate-50 group",
            selectedAgentId === agent.id ? "bg-indigo-50/50 border-r-2 border-r-indigo-600" : ""
          )}
        >
          <div className={cn(
            "p-2 rounded-lg border shadow-sm transition-colors",
            selectedAgentId === agent.id ? "bg-white border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:text-indigo-500"
          )}>
            <Terminal className="h-4 w-4" />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "text-sm font-semibold truncate",
                selectedAgentId === agent.id ? "text-indigo-900" : "text-slate-700"
              )}>
                {agent.username}
              </span>
              <StatusIndicator variant="success" className="h-1.5 w-1.5" />
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MessageSquare className="h-3 w-3 text-slate-300" />
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{agent.role}</span>
            </div>
          </div>
        </button>
      ))}
      {(agents || []).length === 0 && (
        <div className="p-8 text-center text-xs text-slate-400 italic">
          No active agents detected.
        </div>
      )}
    </div>
  );
};

export default AgentList;
