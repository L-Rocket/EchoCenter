import { useState, useEffect, useCallback } from 'react'
import MessageList from '@/components/log/MessageList'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Terminal, Activity, ChevronDown } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/button'
import LogFilterBar from '@/components/log/LogFilterBar'
import { useI18n } from '@/hooks/useI18n'
import type { LogMessage } from '@/types'
import { messageService } from '@/services/messageService'

export interface LogFilterState {
  agentID: string;
  level: string;
  query: string;
}

const DashboardPage = () => {
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogFilterState>({
    agentID: '',
    level: '',
    query: '',
  })
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  const debouncedQuery = useDebounce(filters.query, 500)
  const { logout, wsLogs, isWsConnected } = useAuth()
  const { tx } = useI18n()

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const currentOffset = isLoadMore ? offset : 0;
      
      const data = await messageService.getMessages({
        agent_id: filters.agentID,
        level: filters.level,
        q: debouncedQuery,
        offset: currentOffset,
        limit: 50
      })

      const newMessages = Array.isArray(data) ? data : []
      
      if (isLoadMore) {
        setMessages(prev => [...prev, ...newMessages])
        setOffset(prev => prev + newMessages.length)
      } else {
        setMessages(newMessages)
        setOffset(newMessages.length)
      }

      setHasMore(newMessages.length === 50)
      setLoading(false)
      setLoadingMore(false)
      setError(null)
    } catch (err) {
      const axiosError = err as { response?: { status: number } };
      if (axiosError.response?.status === 401) {
        logout()
      }
      console.error("Failed to fetch messages:", err)
      setError(tx("Failed to connect to backend.", "连接后端失败。"))
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters.agentID, filters.level, debouncedQuery, offset, logout, tx])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMessages(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [filters.agentID, filters.level, debouncedQuery, fetchMessages])

  useEffect(() => {
    const isFiltering = filters.agentID || filters.level || debouncedQuery;
    if (!isFiltering && wsLogs.length > 0) {
      const timer = setTimeout(() => {
        setMessages(prev => {
          const latest = wsLogs[0] as unknown as LogMessage;
          if (latest && !prev.some(m => m.id === latest.id)) {
            return [latest, ...prev].slice(0, 50);
          }
          return prev;
        });
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [wsLogs, filters.agentID, filters.level, debouncedQuery])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(true)
    }
  }

  return (
    <div className="space-y-6">
      <LogFilterBar filters={filters} onFilterChange={setFilters} />
      
      {!isWsConnected && (
        <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-lg border border-amber-500/20 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider animate-in fade-in duration-300">
          <Activity className="h-3 w-3 animate-pulse" />
          {tx('Link unstable: Reconnecting to hive...', '链路不稳定：正在重连...')}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 flex items-center gap-3 text-sm font-medium">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{tx('System Logs', '系统日志')}</h2>
          <p className="text-sm text-muted-foreground">{tx('Autonomous status feed from the Echo hive.', 'Echo 集群运行状态流。')}</p>
        </div>
        <Badge variant="outline" className="h-7 gap-1 px-3 font-medium">
          <Terminal className="h-3 w-3 text-primary" />
          {loading ? tx('Syncing...', '同步中...') : tx(`${messages.length} Records Loaded`, `已加载 ${messages.length} 条`)}
        </Badge>
      </div>

      <MessageList messages={messages} />

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="outline" 
            onClick={handleLoadMore} 
            disabled={loadingMore}
            className="w-full max-w-xs gap-2"
          >
            {loadingMore ? (
              <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {tx('Load More History', '加载更多历史')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
