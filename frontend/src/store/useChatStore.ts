import { create } from 'zustand'

export interface ChatMessage {
  id?: number
  type: 'CHAT' | 'SYSTEM' | 'SYSTEM_LOG'
  sender_id: number
  sender_name: string
  target_id?: number
  payload: string
  timestamp: string
  stream_id?: string // For grouping chunks
}

interface ChatState {
  // Messages keyed by Agent/User ID
  messages: Record<number, ChatMessage[]>
  addMessage: (peerId: number, message: ChatMessage) => void
  appendStreamChunk: (peerId: number, chunk: { stream_id: string, payload: string, sender_id: number, sender_name: string, timestamp: string }) => void
  setHistory: (peerId: number, messages: ChatMessage[]) => void
  clearMessages: (peerId: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  addMessage: (peerId, message) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      
      // Simple de-duplication
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
  appendStreamChunk: (peerId, chunk) =>
    set((state) => {
      const existing = state.messages[peerId] || []
      const messageIndex = existing.findIndex(m => m.stream_id === chunk.stream_id)

      if (messageIndex > -1) {
        // Append to existing stream
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
        // Start new stream
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
