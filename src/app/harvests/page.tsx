// /harvests — two-tab page:
//   • Farm Harvest — picking events: flower count + bucket count + notes,
//     entered manually as they happen.
//   • Reports — what came back from the processor: kg accepted, kg
//     declined, price (net pay). Linked optionally to a farm-harvest.
//
// Year filter applies to both tabs. The previous "lump-sum from master
// sheet" rows from the historical ingest still appear in Reports — they
// have kg=0 and a master_sheet source label.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { HarvestsTabs } from "@/components/design/harvests-tabs";
import { getFarmHarvests, getFarmHarvestStats, getProcessorOptions } from "@/lib/queries/farm-harvests";
import { getHarvestFeed, getHarvestStats } from "@/lib/queries/harvests";

const YEARS = [2022, 2023, 2024, 2025, 2026];

type TabKey = "farm" | "reports" | "payments";
const VALID_TABS: TabKey[] = ["farm", "reports", "payments"];

export default async function HarvestsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const requested = params.year;
  const isAll = requested === "all";
  const year = (() => {
    if (isAll) return null;
    const y = requested ? parseInt(requested, 10) : new Date().getFullYear();
    return Number.isFinite(y) ? y : new Date().getFullYear();
  })();
  const filters = year !== null ? { from: `${year}-01-01`, to: `${year}-12-31` } : {};

  const tab: TabKey = VALID_TABS.includes(params.tab as TabKey) ? (params.tab as TabKey) : "farm";

  const [farmHarvests, farmStats, deliveryFeed, deliveryStats, processorOptions] = await Promise.all([
    getFarmHarvests(filters),
    getFarmHarvestStats(filters),
    getHarvestFeed(filters),
    getHarvestStats(filters),
    getProcessorOptions(),
  ]);

  const scopeLabel = year !== null ? String(year) : "All years";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Harvests", scopeLabel]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {farmStats.count} farm · {deliveryStats.count} reports
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Harvests
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Field → processor → payment.
            </span>
          </div>
          <YearPicker selected={isAll ? "all" : String(year)} />

          <HarvestsTabs
            initialTab={tab}
            farmHarvests={farmHarvests}
            farmStats={farmStats}
            deliveryFeed={deliveryFeed}
            deliveryStats={deliveryStats}
            processorOptions={processorOptions}
          />
        </div>
      </div>
    </div>
  );
}

function YearPicker({ selected }: { selected: string }) {
  const options: Array<{ key: string; label: string; href: string }> = [
    ...YEARS.map((y) => ({ key: String(y), label: String(y), href: `?year=${y}` })),
    { key: "all", label: "All", href: "?year=all" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
      <span className="label" style={{ color: "var(--text-3)", marginRight: 8 }}>Year</span>
      {options.map((o) => {
        const active = o.key === selected;
        return (
          <Link
            key={o.key}
            href={o.href}
            className="mono"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              borderRadius: 4,
              textDecoration: "none",
              color: active ? "var(--text-1)" : "var(--text-3)",
              background: active ? "var(--bg-3)" : "transparent",
              border: `1px solid ${active ? "var(--line)" : "var(--line-soft)"}`,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
