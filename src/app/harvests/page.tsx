// /harvests — operational view of every delivery to a processor + its
// settlement state. Server component.

import { Topbar } from "@/components/design/topbar";
import { HarvestRow } from "@/components/design/harvest-row";
import { getHarvestFeed, getHarvestStats } from "@/lib/queries/harvests";
import { formatUsd } from "@/lib/money";

export default async function HarvestsPage() {
  const [rows, stats] = await Promise.all([
    getHarvestFeed(),
    getHarvestStats(),
  ]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Harvests"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {stats.count} harvests · {stats.pendingCount} pending
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Field → processor → settlement
            </h1>
            <StatRow stats={stats} />
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
              No harvests yet.
            </div>
          ) : (
            <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
              {rows.map((r, i) => (
                <HarvestRow key={r.id} item={r} isFirst={i === 0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ stats }: { stats: Awaited<ReturnType<typeof getHarvestStats>> }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
      <Stat label="kg delivered" value={`${Number(stats.kgDelivered).toFixed(0)} kg`} color="var(--text-2)" />
      <Stat label="kg processed" value={`${Number(stats.kgProcessed).toFixed(0)} kg`} color="var(--text-1)" />
      <Stat label="waste" value={`${stats.wastePct}%`} color="var(--amber)" />
      <Stat label="net pay" value={formatUsd(stats.netPayUsd)} color="var(--green)" bold />
    </div>
  );
}

function Stat({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span className="label">{label}</span>
      <span className="mono num" style={{ fontSize: 14, color, fontWeight: bold ? 600 : 500 }}>{value}</span>
    </span>
  );
}
