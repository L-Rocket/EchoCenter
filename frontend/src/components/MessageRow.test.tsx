import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MessageRow from './MessageRow';
import type { Message } from './MessageRow';

describe('MessageRow', () => {
  const mockMessage: Message = {
    id: 1,
    agent_id: 'test-agent',
    level: 'INFO',
    content: 'Hello world',
    timestamp: '2026-02-25T14:30:00Z',
  };

  it('renders message content and agent id', () => {
    render(<MessageRow message={mockMessage} />);
    expect(screen.getByText('test-agent')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('applies correct background for INFO level', () => {
    const { container } = render(<MessageRow message={mockMessage} />);
    expect(container.firstChild).toHaveClass('bg-primary/5');
  });

  it('applies correct background for ERROR level', () => {
    const errorMsg = { ...mockMessage, level: 'ERROR' };
    const { container } = render(<MessageRow message={errorMsg} />);
    expect(container.firstChild).toHaveClass('bg-destructive/5');
  });

  it('applies correct background for WARNING level', () => {
    const warnMsg = { ...mockMessage, level: 'WARNING' };
    const { container } = render(<MessageRow message={warnMsg} />);
    expect(container.firstChild).toHaveClass('bg-amber-500/5');
  });
});
