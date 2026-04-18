import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const renderInline = (text: string, keyPrefix: string) => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-${match.index}`} className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.95em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-${match.index}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      const labelMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (labelMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-${match.index}`}
            href={labelMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            {labelMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let codeBlockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <div key={`code-${codeBlockIndex}`} className="rounded-2xl border border-border/70 bg-zinc-950/90 text-zinc-100 shadow-sm">
          <div className="border-b border-zinc-800 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">
            {language || 'code'}
          </div>
          <pre className="overflow-x-auto p-4 text-sm leading-6">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      codeBlockIndex += 1;
      continue;
    }

    if (trimmed.startsWith('#')) {
      const level = Math.min(trimmed.match(/^#+/)?.[0].length || 1, 3);
      const text = trimmed.replace(/^#+\s*/, '');
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      const classMap = {
        h1: 'text-3xl font-black tracking-tight',
        h2: 'text-2xl font-black tracking-tight',
        h3: 'text-xl font-bold tracking-tight',
      };
      blocks.push(
        React.createElement(Tag, {
          key: `heading-${index}`,
          className: classMap[Tag as keyof typeof classMap],
        }, renderInline(text, `heading-${index}`))
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`} className="border-l-4 border-primary/40 pl-4 text-sm text-muted-foreground">
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={`quote-line-${quoteIndex}`}>{renderInline(quoteLine, `quote-${quoteIndex}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-2 pl-6 text-sm leading-7">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInline(item, `ul-${itemIndex}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-2 pl-6 text-sm leading-7">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInline(item, `ol-${itemIndex}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate) break;
      if (candidate.startsWith('```') || candidate.startsWith('#') || candidate.startsWith('>') || /^[-*]\s+/.test(candidate) || /^\d+\.\s+/.test(candidate)) {
        break;
      }
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = paragraphLines.join(' ').trim();
    blocks.push(
      <p key={`p-${index}`} className="text-[15px] leading-8 text-foreground/92">
        {renderInline(paragraph, `p-${index}`)}
      </p>
    );
  }

  return <div className={`space-y-5 ${className}`}>{blocks}</div>;
};

export default MarkdownRenderer;
