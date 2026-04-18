import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MessageRow from './MessageRow'
import type { LogMessage } from '@/types'

describe('MessageRow', () => {
  const mockMessage: LogMessage = {
    id: 1,
    agent_id: 'Test-Agent',
    level: 'INFO',
    content: 'Test log content',
    timestamp: new Date().toISOString(),
  }

  it('renders agent ID and content', () => {
    render(<MessageRow message={mockMessage} />)
    expect(screen.getByText('Test-Agent')).toBeDefined()
    expect(screen.getByText('Test log content')).toBeDefined()
  })

  it('renders level badge', () => {
    render(<MessageRow message={mockMessage} />)
    expect(screen.getByText('INFO')).toBeDefined()
  })
})
