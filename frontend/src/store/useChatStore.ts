import { create } from 'zustand'

export interface ChatMessage {
  id?: number
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG' | 'AUTH_REQUEST' | 'AUTH_RESPONSE'
  sender_id: number
  sender_name: string
  target_id?: number
  payload: string | any
  timestamp: string
  stream_id?: string 
}

interface ChatState {
  messages: Record<number, ChatMessage[]>
  isThinking: boolean
  setThinking: (val: boolean) => void
  addMessage: (peerId: number, message: ChatMessage) => void
  appendStreamChunk: (peerId: number, chunk: { stream_id: string, payload: string, sender_id: number, sender_name: string, timestamp: string }) => void
  setHistory: (peerId: number, messages: ChatMessage[]) => void
  clearMessages: (peerId: number) => void
  removeProcessMessages: (peerId: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  isThinking: false,
  setThinking: (val) => set({ isThinking: val }),
  
  addMessage: (peerId, message) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      
      // 1. SYSTEM and AUTH_REQUEST message deduplication by action_id
      if (message.type === 'SYSTEM' || message.type === 'AUTH_REQUEST') {
        try {
          const newPayload = typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload
          if (newPayload && newPayload.action_id) {
            const duplicateIndex = existing.findIndex(m => {
              if (m.type !== 'SYSTEM' && m.type !== 'AUTH_REQUEST') return false
              try {
                const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
                return p && p.action_id === newPayload.action_id
              } catch (e) {
                return false
              }
            })

            if (duplicateIndex > -1) {
              const updated = [...existing]
              updated[duplicateIndex] = message
              return { messages: { ...state.messages, [peerId]: updated } }
            }
          }
        } catch (e) {
          console.error('Failed to parse message payload for deduplication:', e)
        }
      }

      // 2. CHAT message deduplication by ID or content+sender+time proximity (within 5 seconds)
      const isDuplicate = existing.some(m => {
        if (message.id && m.id === message.id) return true
        // Check for same content from same sender within 5 seconds (handles local+server echo)
        if (m.payload === message.payload && 
            m.sender_id === message.sender_id &&
            m.type === message.type) {
          const existingTime = new Date(m.timestamp).getTime()
          const newTime = new Date(message.timestamp).getTime()
          if (Math.abs(existingTime - newTime) < 5000) return true
        }
        return false
      })

      if (isDuplicate) return state

      return {
        messages: {
          ...state.messages,
          [peerId]: [...existing, message],
        },
      }
    }),

  appendStreamChunk: (peerId, chunk) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      const messageIndex = existing.findIndex(m => m.stream_id === chunk.stream_id)

      if (messageIndex > -1) {
        const updatedMessages = [...existing]
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          payload: updatedMessages[messageIndex].payload + chunk.payload,
          timestamp: chunk.timestamp
        }
        return {
          messages: { ...state.messages, [peerId]: updatedMessages }
        }
      } else {
        const newMessage: ChatMessage = {
          type: 'CHAT',
          sender_id: chunk.sender_id,
          sender_name: chunk.sender_name,
          payload: chunk.payload,
          timestamp: chunk.timestamp,
          stream_id: chunk.stream_id
        }
        return {
          messages: {
            ...state.messages,
            [peerId]: [...existing, newMessage]
          }
        }
      }
    }),

  setHistory: (peerId, history) =>
    set((state) => {
      const current = state.messages[peerId] || []
      
      // Use a Map to deduplicate by ID or complex key
      const merged = new Map<string, ChatMessage>()
      
      // Helper to check if a message is duplicate based on content + sender + time proximity
      const isDuplicateOfHistory = (m: ChatMessage, historyList: ChatMessage[]) => {
        return historyList.some(h => {
          // If both have IDs, compare IDs
          if (m.id && h.id && m.id === h.id) return true
          // Compare content + sender + time proximity (within 5 seconds)
          if (m.payload === h.payload && m.sender_id === h.sender_id && m.type === h.type) {
            const mTime = new Date(m.timestamp).getTime()
            const hTime = new Date(h.timestamp).getTime()
            if (Math.abs(mTime - hTime) < 5000) return true
          }
          return false
        })
      }
      
      // Add history first (authoritative)
      history.forEach(m => {
        const payloadKey = typeof m.payload === 'string' ? m.payload.substring(0, 20) : JSON.stringify(m.payload).substring(0, 20)
        const key = m.id ? `id_${m.id}` : `vol_${m.timestamp}_${payloadKey}`
        // Special key for SYSTEM requests to ensure they merge correctly
        if (m.type === 'SYSTEM') {
          try {
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
            merged.set(`sys_${p.action_id}`, m)
            return
          } catch(e) {}
        }
        merged.set(key, m)
      })

      // Merge current volatile messages, checking for duplicates against history
      current.forEach(m => {
        if (m.type === 'SYSTEM') {
          try {
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
            const key = `sys_${p.action_id}`
            if (!merged.has(key)) merged.set(key, m)
            return
          } catch(e) {}
        }
        
        // Skip if this message is a duplicate of any history message
        // But keep messages without ID (not yet persisted) as they are local optimistic updates
        if (m.id && isDuplicateOfHistory(m, history)) {
          return
        }
        
        const payloadKey = typeof m.payload === 'string' ? m.payload.substring(0, 20) : JSON.stringify(m.payload).substring(0, 20)
        const key = m.id ? `id_${m.id}` : `vol_${m.timestamp}_${payloadKey}`
        if (!merged.has(key)) {
          merged.set(key, m)
        }
      })

      const newMessages = Array.from(merged.values())
      newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return {
        messages: {
          ...state.messages,
          [peerId]: newMessages,
        },
      }
    }),

  clearMessages: (peerId) =>
    set((state) => {
      const newMessages = { ...state.messages }
      delete newMessages[peerId]
      return { messages: newMessages }
    }),

  removeProcessMessages: (peerId) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      const filtered = existing.filter(m => {
        // Keep non-system messages
        if (m.type !== 'SYSTEM') return true
        // Remove execution_start messages
        try {
          const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
          return p.type !== 'execution_start'
        } catch (e) {
          return true
        }
      })
      return {
        messages: {
          ...state.messages,
          [peerId]: filtered,
        },
      }
    }),
}))
