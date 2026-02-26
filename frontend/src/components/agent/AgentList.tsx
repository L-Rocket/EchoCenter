import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Terminal } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';

const API_BASE_URL = 'http://localhost:8080';

interface Agent {
  id: number;
  username: string;
  role: string;
}

interface AgentListProps {
  onSelectAgent: (agentId: number, username: string) => void;
}

const AgentList: React.FC<AgentListProps> = ({ onSelectAgent }) => {
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

  if (loading) return <div className="text-center py-8 text-slate-500">Scanning for active agents...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {agents.map((agent) => (
        <Card key={agent.id} className="hover:shadow-lg transition-all border-slate-200 overflow-hidden group">
          <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm text-indigo-600">
                  <Terminal className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 truncate max-w-[120px]">
                  {agent.username}
                </CardTitle>
              </div>
              <StatusIndicator variant="success" pulse />
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex justify-between items-center">
            <Badge variant="secondary" className="uppercase text-[10px] font-bold tracking-wider">
              {agent.role}
            </Badge>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2 group-hover:bg-indigo-600 group-hover:text-white transition-all"
              onClick={() => onSelectAgent(agent.id, agent.username)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </Button>
          </CardContent>
        </Card>
      ))}
      {(agents || []).length === 0 && (
        <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-medium italic">No autonomous agents detected in the swarm.</p>
        </div>
      )}
    </div>
  );
};

export default AgentList;
