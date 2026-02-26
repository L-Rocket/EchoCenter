import { useState } from 'react'
import { MessageSquare, ShieldAlert } from 'lucide-react'
import AgentList from '@/components/agent/AgentList'
import type { Agent } from '@/components/agent/AgentList'
import ChatView from '@/components/agent/ChatView'
import { Card } from '@/components/ui/card'

const AgentsPage = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  return (
    <Card className="h-[calc(100vh-160px)] overflow-hidden border-slate-200 shadow-xl flex flex-col md:flex-row bg-white">
      {/* Left Sidebar: Agent List */}
      <div className="w-full md:w-80 shrink-0 flex flex-col h-1/2 md:h-full">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Agents</h3>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        <AgentList 
          onSelectAgent={setSelectedAgent} 
          selectedAgentId={selectedAgent?.id} 
        />
      </div>

      {/* Right Column: Chat View */}
      <div className="flex-grow flex flex-col h-1/2 md:h-full min-w-0">
        {selectedAgent && selectedAgent.id ? (
          <ChatView agent={selectedAgent} />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center bg-slate-50/30 text-center p-8">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6 text-slate-300">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Select an Agent</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Select an autonomous entity from the hive to begin a secure bi-directional transmission.
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
              <ShieldAlert className="h-3 w-3" />
              End-to-End Encryption Active
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AgentsPage
