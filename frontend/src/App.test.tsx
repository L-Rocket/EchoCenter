import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import App from './App';
import type { Message } from './components/MessageRow';

vi.mock('axios');
const mockedAxios = axios as any; // Simplified for MVP mock typing

describe('App Dashboard Polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedAxios.get.mockResolvedValue({ data: [] as Message[] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders dashboard header', async () => {
    await act(async () => {
        render(<App />);
    });
    expect(screen.getByText('EchoCenter Dashboard')).toBeInTheDocument();
  });

  it('displays fetched messages', async () => {
    const mockMessages: Message[] = [
      { id: 1, agent_id: 'agent-1', level: 'INFO', content: 'Msg 1', timestamp: new Date().toISOString() }
    ];
    mockedAxios.get.mockResolvedValue({ data: mockMessages });

    await act(async () => {
        render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByText('agent-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Msg 1')).toBeInTheDocument();
  });
});
