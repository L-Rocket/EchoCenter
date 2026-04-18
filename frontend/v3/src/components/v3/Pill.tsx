import type { ReactNode } from 'react';

export type PillKind = 'default' | 'accent' | 'green' | 'amber' | 'red' | 'blue';

interface PillProps {
  kind?: PillKind;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Pill({ kind = 'default', icon, children, className = '' }: PillProps) {
  const kindClass = kind === 'default' ? '' : kind;
  return (
    <span className={`v3-pill ${kindClass} ${className}`.trim()}>
      {icon}
      {children}
    </span>
  );
}
