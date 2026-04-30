// /home — minimal real-data landing. Just date, brand line, nav links, and
// the decorative globe. Counters were tried (compliance / harvest payments /
// expense weeks) but didn't add operational value, so they're gone. Real
// metrics belong on the pillar pages, not on the splash.

import Link from "next/link";
import { Globe } from "@/components/design/globe";
import { Icon } from "@/components/design/icons";

const LINKS: Array<{ href: string; label: string; hint: string }> = [
  { href: "/pending", label: "Pending Items", hint: "what's open" },
  { href: "/expenses", label: "Expenses", hint: "weekly payments out" },
  { href: "/harvests", label: "Harvests", hint: "field → processor → payment" },
  { href: "/companies", label: "Companies", hint: "Finca · PureSol · processors" },
  { href: "/globe", label: "Globe", hint: "the corridor" },
];

export default async function HomePage() {
  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: -180,
          transform: "translateY(-50%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Globe size={780} opacity={0.42} tilt={-0.3} />
      </div>

      <div style={{ width: "100%", maxWidth: 760, padding: "64px 32px 48px", position: "relative", zIndex: 1 }}>
        <div className="label" style={{ marginBottom: 14 }}>{currentDateStamp()}</div>
        <h1 style={{ font: "500 36px/1.1 var(--font-display)", letterSpacing: "-0.025em", margin: 0, color: "var(--text-0)" }}>
          <span style={{ color: "var(--text-2)" }}>Ecuador</span> Engine
        </h1>
        <div style={{ marginTop: 10, color: "var(--text-2)", fontSize: 13.5 }}>
          Internal operations · Finca del Dragón × PureSol Imports.
        </div>

        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 0 }}>
          {LINKS.map((b, i) => (
            <Link
              key={b.href}
              href={b.href}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: 16,
                padding: "16px 0",
                borderTop: "1px solid var(--line-soft)",
                borderBottom: i === LINKS.length - 1 ? "1px solid var(--line-soft)" : 0,
                color: "var(--text-0)",
                textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{b.label}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{b.hint}</span>
              </span>
              <Icon name="chev" size={12} color="var(--text-3)" />
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: 64,
            paddingTop: 18,
            borderTop: "1px solid var(--line-soft)",
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          GYE → MIA · ~5d at sea · 40′ FCL ≈ 960 cartons
        </div>
      </div>
    </div>
  );
}

function currentDateStamp(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  // "Thu, Apr 30, 2026" → "THU · APR 30 · 2026"
  const [wd, md, yr] = fmt.format(new Date()).replace(/,/g, "").split(" ").reduce<string[]>((acc, part, i) => {
    if (i === 0) acc[0] = part;
    else if (i === 1 || i === 2) acc[1] = (acc[1] ? acc[1] + " " : "") + part;
    else acc[2] = part;
    return acc;
  }, []);
  return `${wd} · ${md} · ${yr}`.toUpperCase();
}
