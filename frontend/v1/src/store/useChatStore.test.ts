import { describe, expect, it } from 'vitest'
import { buildChatScope, useChatStore } from './useChatStore'

describe('useChatStore', () => {
  it('isolates messages by thread scope', () => {
    const butlerScope = buildChatScope(2, 11)
    const agentScope = buildChatScope(2, 12)

    useChatStore.setState({
      messagesByScope: {},
      pendingByScope: {},
      isThinking: false,
    })

    useChatStore.getState().addMessage(butlerScope, {
      id: 1,
      conversation_id: 11,
      type: 'CHAT',
      sender_id: 1,
      sender_name: 'admin',
      target_id: 2,
      payload: 'hello thread 11',
      timestamp: new Date().toISOString(),
    })

    useChatStore.getState().addMessage(agentScope, {
      id: 2,
      conversation_id: 12,
      type: 'CHAT',
      sender_id: 1,
      sender_name: 'admin',
      target_id: 2,
      payload: 'hello thread 12',
      timestamp: new Date().toISOString(),
    })

    expect(useChatStore.getState().messagesByScope[butlerScope]).toHaveLength(1)
    expect(useChatStore.getState().messagesByScope[agentScope]).toHaveLength(1)
    expect(useChatStore.getState().messagesByScope[butlerScope][0]?.payload).toBe('hello thread 11')
    expect(useChatStore.getState().messagesByScope[agentScope][0]?.payload).toBe('hello thread 12')
  })
})
