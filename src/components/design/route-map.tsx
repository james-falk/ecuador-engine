export function RouteMap({ height = 68 }: { progress?: number; height?: number }) {
  const w = 360;
  const h = height;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id="rm-route" x1="0" x2="1">
          <stop offset="0" stopColor="var(--green)" />
          <stop offset="1" stopColor="var(--amber)" />
        </linearGradient>
        <pattern id="rm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="oklch(1 0 0 / 0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#rm-grid)" />
      <path d={`M 0 ${h - 20} Q 80 ${h - 30}, 140 ${h - 22} T 220 ${h - 15} T ${w} ${h - 25}`} stroke="oklch(0.4 0.04 150 / 0.3)" strokeWidth="1" fill="none" />
      <path
        d={`M 28 ${h - 18} Q ${w * 0.35} ${h * 0.2}, ${w * 0.6} ${h * 0.4} T ${w - 30} 18`}
        stroke="url(#rm-route)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="3 3"
      />
      <g>
        <circle cx="28" cy={h - 18} r="5" fill="var(--green)" />
        <circle cx="28" cy={h - 18} r="9" fill="var(--green)" opacity="0.18" />
        <text x="36" y={h - 15} fontSize="9" fill="var(--text-1)" fontFamily="var(--font-mono)">GUAYAQUIL</text>
        <text x="36" y={h - 5} fontSize="8" fill="var(--text-3)" fontFamily="var(--font-mono)">2.19°S 79.88°W</text>
      </g>
      <g>
        <circle cx={w - 30} cy="18" r="5" fill="var(--amber)" />
        <circle cx={w - 30} cy="18" r="9" fill="var(--amber)" opacity="0.18" />
        <text x={w - 44} y="32" fontSize="9" fill="var(--text-1)" fontFamily="var(--font-mono)" textAnchor="end">MIAMI</text>
        <text x={w - 44} y="42" fontSize="8" fill="var(--text-3)" fontFamily="var(--font-mono)" textAnchor="end">25.76°N 80.19°W</text>
      </g>
    </svg>
  );
}
