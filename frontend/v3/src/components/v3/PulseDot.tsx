interface PulseDotProps {
  tone?: 'green' | 'amber' | 'red';
  size?: number;
  className?: string;
}

export function PulseDot({ tone = 'green', size = 7, className = '' }: PulseDotProps) {
  const toneClass = tone === 'green' ? '' : tone;
  return (
    <span
      className={`pulse-dot ${toneClass} ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}
