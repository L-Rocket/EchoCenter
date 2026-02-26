import { create } from 'zustand'

export interface ChatMessage {
  id?: number
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG'
  sender_id: number
  sender_name: string
  target_id?: number
  payload: string
  timestamp: string
}

interface ChatState {
  // Messages keyed by Agent/User ID
  messages: Record<number, ChatMessage[]>
  addMessage: (peerId: number, message: ChatMessage) => void
  setHistory: (peerId: number, messages: ChatMessage[]) => void
  clearMessages: (peerId: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  addMessage: (peerId, message) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      
      // Simple de-duplication: if we have an ID, don't add if it already exists
      if (message.id && existing.some(m => m.id === message.id)) {
        return state
      }

      return {
        messages: {
          ...state.messages,
          [peerId]: [...existing, message],
        },
      }
    }),
  setHistory: (peerId, history) =>
    set((state) => {
      const current = state.messages[peerId] || []
      
      // Merge history with current volatile messages
      // Filter out messages from history that are already in 'current' by ID
      const newMessages = [...history]
      
      current.forEach(msg => {
        if (!msg.id || !newMessages.some(m => m.id === msg.id)) {
          newMessages.push(msg)
        }
      })

      // Sort by timestamp just in case
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
