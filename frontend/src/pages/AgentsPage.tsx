import { useState } from 'react'
import { MessageSquare, Search, ShieldAlert } from 'lucide-react'
import AgentList from '@/components/agent/AgentList'
import ChatView from '@/components/agent/ChatView'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/hooks/useI18n'
import type { Agent } from '@/types'

const AgentsPage = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { tx } = useI18n()

  return (
    <Card className="h-[calc(100dvh-220px)] overflow-hidden flex flex-col md:flex-row">
      <div className="w-full md:w-80 shrink-0 flex flex-col h-1/2 md:h-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">{tx('Agents', '代理')}</h3>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx('Search agents', '搜索代理')}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
        <AgentList 
          onSelectAgent={setSelectedAgent} 
          selectedAgentId={selectedAgent?.id} 
          excludeRoles={['BUTLER']}
          searchQuery={searchQuery}
        />
      </div>

      <div className="flex-grow flex flex-col h-1/2 md:h-full min-w-0">
        {selectedAgent && selectedAgent.id ? (
          <ChatView agent={selectedAgent} />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl shadow-sm border flex items-center justify-center mb-6 text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">{tx('Select an Agent', '请选择代理')}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {tx(
                'Select an autonomous entity from the hive to begin a secure bi-directional transmission.',
                '从左侧选择一个代理，开始安全的双向对话。'
              )}
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              <ShieldAlert className="h-3 w-3" />
              {tx('End-to-End Encryption Active', '端到端加密已启用')}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AgentsPage
