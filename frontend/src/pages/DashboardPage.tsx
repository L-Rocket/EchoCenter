import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import MessageList from '@/components/MessageList'
import type { Message } from '@/components/MessageRow'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Terminal, Activity, ChevronDown } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/button'
import LogFilterBar from '@/components/LogFilterBar'

const API_BASE_URL = 'http://localhost:8080'

export interface LogFilterState {
  agentID: string;
  level: string;
  query: string;
}

const DashboardPage = () => {
  const [messages, setMessages] = useState<Message[]>([])
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

  const fetchMessages = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const currentOffset = isLoadMore ? offset : 0;
      
      const response = await axios.get<Message[]>(`${API_BASE_URL}/api/messages`, {
        params: {
          agent_id: filters.agentID,
          level: filters.level,
          q: debouncedQuery,
          offset: currentOffset,
          limit: 50
        }
      })

      const newMessages = Array.isArray(response.data) ? response.data : []
      
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
    } catch (_err: any) {
      if (err.response?.status === 401) {
        logout()
      }
      console.error("Failed to fetch messages:", err)
      setError("Failed to connect to backend.")
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters.agentID, filters.level, debouncedQuery, offset, logout])

  useEffect(() => {
    // Avoid synchronous setState in effect
    const timer = setTimeout(() => {
      fetchMessages(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [filters.agentID, filters.level, debouncedQuery, fetchMessages])

  useEffect(() => {
    const isFiltering = filters.agentID || filters.level || debouncedQuery;
    if (!isFiltering && wsLogs.length > 0) {
      // Avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setMessages(prev => {
          const _latest = wsLogs[0];
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
          Link unstable: Reconnecting to hive...
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
          <h2 className="text-2xl font-bold tracking-tight">System Logs</h2>
          <p className="text-sm text-muted-foreground">Autonomous status feed from the Echo hive.</p>
        </div>
        <Badge variant="outline" className="h-7 gap-1 px-3 font-medium">
          <Terminal className="h-3 w-3 text-primary" />
          {loading ? "Syncing..." : `${messages.length} Records Loaded`}
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
            Load More History
          </Button>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
