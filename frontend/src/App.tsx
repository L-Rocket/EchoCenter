import { useState, useEffect } from 'react'
import axios from 'axios'
import MessageList from './components/MessageList'
import type { Message } from './components/MessageRow'

const API_BASE_URL = 'http://localhost:8080'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = async () => {
    try {
      const response = await axios.get<Message[]>(`${API_BASE_URL}/api/messages`)
      setMessages(response.data)
      setLoading(false)
      setError(null)
    } catch (err) {
      console.error("Failed to fetch messages:", err)
      setError("Failed to connect to backend.")
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchMessages()

    // Setup polling every 2 seconds
    const interval = setInterval(() => {
      fetchMessages()
    }, 2000)

    // Cleanup on unmount
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b py-4 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">EchoCenter Dashboard</h1>
          <div className="text-sm text-gray-500">
            {loading ? "Connecting..." : `Monitoring agents (${messages.length} messages)`}
          </div>
        </div>
      </header>

      <main className="py-6">
        {error && (
          <div className="max-w-4xl mx-auto px-4 mb-4">
            <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200">
              {error}
            </div>
          </div>
        )}
        <MessageList messages={messages} />
      </main>

      <footer className="py-8 text-center text-xs text-gray-400 border-t mt-auto">
        EchoCenter MVP | Auto-refreshing every 2s
      </footer>
    </div>
  )
}

export default App
