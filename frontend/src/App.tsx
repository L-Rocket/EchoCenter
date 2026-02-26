import { useState, useEffect } from 'react'
import axios from 'axios'
import MessageList from './components/MessageList'
import type { Message } from './components/MessageRow'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import UserManagement from './components/UserManagement'
import MainLayout from './components/MainLayout'
import { Badge } from '@/components/ui/badge'
import { Activity, Bot, Terminal } from 'lucide-react'
import AgentList from './components/agent/AgentList'
import ChatDialog from './components/agent/ChatDialog'
import { useWebSocket } from './hooks/useWebSocket'

const API_BASE_URL = 'http://localhost:8080'

// Axios interceptor for tokens
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

function DashboardContent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'MESSAGES' | 'USERS' | 'AGENTS'>('MESSAGES')
  const { logout, token } = useAuth()
  const [activeChat, setActiveChat] = useState<{id: number, name: string} | null>(null)

  // WebSocket lifecycle (Now handles SYSTEM_LOG to replace polling)
  const { isConnected, sendMessage } = useWebSocket(token, (newLog) => {
    if (newLog) {
      setMessages((prev) => [newLog, ...(prev || [])].slice(0, 50))
    }
  })

  const fetchMessages = async () => {
    try {
      const response = await axios.get<Message[]>(`${API_BASE_URL}/api/messages`)
      setMessages(Array.isArray(response.data) ? response.data : [])
      setLoading(false)
      setError(null)
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout()
      }
      console.error("Failed to fetch messages:", err)
      setError("Failed to connect to backend.")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    // Polling removed: Updates now come via WebSocket onLogReceived callback
  }, [])

  return (
    <MainLayout view={view} setView={setView}>
      {/* Connection Status Banner */}
      {!isConnected && token && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg border border-amber-100 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider">
            <Activity className="h-3 w-3 animate-pulse" />
            Link unstable: Reconnecting to hive...
          </div>
        </div>
      )}

      {error && view === 'MESSAGES' && (
        <div className="mb-6">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-100 flex items-center gap-3 text-sm font-medium">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {error}
          </div>
        </div>
      )}
      
      {view === 'MESSAGES' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Logs</h2>
              <p className="text-sm text-slate-500">Autonomous status feed from the Echo hive.</p>
            </div>
            <Badge variant="outline" className="h-7 gap-1 px-3 bg-white border-slate-200 text-slate-600 font-medium">
              <Terminal className="h-3 w-3 text-indigo-500" />
              {loading ? "Syncing..." : `${(messages || []).length} Active Records`}
            </Badge>
          </div>
          <MessageList messages={messages} />
        </div>
      ) : view === 'USERS' ? (
        <div className="space-y-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Team Management</h2>
            <p className="text-sm text-slate-500">Add and manage operators with access to the EchoCenter.</p>
          </div>
          <UserManagement />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Autonomous Agents</h2>
              <p className="text-sm text-slate-500">Engage directly with registered intelligence entities.</p>
            </div>
            <Badge variant="outline" className="h-7 gap-1 px-3 bg-white border-slate-200 text-slate-600 font-medium">
              <Bot className="h-3 w-3 text-indigo-500" />
              Intelligence Swarm
            </Badge>
          </div>
          <AgentList onSelectAgent={(id, name) => setActiveChat({id, name})} />
        </div>
      )}

      {/* Persistent Chat Dialog */}
      {activeChat && (
        <ChatDialog 
          agentId={activeChat.id} 
          agentName={activeChat.name} 
          onClose={() => setActiveChat(null)}
          sendMessage={sendMessage}
        />
      )}
    </MainLayout>
  )
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <DashboardContent />
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App
