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

      const isDuplicate = existing.some(m => {
        if (message.id && m.id === message.id) return true
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
          if (m.payload === h.payload && m.sender_id === h.sender_id && m.type === h.type) {
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
        const timeA = new Date(a.timestamp).getTime()
        const timeB = new Date(b.timestamp).getTime()
        if (timeA !== timeB) return timeA - timeB
        // Tie-breaker: use ID if available
        return (a.id || 0) - (b.id || 0)
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
