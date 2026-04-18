import { create } from 'zustand'
import type { ChatMessage } from '@/types'

export const buildChatScope = (peerId: number, conversationId?: number | null) =>
  conversationId && conversationId > 0 ? `thread:${conversationId}` : `peer:${peerId}`

const getMessageTime = (msg: ChatMessage): number => {
  const t = new Date(msg.timestamp || '').getTime()
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

const compareMessages = (a: ChatMessage, b: ChatMessage): number => {
  if (a.id && b.id && a.id !== b.id) return a.id - b.id

  const timeDelta = getMessageTime(a) - getMessageTime(b)
  if (timeDelta !== 0) return timeDelta

  const keyA = `${a.local_id || ''}_${a.stream_id || ''}_${a.sender_id || 0}`
  const keyB = `${b.local_id || ''}_${b.stream_id || ''}_${b.sender_id || 0}`
  return keyA.localeCompare(keyB)
}

interface StreamChunk {
  stream_id: string
  payload: string
  sender_id: number
  sender_name: string
  timestamp: string
  conversation_id?: number
}

interface ChatState {
  messagesByScope: Record<string, ChatMessage[]>
  isThinking: boolean
  pendingByScope: Record<string, boolean>
  setThinking: (val: boolean) => void
  setPending: (scope: string, pending: boolean) => void
  clearPending: (scope: string) => void
  addMessage: (scope: string, message: ChatMessage) => void
  appendStreamChunk: (scope: string, chunk: StreamChunk) => void
  setHistory: (scope: string, messages: ChatMessage[]) => void
  clearMessages: (scope: string) => void
  removeProcessMessages: (scope: string) => void
}

const mergeMessages = (existing: ChatMessage[], incoming: ChatMessage) => {
  if (incoming.type === 'SYSTEM' || incoming.type === 'AUTH_REQUEST') {
    try {
      const newPayload = typeof incoming.payload === 'string' ? JSON.parse(incoming.payload) : (incoming.payload as Record<string, unknown>)
      if (newPayload && newPayload.action_id) {
        const duplicateIndex = existing.findIndex((message) => {
          if (message.type !== 'SYSTEM' && message.type !== 'AUTH_REQUEST') return false
          try {
            const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload as Record<string, unknown>)
            return payload && payload.action_id === newPayload.action_id
          } catch (_e) {
            return false
          }
        })

        if (duplicateIndex > -1) {
          const updated = [...existing]
          updated[duplicateIndex] = incoming
          return updated
        }
      }
    } catch (_e) {
      // ignore parse failures
    }
  }

  const duplicateIndex = existing.findIndex((message) => {
    if (incoming.id && message.id === incoming.id) return true
    if (incoming.local_id && message.local_id === incoming.local_id) return true
    if (incoming.stream_id && message.stream_id === incoming.stream_id) return true

    if (!incoming.local_id && !message.local_id &&
      message.payload === incoming.payload &&
      message.sender_id === incoming.sender_id &&
      message.type === incoming.type) {
      const existingTime = new Date(message.timestamp).getTime()
      const newTime = new Date(incoming.timestamp).getTime()
      return Math.abs(existingTime - newTime) < 5000
    }

    return false
  })

  if (duplicateIndex > -1) {
    const oldMsg = existing[duplicateIndex]
    if ((incoming.id && !oldMsg.id) || incoming.id === oldMsg.id || incoming.stream_id === oldMsg.stream_id) {
      const updated = [...existing]
      updated[duplicateIndex] = { ...oldMsg, ...incoming }
      updated.sort(compareMessages)
      return updated
    }
    return existing
  }

  const next = [...existing, incoming]
  next.sort(compareMessages)
  return next
}

