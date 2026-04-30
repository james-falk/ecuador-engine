// /home — clean real-data dashboard. The previous version pulled mock todos /
// pending / ops from src/lib/data.ts; that's all gone. Today the home shows:
//   • current date stamp
//   • a small set of real counters (compliance verified, harvest payments
//     tracked, weeks of expense data)
//   • a footer with route info + verified ratio
//   • the decorative globe in the background
//
// Recent-activity feed is intentionally absent — it was mock and there's no
// derivable activity stream yet. It'll come back when one of the pillars
// emits real events.

import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getAllCompliance } from "@/lib/queries/compliance";
import { getHarvestStats } from "@/lib/queries/harvests";
import { Globe } from "@/components/design/globe";
import { Icon } from "@/components/design/icons";

const LINKS: Array<{ href: string; label: string; hint: string }> = [
  { href: "/pending", label: "Pending Items", hint: "what's open" },
  { href: "/expenses", label: "Expenses", hint: "cash in & out" },
  { href: "/harvests", label: "Harvests", hint: "field → processor → payment" },
  { href: "/globe", label: "Globe", hint: "the corridor" },
];

export default async function HomePage() {
  const [compliance, harvestStats, weeksRow] = await Promise.all([
    getAllCompliance(),
    getHarvestStats(),
    db.execute<{ weeks: string }>(
      sql`SELECT COUNT(DISTINCT week_start_date)::text AS weeks FROM expense_entries`
    ),
  ]);

  const verifiedCount = compliance.filter((c) => c.status === "verified").length;
  const totalCompliance = compliance.length;
  const harvestCount = harvestStats.count;
  const harvestPending = harvestStats.pendingCount;
  const weeksTracked = parseInt(weeksRow.rows[0]?.weeks ?? "0", 10);

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

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1,
            background: "var(--line-soft)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <Counter
            label="Compliance"
            primary={`${verifiedCount}/${totalCompliance}`}
            hint="verified"
          />
          <Counter
            label="Harvest payments"
            primary={String(harvestCount)}
            hint={harvestPending > 0 ? `${harvestPending} awaiting PDF` : "all settled"}
          />
          <Counter
            label="Expense weeks"
            primary={String(weeksTracked)}
            hint="tracked"
          />
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>GYE → MIA · ~5d at sea · 40′ FCL ≈ 960 cartons</span>
          <span>{verifiedCount}/{totalCompliance} verified</span>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, primary, hint }: { label: string; primary: string; hint: string }) {
  return (
    <div style={{ background: "var(--bg-1)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="mono num" style={{ fontSize: 22, fontWeight: 500, color: "var(--text-0)" }}>{primary}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</span>
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
