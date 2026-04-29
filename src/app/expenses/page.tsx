// /expenses — weekly grid + feed. Server component fetches both datasets;
// the client tab switcher toggles between them.

import { Topbar } from "@/components/design/topbar";
import { ExpenseTabs } from "@/components/design/expense-tabs";
import { getWeeklyGrid, getExpenseFeed } from "@/lib/queries/expenses";
import { getCashMovementFeed } from "@/lib/queries/cash-movements";
import { formatUsd } from "@/lib/money";

export default async function ExpensesPage() {
  const [grid, feed, cashMovements] = await Promise.all([
    getWeeklyGrid(),
    getExpenseFeed(),
    getCashMovementFeed(),
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Expenses"]}
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            <span className="label" style={{ color: "var(--text-3)" }}>Capital flow</span>
            <Stat label="US in" value={formatUsd(capitalInTotal)} color="var(--sky)" />
            <Stat label="US out" value={formatUsd(capitalOutTotal)} color="var(--amber)" />
          </div>

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
