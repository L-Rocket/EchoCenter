interface ThinkingChipProps {
  label?: string;
}

export function ThinkingChip({ label = 'Thinking' }: ThinkingChipProps) {
  return (
    <div className="thinking-chip">
      <span className="dots">
        <span />
        <span />
        <span />
      </span>
      {label}…
    </div>
  );
}
