// Leaf visuals: pitaya glyph, line-icon set, status pill, geo chip, entity chip.
// Pure presentational — no client state needed.

import type { Entity } from "@/lib/data";

export function PitayaGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pg-flesh" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.22 12)" />
          <stop offset="1" stopColor="oklch(0.55 0.2 8)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="13" r="7" fill="url(#pg-flesh)" />
      <path d="M12 6 L9 2 L12 5 L15 2 Z" fill="oklch(0.74 0.16 145)" />
      <path d="M6 9  L2 8  L6 10 L4 13 Z" fill="oklch(0.62 0.14 145)" />
      <path d="M18 9 L22 8 L18 10 L20 13 Z" fill="oklch(0.62 0.14 145)" />
      <circle cx="10.5" cy="12" r="0.6" fill="oklch(0.97 0.012 100)" opacity="0.85" />
      <circle cx="13" cy="14" r="0.5" fill="oklch(0.97 0.012 100)" opacity="0.7" />
      <circle cx="11" cy="15" r="0.4" fill="oklch(0.97 0.012 100)" opacity="0.6" />
    </svg>
  );
}

export type IconName =
  | "home" | "box" | "leaf" | "coin" | "tag" | "shield" | "people" | "ship"
  | "search" | "chev" | "plus" | "x" | "arrow" | "dot" | "clock" | "mail"
  | "file" | "check" | "spark" | "flag" | "drag" | "edit" | "globe";

export function Icon({ name, size = 14, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  const stroke = { stroke: color, strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    home:    (<><path d="M3 10 L8 4 L13 10 V13 H3 Z" {...stroke}/></>),
    box:     (<><path d="M3 5 L8 3 L13 5 V11 L8 13 L3 11 Z" {...stroke}/><path d="M3 5 L8 7 L13 5" {...stroke}/><path d="M8 7 V13" {...stroke}/></>),
    leaf:    (<><path d="M3 13 C3 7 7 3 13 3 C13 9 9 13 3 13 Z" {...stroke}/><path d="M3 13 L8 8" {...stroke}/></>),
    coin:    (<><circle cx="8" cy="8" r="5" {...stroke}/><path d="M6 8 H10 M7 6 H9 M7 10 H9" {...stroke}/></>),
    tag:     (<><path d="M3 8 L8 3 H13 V8 L8 13 Z" {...stroke}/><circle cx="10" cy="6" r="0.7" fill={color} /></>),
    shield:  (<><path d="M8 2 L13 4 V8 C13 11 8 14 8 14 C8 14 3 11 3 8 V4 Z" {...stroke}/></>),
    people:  (<><circle cx="6" cy="6" r="2" {...stroke}/><circle cx="11" cy="7" r="1.5" {...stroke}/><path d="M2 13 C2 10 4 9 6 9 C8 9 10 10 10 13" {...stroke}/><path d="M10 13 C10 11 11.5 10.5 13 11" {...stroke}/></>),
    ship:    (<><path d="M2 11 L4 7 H12 L14 11" {...stroke}/><path d="M2 11 L3 13 H13 L14 11" {...stroke}/><path d="M8 7 V3" {...stroke}/><path d="M8 3 H11" {...stroke}/></>),
    search:  (<><circle cx="7" cy="7" r="3.5" {...stroke}/><path d="M10 10 L13 13" {...stroke}/></>),
    chev:    (<><path d="M5 3 L9 8 L5 13" {...stroke}/></>),
    plus:    (<><path d="M8 3 V13 M3 8 H13" {...stroke}/></>),
    x:       (<><path d="M3 3 L13 13 M13 3 L3 13" {...stroke}/></>),
    arrow:   (<><path d="M3 8 H13 M9 4 L13 8 L9 12" {...stroke}/></>),
    dot:     (<circle cx="8" cy="8" r="3" fill={color}/>),
    clock:   (<><circle cx="8" cy="8" r="5" {...stroke}/><path d="M8 5 V8 L10 9.5" {...stroke}/></>),
    mail:    (<><rect x="2.5" y="4" width="11" height="8" rx="1" {...stroke}/><path d="M3 5 L8 9 L13 5" {...stroke}/></>),
    file:    (<><path d="M4 2 H10 L13 5 V14 H4 Z" {...stroke}/><path d="M10 2 V5 H13" {...stroke}/></>),
    check:   (<><path d="M3 8 L7 12 L13 4" {...stroke}/></>),
    spark:   (<><path d="M8 2 V14 M2 8 H14 M4 4 L12 12 M12 4 L4 12" {...stroke}/></>),
    flag:    (<><path d="M4 2 V14 M4 3 H12 L10 6 L12 9 H4" {...stroke}/></>),
    drag:    (<><circle cx="6" cy="4" r="0.8" fill={color}/><circle cx="6" cy="8" r="0.8" fill={color}/><circle cx="6" cy="12" r="0.8" fill={color}/><circle cx="10" cy="4" r="0.8" fill={color}/><circle cx="10" cy="8" r="0.8" fill={color}/><circle cx="10" cy="12" r="0.8" fill={color}/></>),
    edit:    (<><path d="M3 13 L3 11 L11 3 L13 5 L5 13 Z" {...stroke}/></>),
    globe:   (<><circle cx="8" cy="8" r="5" {...stroke}/><ellipse cx="8" cy="8" rx="2" ry="5" {...stroke}/><path d="M3 8 H13" {...stroke}/></>),
  };
  return <svg style={{ width: size, height: size, color }} viewBox="0 0 16 16" aria-hidden="true">{paths[name]}</svg>;
}

export type StatusKey =
  | "verified"
  | "todo"
  | "blocked"
  | "na"
  | "info"
  | "in_flight"
  | "consultant_claims_done";

export function StatusPill({ status }: { status: StatusKey }) {
  const map: Record<StatusKey, { cls: string; label: string }> = {
    verified:                { cls: "pill--verified", label: "Verified" },
    todo:                    { cls: "pill--todo",     label: "To do" },
    blocked:                 { cls: "pill--blocked",  label: "Blocked" },
    na:                      { cls: "pill--na",       label: "N/A" },
    info:                    { cls: "pill--info",     label: "Info" },
    in_flight:               { cls: "pill--inflight", label: "In flight" },
    consultant_claims_done:  { cls: "pill--claims",   label: "Claimed" },
  };
  const m = map[status] || map.todo;
  return (
    <span className={`pill ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

export function GeoChip({ code }: { code: string }) {
  const colors: Record<string, [string, string, string]> = {
    EC: ["oklch(0.74 0.16 70)", "oklch(0.55 0.2 240)", "oklch(0.65 0.2 25)"],
    US: ["oklch(0.92 0.01 100)", "oklch(0.55 0.16 250)", "oklch(0.65 0.2 25)"],
    "US/EC": ["oklch(0.74 0.16 70)", "oklch(0.55 0.16 250)", "oklch(0.65 0.18 145)"],
  };
  const c = colors[code] || ["var(--text-3)", "var(--text-3)", "var(--text-3)"];
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      <span style={{ width: 4, height: 8, borderRadius: 2, background: c[0] }} />
      <span style={{ width: 4, height: 8, borderRadius: 2, background: c[1] }} />
      <span style={{ width: 4, height: 8, borderRadius: 2, background: c[2] }} />
      <span className="mono" style={{ fontSize: 10, color: "var(--text-2)", marginLeft: 4 }}>{code}</span>
    </span>
  );
}

export function EntityChip({ entity }: { entity: Entity }) {
  const c =
    entity.color === "amber" ? "var(--amber)" :
    entity.color === "green" ? "var(--green)" :
    "var(--sky)";
  const initials = entity.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        background: `oklch(from ${c} l c h / 0.15)`,
        color: c,
        border: `1px solid oklch(from ${c} l c h / 0.4)`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {initials}
    </span>
  );
}

export function CompanyMark({ entity }: { entity: Entity }) {
  const c = entity.color === "green" ? "var(--green)" : entity.color === "sky" ? "var(--sky)" : "var(--amber)";
  const initials = entity.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `oklch(from ${c} l c h / 0.14)`,
        border: `1px solid oklch(from ${c} l c h / 0.4)`,
        color: c,
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {initials}
    </span>
  );
}
