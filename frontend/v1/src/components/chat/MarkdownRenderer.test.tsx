import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from './MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('renders headings, lists, and code blocks', () => {
    render(
      <MarkdownRenderer
        content={`# Title

- first
- second

\`\`\`python
print("hello")
\`\`\``}
      />
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByText('print("hello")')).toBeInTheDocument()
  })
})
