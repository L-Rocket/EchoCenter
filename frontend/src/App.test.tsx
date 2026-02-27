import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import App from './App';

vi.mock('axios');

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login page when not authenticated', async () => {
    await act(async () => {
        render(<App />);
    });
    // The new login form has "EchoCenter" title and "Sign In" button
    expect(screen.getAllByText('EchoCenter')[0]).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });
});
