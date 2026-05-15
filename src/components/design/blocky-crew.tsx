import type { CSSProperties } from "react";

type CrewMember = "james" | "isaac" | "dad";

type MemberSpec = {
  name: string;
  role: string;
  shirt: string;
  jacket?: string;
  hat?: string;
  hair?: string;
  prop: "laptop" | "box" | "clipboard";
  scale?: number;
};

const SPECS: Record<CrewMember, MemberSpec> = {
  james: {
    name: "James",
    role: "Ops captain",
    shirt: "var(--green)",
    jacket: "oklch(0.30 0.05 155)",
    hat: "oklch(0.20 0.03 240)",
    prop: "laptop",
  },
  isaac: {
    name: "Isaac",
    role: "Box runner",
    shirt: "var(--sky)",
    hair: "oklch(0.38 0.07 65)",
    prop: "box",
    scale: 0.9,
  },
  dad: {
    name: "Dad",
    role: "Receipt inspector",
    shirt: "var(--amber)",
    jacket: "oklch(0.42 0.04 80)",
    hat: "oklch(0.33 0.04 80)",
    prop: "clipboard",
  },
};

export function BlockyCrew({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-label="Internal ops crew"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: compact ? 2 : 10,
        filter: "drop-shadow(0 16px 18px oklch(0.22 0.03 150 / 0.14))",
      }}
    >
      <BlockyCrewMember member="james" size={compact ? 52 : 112} hideLabel={compact} />
      <BlockyCrewMember member="isaac" size={compact ? 46 : 98} hideLabel={compact} />
      <BlockyCrewMember member="dad" size={compact ? 52 : 112} hideLabel={compact} />
    </div>
  );
}

