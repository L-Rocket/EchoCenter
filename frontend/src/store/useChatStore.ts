import { create } from 'zustand'

export interface ChatMessage {
  id?: number
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG'
  sender_id: number
  sender_name: string
  target_id?: number
  payload: string
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
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  isThinking: false,
  setThinking: (val) => set({ isThinking: val }),
  
  addMessage: (peerId, message) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      
      // 1. SYSTEM message deduplication by action_id
      if (message.type === 'SYSTEM') {
        try {
          const newPayload = typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload
          const duplicateIndex = existing.findIndex(m => {
            if (m.type !== 'SYSTEM') return false
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
            return p.action_id === newPayload.action_id
          })

          if (duplicateIndex > -1) {
            const updated = [...existing]
            updated[duplicateIndex] = message
            return { messages: { ...state.messages, [peerId]: updated } }
          }
        } catch (e) {}
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
      
      // Add history first (authoritative)
      history.forEach(m => {
        const key = m.id ? `id_${m.id}` : `vol_${m.timestamp}_${m.payload.substring(0, 20)}`
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

      // Merge current volatile messages
      current.forEach(m => {
        if (m.type === 'SYSTEM') {
          try {
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload
            const key = `sys_${p.action_id}`
            if (!merged.has(key)) merged.set(key, m)
            return
          } catch(e) {}
        }
        
        const key = m.id ? `id_${m.id}` : `vol_${m.timestamp}_${m.payload.substring(0, 20)}`
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
}))
