import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, RotateCcw, Filter, Bot, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import type { LogFilterState } from '@/pages/DashboardPage';

const API_BASE_URL = 'http://localhost:8080';

interface LogFilterBarProps {
  filters: LogFilterState;
  onFilterChange: (filters: LogFilterState) => void;
}

interface Agent {
  id: number;
  username: string;
}

const LogFilterBar: React.FC<LogFilterBarProps> = ({ filters, onFilterChange }) => {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users/agents`);
        setAgents(Array.isArray(response.data) ? response.data : []);
      } catch (_err) {
        console.error('Failed to fetch agents for filter:', err);
      }
    };
    fetchAgents();
  }, []);

  const handleReset = () => {
    onFilterChange({
      agentID: '',
      level: '',
      query: '',
    });
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="relative w-full lg:w-72">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search logs..."
          className="pl-10 h-10 bg-muted/50 border focus:bg-background transition-all"
          value={filters.query}
          onChange={(e) => onFilterChange({ ...filters, query: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">
          <Filter className="h-3 w-3" />
          Refine
        </div>

        <Select
          value={filters.agentID || "all"}
          onValueChange={(val) => onFilterChange({ ...filters, agentID: val === "all" ? "" : val })}
        >
          <SelectTrigger className="w-[160px] h-10 bg-muted/50 border">
            <Bot className="h-3.5 w-3.5 text-primary mr-2" />
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.username}>
                {agent.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.level || "all"}
          onValueChange={(val) => onFilterChange({ ...filters, level: val === "all" ? "" : val })}
        >
          <SelectTrigger className="w-[140px] h-10 bg-muted/50 border">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 mr-2" />
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARNING">WARNING</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>

        {(filters.agentID || filters.level || filters.query) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-primary gap-2 h-10 px-3"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};

export default LogFilterBar;
