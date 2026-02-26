import { create } from 'zustand'

export interface ChatMessage {
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
  clearMessages: (peerId: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  addMessage: (peerId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [peerId]: [...(state.messages[peerId] || []), message],
      },
    })),
  clearMessages: (peerId) =>
    set((state) => {
      const newMessages = { ...state.messages }
      delete newMessages[peerId]
      return { messages: newMessages }
    }),
}))
