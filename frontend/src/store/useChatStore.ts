import { create } from 'zustand'
import type { ChatMessage } from '@/types'

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
      
      if (message.type === 'SYSTEM' || message.type === 'AUTH_REQUEST') {
        try {
          const newPayload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload as Record<string, unknown>)
          if (newPayload && newPayload.action_id) {
            const duplicateIndex = existing.findIndex(m => {
              if (m.type !== 'SYSTEM' && m.type !== 'AUTH_REQUEST') return false
              try {
                const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : (m.payload as Record<string, unknown>)
                return p && p.action_id === newPayload.action_id
              } catch (_e) {
                return false
              }
            })

            if (duplicateIndex > -1) {
              const updated = [...existing]
              updated[duplicateIndex] = message
              return { messages: { ...state.messages, [peerId]: updated } }
            }
          }
        } catch (_e) {
          // Ignore parse errors
        }
      }

      // 2. CHAT message deduplication and ID replacement using local_id
      const localDuplicateIndex = existing.findIndex(m => {
        // Strict match by ID
        if (message.id && m.id === message.id) return true
        
        // Strict match by local_id (this is the core of the client UUID sync)
        if (message.local_id && m.local_id === message.local_id) return true
        
        // Fallback for messages that might not have local_id (e.g. system generated)
        // Check for same content from same sender within a short time window
        if (!message.local_id && !m.local_id &&
            m.payload === message.payload && 
            m.sender_id === message.sender_id &&
            m.type === message.type) {
          const existingTime = new Date(m.timestamp).getTime()
          const newTime = new Date(message.timestamp).getTime()
          return Math.abs(existingTime - newTime) < 5000
        }
        return false
      })

      if (localDuplicateIndex > -1) {
        // If the new message has an ID (server confirmed) and the old one didn't, or we are just updating
        const oldMsg = existing[localDuplicateIndex]
        if ((message.id && !oldMsg.id) || (message.id === oldMsg.id)) {
          const updated = [...existing]
          // Merge properties, prioritizing server data (message) but keeping local_id if server didn't echo it
          updated[localDuplicateIndex] = { ...oldMsg, ...message }
          updated.sort((a, b) => {
            const idA = a.id || Infinity;
            const idB = b.id || Infinity;
            if (idA !== idB) return idA - idB;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          })
          return { messages: { ...state.messages, [peerId]: updated } }
        }
        return state
      }

      const newMessages = [...existing, message]
      newMessages.sort((a, b) => {
        const idA = a.id || Infinity;
        const idB = b.id || Infinity;
        if (idA !== idB) return idA - idB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })

      return {
        messages: {
          ...state.messages,
          [peerId]: newMessages,
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
          payload: (updatedMessages[messageIndex].payload as string) + chunk.payload,
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
      const merged = new Map<string, ChatMessage>()
      
      const isDuplicateOfHistory = (m: ChatMessage, historyList: ChatMessage[]) => {
        return historyList.some(h => {
          if (m.id && h.id && m.id === h.id) return true
          if (m.local_id && h.local_id && m.local_id === h.local_id) return true
          if (!m.local_id && !h.local_id && m.payload === h.payload && m.sender_id === h.sender_id && m.type === h.type) {
            const mTime = new Date(m.timestamp).getTime()
            const hTime = new Date(h.timestamp).getTime()
            if (Math.abs(mTime - hTime) < 5000) return true
          }
          return false
        })
      }
      
      history.forEach(m => {
        const payloadKey = typeof m.payload === 'string' ? m.payload.substring(0, 20) : JSON.stringify(m.payload).substring(0, 20)
        const key = m.id ? `id_${m.id}` : `vol_${m.timestamp}_${payloadKey}`
        if (m.type === 'SYSTEM') {
          try {
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : (m.payload as Record<string, unknown>)
            if (p.action_id) {
              merged.set(`sys_${p.action_id as string}`, m)
              return
            }
          } catch (_e) {
            // Ignore parse errors
          }
        }
        merged.set(key, m)
      })

      current.forEach(m => {
        if (m.type === 'SYSTEM') {
          try {
            const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : (m.payload as Record<string, unknown>)
            if (p.action_id) {
              const key = `sys_${p.action_id as string}`
              if (!merged.has(key)) merged.set(key, m)
              return
            }
          } catch (_e) {
            // Ignore parse errors
          }
        }
        
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
      newMessages.sort((a, b) => {
        const idA = a.id || Infinity;
        const idB = b.id || Infinity;
        if (idA !== idB) return idA - idB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })

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
        if (m.type !== 'SYSTEM') return true
        try {
          const p = typeof m.payload === 'string' ? JSON.parse(m.payload) : (m.payload as Record<string, unknown>)
          return p.type !== 'execution_start'
        } catch (_e) {
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
