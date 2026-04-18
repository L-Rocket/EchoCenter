import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react'
import AgentList from '@/components/agent/AgentList'
import ChatView from '@/components/agent/ChatView'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/hooks/useI18n'
import { userService } from '@/services/userService'
import type { Agent, ConversationThread } from '@/types'

const AgentsPage = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [threads, setThreads] = useState<ConversationThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [agentRailCollapsed, setAgentRailCollapsed] = useState(false)
  const [threadRailCollapsed, setThreadRailCollapsed] = useState(false)
  const [contextRailCollapsed, setContextRailCollapsed] = useState(true)
  const { tx } = useI18n()

  useEffect(() => {
    const loadThreads = async () => {
      if (!selectedAgent?.id) {
        setThreads([])
        setSelectedThreadId(null)
        return
      }
      const nextThreads = await userService.listConversationThreads(selectedAgent.id, 'agent_direct')
      setThreads(Array.isArray(nextThreads) ? nextThreads : [])
    }
    void loadThreads()
  }, [selectedAgent?.id])

  const resolvedSelectedThreadId = selectedThreadId && threads.some((thread) => thread.id === selectedThreadId)
    ? selectedThreadId
    : (threads[0]?.id ?? null)

  const selectedThread = threads.find((thread) => thread.id === resolvedSelectedThreadId) ?? null

  const createThread = async () => {
    if (!selectedAgent?.id) return
    const created = await userService.createConversationThread({
      peer_id: selectedAgent.id,
      channel_kind: 'agent_direct',
      title: tx('New Agent Conversation', '新的 Agent 会话'),
    })
    const nextThreads = await userService.listConversationThreads(selectedAgent.id, 'agent_direct')
    setThreads(Array.isArray(nextThreads) ? nextThreads : [])
    setSelectedThreadId(created.id)
  }

  return (
    <div className="h-[calc(100dvh-110px)] min-h-[680px]">
      <div
        className="relative grid h-full min-h-0 gap-4"
        style={{
          gridTemplateColumns: [
            agentRailCollapsed ? '88px' : '280px',
            threadRailCollapsed ? '88px' : '260px',
            'minmax(0, 1fr)',
            contextRailCollapsed ? '0px' : '300px',
          ].join(' '),
        }}
      >
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              {!agentRailCollapsed && (
                <h3 className="text-sm font-bold uppercase tracking-wider">{tx('Agents', 'agent')}</h3>
              )}
              <div className="ml-auto flex items-center gap-2">
                {!agentRailCollapsed && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setAgentRailCollapsed((value) => !value)}
                >
                  {agentRailCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          {!agentRailCollapsed && (
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tx('Search agents', '搜索 agent')}
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>
          )}
          <AgentList 
            onSelectAgent={setSelectedAgent} 
            selectedAgentId={selectedAgent?.id} 
            excludeRoles={['BUTLER']}
            excludeAgentKinds={['openhands_ops']}
            searchQuery={searchQuery}
            compact={agentRailCollapsed}
          />
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              {!threadRailCollapsed && (
                <div>
                  <div className="text-sm font-bold">{tx('Conversations', '会话记录')}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedAgent ? selectedAgent.username : tx('Pick an agent first', '先选择一个 Agent')}
                  </div>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                {!threadRailCollapsed && (
                  <Button
                    size="sm"
                    className="h-9 rounded-xl text-[10px] uppercase tracking-[0.18em]"
                    onClick={createThread}
                    disabled={!selectedAgent}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {tx('New', '新建')}
                  </Button>
                )}
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setThreadRailCollapsed((value) => !value)}
                >
                  {threadRailCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`w-full rounded-2xl border ${threadRailCollapsed ? 'px-3 py-3 text-center' : 'px-4 py-3 text-left'} transition-all ${
                    selectedThreadId === thread.id
                      ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-38px_rgba(255,255,255,0.55)]'
                      : 'border-border/70 bg-background/60 hover:border-border'
                  }`}
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  {threadRailCollapsed ? (
                    <div className="space-y-2">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-xs font-black text-foreground">
                        {(thread.title || 'T').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        #{thread.id}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">{thread.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {thread.summary || tx('A focused workspace for this agent.', '围绕这个 Agent 的专属工作区。')}
                      </div>
                      <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : tx('Fresh thread', '新会话')}
                      </div>
                    </>
                  )}
                </button>
              ))}
              {selectedAgent && threads.length === 0 && (
                threadRailCollapsed ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-2 py-6 text-center text-[10px] text-muted-foreground">
                    {tx('Empty', '空')}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                    {tx('No conversation with this agent yet.', '你和这个 Agent 还没有会话。')}
                  </div>
                )
              )}
            </div>
          </div>
          {threadRailCollapsed && (
            <div className="border-t p-3">
              <Button
                size="icon"
                className="h-10 w-full rounded-2xl"
                onClick={createThread}
                disabled={!selectedAgent}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        <Card className="min-h-0 overflow-hidden">
          {selectedAgent && selectedThread ? (
            <ChatView agent={selectedAgent} thread={selectedThread} renderAssistantAsMarkdown />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl shadow-sm border flex items-center justify-center mb-6 text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">
                {selectedAgent
                  ? tx('Select a Conversation', '请选择一个会话')
                  : tx('Select an Agent', '请选择 agent')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {selectedAgent
                  ? tx('Pick a thread on the left or create a new one for this agent.', '从左侧选择一个会话，或为这个 Agent 创建新会话。')
                  : tx(
                    'Select an autonomous entity from the hive to begin a secure bi-directional transmission.',
                    '从左侧选择一个 agent，开始安全的双向对话。'
                  )}
              </p>
            </div>
          )}
        </Card>

        {!contextRailCollapsed && (
          <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 bg-card/60">
            <div className="border-b px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">
                    {tx('Agent Context', 'Agent 上下文')}
                  </div>
                  <div className="mt-2 text-base font-black">
                    {selectedAgent?.username || tx('No agent selected', '未选择 Agent')}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setContextRailCollapsed(true)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {selectedAgent ? (
                <>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{tx('Role', '角色')}</div>
                    <div className="mt-2 text-sm font-semibold">{selectedAgent.role}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{selectedAgent.description || tx('No description available.', '暂时没有描述。')}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{tx('Runtime', '运行时')}</div>
                    <div className="mt-2 text-sm font-semibold">{selectedAgent.runtime_kind || tx('websocket', 'websocket')}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {selectedAgent.online ? tx('Connected and ready to receive messages.', '当前在线，可直接接收消息。') : tx('Runtime state will appear here while the agent is connected.', 'Agent 连接后，运行态会显示在这里。')}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  {tx('Select an agent to inspect its runtime context.', '选择一个 Agent 以查看它的运行时上下文。')}
                </div>
              )}
            </div>
          </Card>
        )}
        {contextRailCollapsed && (
          <div className="pointer-events-none absolute right-10 top-28 z-10 hidden xl:block">
            <button
              type="button"
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-background/90 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground"
              onClick={() => setContextRailCollapsed(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentsPage
