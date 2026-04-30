// /expenses — weekly grid + feed. Server component fetches both datasets;
// the client tab switcher toggles between them. `?year=YYYY` (or `?year=all`)
// filters all three feeds; default = current calendar year.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { ExpenseTabs } from "@/components/design/expense-tabs";
import { getWeeklyGrid, getExpenseFeed } from "@/lib/queries/expenses";
import { getCashMovementFeed } from "@/lib/queries/cash-movements";
import { formatUsd } from "@/lib/money";

const YEARS = [2022, 2023, 2024, 2025, 2026];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
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

  const [grid, feed, cashMovements] = await Promise.all([
    getWeeklyGrid(filters),
    getExpenseFeed(filters),
    getCashMovementFeed(filters),
  ]);

  // Header tallies — sum across the visible weeks.
  let grossTotal = 0;
  let inTotal = 0;
  let capitalInTotal = 0;
  let capitalOutTotal = 0;
  for (const w of grid.weeks) {
    grossTotal += Number(w.gross);
    inTotal += Number(w.settlementsIn);
    capitalInTotal += Number(w.capitalIn);
    capitalOutTotal += Number(w.capitalOut);
  }
  const netTotal = inTotal - grossTotal;
  const scopeLabel = year !== null ? String(year) : "All years";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Expenses", scopeLabel]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {grid.weeks.length} weeks · {feed.length} entries
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 8, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Cash in &amp; out
            </h1>
            <Stat label="Gross out" value={formatUsd(grossTotal)} color="var(--text-2)" />
            <Stat label="Settlements in" value={formatUsd(inTotal)} color="var(--green)" />
            <Stat label="Operating net" value={formatUsd(netTotal)} color={netTotal >= 0 ? "var(--green)" : "var(--rose)"} bold />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <span className="label" style={{ color: "var(--text-3)" }}>Capital flow</span>
            <Stat label="US in" value={formatUsd(capitalInTotal)} color="var(--sky)" />
            <Stat label="US out" value={formatUsd(capitalOutTotal)} color="var(--amber)" />
          </div>
          <YearPicker selected={isAll ? "all" : String(year)} />

          <ExpenseTabs grid={grid} feed={feed} cashMovements={cashMovements} />
        </div>
      </div>
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
              background: active ? "var(--surface-2)" : "transparent",
              border: `1px solid ${active ? "var(--border-2)" : "var(--border-1)"}`,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