export const useChatStore = create<ChatState>((set) => ({
  messagesByScope: {},
  isThinking: false,
  pendingByScope: {},
  setThinking: (val) => set({ isThinking: val }),
  setPending: (scope, pending) =>
    set((state) => ({
      isThinking: pending ? true : Object.values({ ...state.pendingByScope, [scope]: pending }).some(Boolean),
      pendingByScope: {
        ...state.pendingByScope,
        [scope]: pending,
      },
    })),
  clearPending: (scope) =>
    set((state) => {
      const next = { ...state.pendingByScope, [scope]: false }
      return {
        isThinking: Object.values(next).some(Boolean),
        pendingByScope: next,
      }
    }),
  addMessage: (scope, message) =>
    set((state) => {
      const existing = state.messagesByScope[scope] || []
      return {
        messagesByScope: {
          ...state.messagesByScope,
          [scope]: mergeMessages(existing, message),
        },
      }
    }),
  appendStreamChunk: (scope, chunk) =>
    set((state) => {
      const existing = state.messagesByScope[scope] || []
      const messageIndex = existing.findIndex((message) => message.stream_id === chunk.stream_id)

      if (messageIndex > -1) {
        const updatedMessages = [...existing]
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          payload: String(updatedMessages[messageIndex].payload || '') + chunk.payload,
          timestamp: chunk.timestamp,
          conversation_id: chunk.conversation_id ?? updatedMessages[messageIndex].conversation_id,
        }
        return {
          messagesByScope: { ...state.messagesByScope, [scope]: updatedMessages },
        }
      }

      const newMessage: ChatMessage = {
        type: 'CHAT',
        sender_id: chunk.sender_id,
        sender_name: chunk.sender_name,
        payload: chunk.payload,
        timestamp: chunk.timestamp,
        stream_id: chunk.stream_id,
        conversation_id: chunk.conversation_id,
      }

      return {
        messagesByScope: {
          ...state.messagesByScope,
          [scope]: [...existing, newMessage],
        },
      }
    }),
  setHistory: (scope, history) =>
    set((state) => {
      const current = state.messagesByScope[scope] || []
      const merged = new Map<string, ChatMessage>()

      const isDuplicateOfHistory = (message: ChatMessage, historyList: ChatMessage[]) => {
        return historyList.some((item) => {
          if (message.id && item.id && message.id === item.id) return true
          if (message.local_id && item.local_id && message.local_id === item.local_id) return true
          if (message.stream_id && item.stream_id && message.stream_id === item.stream_id) return true
          if (!message.local_id && !item.local_id && message.payload === item.payload && message.sender_id === item.sender_id && message.type === item.type) {
            const mTime = new Date(message.timestamp).getTime()
            const hTime = new Date(item.timestamp).getTime()
            return Math.abs(mTime - hTime) < 5000
          }
          return false
        })
      }

      history.forEach((message) => {
        const payloadKey = typeof message.payload === 'string' ? message.payload.substring(0, 20) : JSON.stringify(message.payload).substring(0, 20)
        const key = message.id ? `id_${message.id}` : `vol_${message.timestamp}_${payloadKey}`
        if (message.type === 'SYSTEM' || message.type === 'AUTH_REQUEST') {
          try {
            const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload as Record<string, unknown>)
            if (payload.action_id) {
              merged.set(`sys_${payload.action_id as string}`, message)
              return
            }
          } catch (_e) {
            // ignore parse failures
          }
        }
        merged.set(key, message)
      })

      current.forEach((message) => {
        if (message.type === 'SYSTEM' || message.type === 'AUTH_REQUEST') {
          try {
            const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload as Record<string, unknown>)
            if (payload.action_id) {
              const key = `sys_${payload.action_id as string}`
              if (!merged.has(key)) merged.set(key, message)
              return
            }
          } catch (_e) {
            // ignore parse failures
          }
        }

        if (message.id && isDuplicateOfHistory(message, history)) {
          return
        }

        const payloadKey = typeof message.payload === 'string' ? message.payload.substring(0, 20) : JSON.stringify(message.payload).substring(0, 20)
        const key = message.id ? `id_${message.id}` : `vol_${message.timestamp}_${payloadKey}`
        if (!merged.has(key)) {
          merged.set(key, message)
        }
      })

      const nextMessages = Array.from(merged.values())
      nextMessages.sort(compareMessages)

      return {
        messagesByScope: {
          ...state.messagesByScope,
          [scope]: nextMessages,
        },
      }
    }),
  clearMessages: (scope) =>
    set((state) => {
      const newMessages = { ...state.messagesByScope }
      delete newMessages[scope]
      const nextPending = { ...state.pendingByScope }
      delete nextPending[scope]
      return {
        messagesByScope: newMessages,
        pendingByScope: nextPending,
        isThinking: Object.values(nextPending).some(Boolean),
      }
    }),
  removeProcessMessages: (scope) =>
    set((state) => {
      const existing = state.messagesByScope[scope] || []
      const filtered = existing.filter((message) => {
        if (message.type !== 'SYSTEM') return true
        try {
          const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload as Record<string, unknown>)
          return payload.type !== 'execution_start'
        } catch (_e) {
          return true
        }
      })
      return {
        messagesByScope: {
          ...state.messagesByScope,
          [scope]: filtered,
        },
      }
    }),
}))
