interface AgentAvatarProps {
  name: string;
  status?: 'online' | 'busy' | 'offline' | null;
  size?: number;
}

export function AgentAvatar({ name, status, size = 32 }: AgentAvatarProps) {
  const letters = (name || '??')
    .split(/[-\s_]/)
    .slice(0, 2)
    .map((s) => s[0] || '')
    .join('')
    .toUpperCase() || '??';
  const hue = Array.from(name || 'x').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const statusBg =
    status === 'offline' ? 'var(--fg-faint)' :
    status === 'busy' ? 'var(--amber)' :
    status === 'online' ? 'var(--green)' : null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 14 : size >= 36 ? 10 : 8,
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: size >= 48 ? 16 : size >= 36 ? 13 : 11,
        background: `linear-gradient(135deg, oklch(0.32 0.05 ${hue}), oklch(0.22 0.04 ${hue}))`,
        color: 'var(--fg)',
        position: 'relative',
        flexShrink: 0,
        border: '1px solid var(--border-faint)',
      }}
    >
      {letters}
      {statusBg ? (
        <span
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: size >= 48 ? 14 : 10,
            height: size >= 48 ? 14 : 10,
            borderRadius: '50%',
            background: statusBg,
            boxShadow: '0 0 0 2px var(--bg-card)',
          }}
        />
      ) : null}
    </div>
  );
}
