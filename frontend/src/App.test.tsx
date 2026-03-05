import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('vite-ui-theme');
  });

  it('renders login page when not authenticated', async () => {
    await act(async () => {
        render(<App />);
    });
    // The new login form has "Echo" and "Center" title components and "Establish Link" button
    expect(screen.getByText('Echo')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getByText('Establish Link')).toBeInTheDocument();
  });
});
