import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './button';
import { Badge } from './badge';
import { StatusIndicator } from './status-indicator';

describe('UI Primitives', () => {
  describe('Button', () => {
    it('renders with default variant', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('applies destructive variant classes', () => {
      const { container } = render(<Button variant="destructive">Delete</Button>);
      // Using part of the expected class string from Shadcn Button variant
      expect(container.firstChild).toHaveClass('bg-destructive');
    });
  });

  describe('Badge', () => {
    it('renders with default variant', () => {
      render(<Badge>Status</Badge>);
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('applies secondary variant classes', () => {
      const { container } = render(<Badge variant="secondary">Info</Badge>);
      expect(container.firstChild).toHaveClass('bg-secondary');
    });
  });

  describe('StatusIndicator', () => {
    it('renders info variant', () => {
      const { container } = render(<StatusIndicator variant="info" />);
      expect(container.firstChild).toHaveClass('bg-blue-500');
    });

    it('renders error variant', () => {
      const { container } = render(<StatusIndicator variant="error" />);
      expect(container.firstChild).toHaveClass('bg-red-500');
    });
  });
});
