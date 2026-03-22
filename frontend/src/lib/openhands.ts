import type { OpenHandsTaskRecord } from '@/types';

export interface TaskWorkflowStep {
  kind: 'code' | 'command' | 'stdout' | 'stderr' | 'result' | 'note';
  title: string;
  body: string;
}

const normalizeTaskText = (text?: string) => (text || '').replace(/\r\n/g, '\n').trim();

const extractMarkdownSections = (source: string, pattern: RegExp): Array<{ title: string; body: string }> => {
  const matches = Array.from(source.matchAll(pattern));
  return matches
    .map((match) => ({
      title: String(match[1] || '').trim(),
      body: String(match[2] || '').trim(),
    }))
    .filter((section) => section.title && section.body);
};

export const parseOpenHandsWorkflow = (task: OpenHandsTaskRecord): TaskWorkflowStep[] => {
  const source = normalizeTaskText(task.success ? task.summary : task.error);
  if (!source) return [];

  const steps: TaskWorkflowStep[] = [];
  const resultSections = extractMarkdownSections(source, /^##\s+(Code|Output|Final Result)\s*\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm);
  resultSections.forEach((section) => {
    const lowered = section.title.toLowerCase();
    steps.push({
      kind: lowered === 'code' ? 'code' : lowered === 'output' ? 'stdout' : 'result',
      title: section.title,
      body: section.body.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n```$/, '').trim(),
    });
  });

  const commandBlocks = extractMarkdownSections(source, /^##\s+(Command[^\n]*)\s*\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm);
  commandBlocks.forEach((section) => {
    const body = section.body.trim();
    const commandLine = body
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/\n```[\s\S]*$/, '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (commandLine) {
      steps.push({ kind: 'command', title: section.title, body: commandLine });
    }

    const stdoutMatch = body.match(/###\s+stdout\s*\n```text\n([\s\S]*?)\n```/m);
    if (stdoutMatch?.[1]?.trim()) {
      steps.push({ kind: 'stdout', title: `${section.title} stdout`, body: stdoutMatch[1].trim() });
    }

    const stderrMatch = body.match(/###\s+stderr\s*\n```text\n([\s\S]*?)\n```/m);
    if (stderrMatch?.[1]?.trim()) {
      steps.push({ kind: 'stderr', title: `${section.title} stderr`, body: stderrMatch[1].trim() });
    }
  });

  if (steps.length === 0) {
    steps.push({
      kind: task.success ? 'note' : 'stderr',
      title: task.success ? 'Summary' : 'Failure',
      body: source,
    });
  }

  return steps;
};

export const taskPreview = (task: OpenHandsTaskRecord) => {
  const steps = parseOpenHandsWorkflow(task);
  const preferred = steps.find((step) => step.kind === 'result')
    || steps.find((step) => step.kind === 'stdout')
    || steps.find((step) => step.kind === 'command')
    || steps[0];

  return preferred?.body
    ? preferred.body.split('\n').map((line) => line.trim()).find(Boolean) || ''
    : '';
};
