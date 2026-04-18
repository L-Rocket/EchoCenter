export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <div className="v3-brand-mark" style={{ width: size, height: size }}>
      <svg
        width={size * 0.47}
        height={size * 0.47}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-hue)"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M5 12 C 5 7, 9 5, 12 5 S 19 7, 19 12" />
        <path d="M8 15 C 8 11, 10 10, 12 10 S 16 11, 16 15" opacity="0.6" />
      </svg>
    </div>
  );
}
