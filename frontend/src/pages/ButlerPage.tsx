import { useEffect, useState } from 'react'
import { Bot, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import ChatView from '@/components/agent/ChatView'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { userService } from '@/services/userService'
import type { Agent } from '@/types'

const ButlerPage = () => {
  const [butler, setButler] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchButler = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await userService.getAgents()
      const agents = Array.isArray(data) ? data : []
      const butlerAgent =
        agents.find((agent) => (agent.role || '').toUpperCase() === 'BUTLER') ||
        agents.find((agent) => (agent.username || '').toLowerCase() === 'butler')

      if (!butlerAgent) {
        setError('Butler is not available yet.')
        setButler(null)
      } else {
        setButler(butlerAgent)
      }
    } catch (_err) {
      setError('Failed to load Butler channel.')
      setButler(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchButler()
  }, [])

  if (loading) {
    return (
      <Card className="h-[calc(100dvh-220px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linking Butler Channel...</span>
        </div>
      </Card>
    )
  }

  if (!butler || error) {
    return (
      <Card className="h-[calc(100dvh-220px)] flex items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Butler Unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || 'No Butler instance was found in current agents.'}
          </p>
          <Button onClick={fetchButler} variant="outline" className="mt-6">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-[calc(100dvh-220px)] overflow-hidden flex flex-col md:flex-row">
      <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-5">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" />
            Core Channel
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border bg-primary/10 p-2 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">{butler.username}</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chief Butler</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Dedicated control channel for planning, orchestration, and high-level commands.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Priority Link Active
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow min-w-0">
        <ChatView agent={butler} />
      </div>
    </Card>
  )
}

export default ButlerPage
