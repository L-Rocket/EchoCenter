import React, { useState, useEffect } from 'react'
import { Search, Filter, RefreshCw, Cpu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LogFilterState } from '@/pages/DashboardPage'
import type { Agent } from '@/types'
import { userService } from '@/services/userService'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

interface LogFilterBarProps {
  filters: LogFilterState;
  onFilterChange: (filters: LogFilterState) => void;
}

const LogFilterBar: React.FC<LogFilterBarProps> = ({ filters, onFilterChange }) => {
  const { tx } = useI18n()
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoadingAgents(true)
        const data = await userService.getAgents()
        setAgents(Array.isArray(data) ? data : [])
      } catch (_err) {
        console.error("Failed to fetch agents for filter:", _err)
      } finally {
        setIsLoadingAgents(false)
      }
    }
    fetchAgents()
  }, [])

  const handleAgentChange = (value: string) => {
    onFilterChange({ ...filters, agentID: value === 'all' ? '' : value })
  }

  const handleLevelChange = (value: string) => {
    onFilterChange({ ...filters, level: value === 'all' ? '' : value })
  }

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, query: e.target.value })
  }

  const activeFiltersCount = [filters.agentID, filters.level].filter(Boolean).length

  return (
    <div className="flex flex-col gap-4 bg-card/50 backdrop-blur-md p-4 rounded-2xl border-2 shadow-xl animate-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tx('Search system logs...', '搜索系统日志...')}
            className="pl-10 h-10 bg-muted/50 border-2 focus:border-primary transition-all rounded-xl font-medium"
            value={filters.query}
            onChange={handleQueryChange}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={filters.agentID || 'all'} onValueChange={handleAgentChange}>
            <SelectTrigger className="w-full md:w-[180px] h-10 bg-muted/50 border-2 rounded-xl font-bold uppercase tracking-widest text-[10px]">
              <div className="flex items-center gap-2">
                <Cpu className={cn("h-3.5 w-3.5 text-primary", isLoadingAgents && "animate-spin")} />
                <SelectValue placeholder={tx('All Units', '全部单元')} />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2 uppercase font-black text-[10px]">
              <SelectItem value="all">{tx('ALL UNITS', '全部单元')}</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.username}>
                  {agent.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.level || 'all'} onValueChange={handleLevelChange}>
            <SelectTrigger className="w-full md:w-[140px] h-10 bg-muted/50 border-2 rounded-xl font-bold uppercase tracking-widest text-[10px]">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder={tx('All Levels', '全部等级')} />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2 uppercase font-black text-[10px]">
              <SelectItem value="all">{tx('ALL LEVELS', '全部等级')}</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARNING">WARNING</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onFilterChange({ agentID: '', level: '', query: '' })}
            className="h-10 w-10 shrink-0 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
            disabled={!filters.agentID && !filters.level && !filters.query}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{tx('Active Filters:', '当前筛选：')}</span>
          {filters.agentID && (
            <Badge variant="secondary" className="h-5 gap-1 rounded-md text-[9px] font-black uppercase px-2 bg-primary/10 text-primary border-none">
              {tx('Unit', '单元')}: {filters.agentID}
            </Badge>
          )}
          {filters.level && (
            <Badge variant="secondary" className="h-5 gap-1 rounded-md text-[9px] font-black uppercase px-2 bg-primary/10 text-primary border-none">
              {tx('Level', '等级')}: {filters.level}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

export default LogFilterBar