export function BlockyCrewMember({
  member,
  size = 96,
  hideLabel = false,
  style,
}: {
  member: CrewMember;
  size?: number;
  hideLabel?: boolean;
  style?: CSSProperties;
}) {
  const spec = SPECS[member];
  const scale = spec.scale ?? 1;
  const w = size;
  const h = size * 1.28;
  const outline = "var(--crew-outline, oklch(0.20 0.025 150))";
  const skin = "var(--crew-skin, oklch(0.78 0.09 76))";

  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, ...style }}>
      <svg
        viewBox="0 0 120 150"
        width={w}
        height={h}
        role="img"
        aria-label={`${spec.name}, ${spec.role}`}
        style={{ display: "block", transform: `scale(${scale})`, transformOrigin: "bottom center" }}
      >
        <defs>
          <linearGradient id={`${member}-shine`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.55" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="142" rx="34" ry="7" fill="oklch(0.22 0.025 150 / 0.14)" />

        {/* legs */}
        <rect x="36" y="98" width="19" height="37" rx="5" fill="oklch(0.24 0.025 245)" stroke={outline} strokeWidth="3" />
        <rect x="65" y="98" width="19" height="37" rx="5" fill="oklch(0.24 0.025 245)" stroke={outline} strokeWidth="3" />
        <rect x="31" y="130" width="28" height="10" rx="4" fill={outline} />
        <rect x="61" y="130" width="28" height="10" rx="4" fill={outline} />

        {/* torso */}
        <path d="M32 62 H88 L96 103 Q96 111 88 111 H32 Q24 111 24 103 Z" fill={spec.jacket ?? spec.shirt} stroke={outline} strokeWidth="3" />
        <path d="M42 64 H78 L84 108 H36 Z" fill={spec.shirt} opacity="0.92" />
        <path d="M36 66 H58 L49 86 Z" fill={`url(#${member}-shine)`} opacity="0.4" />

        {/* arms */}
        <rect x="16" y="67" width="18" height="42" rx="7" fill={spec.jacket ?? spec.shirt} stroke={outline} strokeWidth="3" transform="rotate(8 25 88)" />
        <rect x="86" y="67" width="18" height="42" rx="7" fill={spec.jacket ?? spec.shirt} stroke={outline} strokeWidth="3" transform="rotate(-8 95 88)" />
        <circle cx="22" cy="111" r="8" fill={skin} stroke={outline} strokeWidth="3" />
        <circle cx="98" cy="111" r="8" fill={skin} stroke={outline} strokeWidth="3" />

        {/* neck/head */}
        <rect x="50" y="52" width="20" height="12" rx="4" fill={skin} stroke={outline} strokeWidth="3" />
        <rect x="34" y="20" width="52" height="40" rx="13" fill={skin} stroke={outline} strokeWidth="3" />
        <path d="M41 27 H79 Q84 27 84 34 V38 H36 V34 Q36 27 41 27 Z" fill="url(#james-shine)" opacity="0.35" />

        {spec.hat && (
          <>
            <rect x="32" y="14" width="56" height="16" rx="7" fill={spec.hat} stroke={outline} strokeWidth="3" />
            <path d="M77 25 H101 Q104 25 104 29 Q104 34 96 34 H80 Z" fill={spec.hat} stroke={outline} strokeWidth="3" />
          </>
        )}
        {spec.hair && <path d="M34 34 C43 18 72 14 86 34 V25 C78 14 42 11 34 28 Z" fill={spec.hair} stroke={outline} strokeWidth="3" />}

        {/* faces */}
        {member === "dad" ? (
          <>
            <circle cx="49" cy="40" r="2.4" fill={outline} />
            <circle cx="71" cy="40" r="2.4" fill={outline} />
            <path d="M45 38 H53 M67 38 H75" stroke={outline} strokeWidth="2" strokeLinecap="round" />
            <path d="M50 51 Q60 55 70 51" stroke={outline} strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M51 47 Q60 43 69 47" stroke={outline} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : member === "isaac" ? (
          <>
            <circle cx="49" cy="40" r="2.4" fill={outline} />
            <circle cx="71" cy="40" r="2.4" fill={outline} />
            <path d="M49 50 Q60 58 72 49" stroke={outline} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="49" cy="40" r="2.4" fill={outline} />
            <circle cx="71" cy="40" r="2.4" fill={outline} />
            <path d="M52 51 Q60 54 68 51" stroke={outline} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}

        <CrewProp type={spec.prop} outline={outline} />
      </svg>
      {!hideLabel && (
        <div style={{ textAlign: "center", lineHeight: 1.05 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-0)" }}>{spec.name}</div>
          <div className="mono" style={{ marginTop: 3, fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {spec.role}
          </div>
        </div>
      )}
    </div>
  );
}

function CrewProp({ type, outline }: { type: MemberSpec["prop"]; outline: string }) {
  if (type === "laptop") {
    return (
      <g>
        <rect x="36" y="89" width="48" height="28" rx="4" fill="oklch(0.18 0.02 245)" stroke={outline} strokeWidth="3" />
        <circle cx="60" cy="103" r="5" fill="var(--green)" />
        <path d="M42 119 H78 L84 127 H36 Z" fill="oklch(0.28 0.02 245)" stroke={outline} strokeWidth="3" />
      </g>
    );
  }
  if (type === "box") {
    return (
      <g>
        <rect x="36" y="86" width="48" height="36" rx="4" fill="oklch(0.76 0.11 70)" stroke={outline} strokeWidth="3" />
        <path d="M36 98 H84 M60 86 V122" stroke="oklch(0.50 0.09 65)" strokeWidth="3" />
        <circle cx="73" cy="103" r="5" fill="var(--pitaya)" />
      </g>
    );
  }
  return (
    <g>
      <rect x="40" y="82" width="40" height="44" rx="5" fill="oklch(0.96 0.01 95)" stroke={outline} strokeWidth="3" />
      <rect x="50" y="77" width="20" height="10" rx="4" fill="oklch(0.34 0.03 80)" stroke={outline} strokeWidth="3" />
      <path d="M49 99 L57 107 L72 91" stroke="var(--green)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
