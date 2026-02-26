import { useState, useEffect } from 'react'
import axios from 'axios'
import MessageList from './components/MessageList'
import type { Message } from './components/MessageRow'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import UserManagement from './components/UserManagement'

const API_BASE_URL = 'http://localhost:8080'

// Axios interceptor for tokens (T019)
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'MESSAGES' | 'USERS'>('MESSAGES')
  const { logout, isAdmin, user } = useAuth()

  const fetchMessages = async () => {
    try {
      const response = await axios.get<Message[]>(`${API_BASE_URL}/api/messages`)
      setMessages(response.data)
      setLoading(false)
      setError(null)
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout() // Auto logout on expiry (T030)
      }
      console.error("Failed to fetch messages:", err)
      setError("Failed to connect to backend.")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(() => {
      fetchMessages()
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <header className="bg-white border-b py-4 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-gray-800">EchoCenter</h1>
            <nav className="flex gap-4">
              <button 
                onClick={() => setView('MESSAGES')}
                className={`text-sm ${view === 'MESSAGES' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
              >
                Dashboard
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setView('USERS')}
                  className={`text-sm ${view === 'USERS' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                >
                  Manage Users
                </button>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">Logged in as {user?.username}</span>
            <button 
              onClick={logout}
              className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-gray-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="py-6 flex-grow">
        {error && view === 'MESSAGES' && (
          <div className="max-w-4xl mx-auto px-4 mb-4">
            <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">
              {error}
            </div>
          </div>
        )}
        
        {view === 'MESSAGES' ? (
          <>
            <div className="max-w-4xl mx-auto px-4 mb-2 flex justify-between items-end">
               <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Live Activity</h2>
               <span className="text-xs text-gray-400">{loading ? "Connecting..." : `${messages.length} messages`}</span>
            </div>
            <MessageList messages={messages} />
          </>
        ) : (
          <UserManagement />
        )}
      </main>

      <footer className="py-8 text-center text-xs text-gray-400 border-t mt-auto">
        EchoCenter MVP | Secure Session Active
      </footer>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App
