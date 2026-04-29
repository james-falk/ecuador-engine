"use client";

// Client-side tab switcher for /expenses. Server fetches all three datasets;
// this component just toggles between Grid / Feed / Cash views without a
// route round-trip (preserves drawer state, avoids re-render of layout).

import * as React from "react";
import type { WeeklyGrid, ExpenseRow as ExpenseRowType } from "@/lib/queries/expenses";
import type { CashMovementRow as CashMovementRowType } from "@/lib/queries/cash-movements";
import { ExpenseGrid } from "./expense-grid";
import { ExpenseFeed } from "./expense-feed";
import { CashMovementFeed } from "./cash-movement-feed";

type Tab = "grid" | "feed" | "cash";

export function ExpenseTabs({
  grid,
  feed,
  cashMovements,
}: {
  grid: WeeklyGrid;
  feed: ExpenseRowType[];
  cashMovements: CashMovementRowType[];
}) {
  const [tab, setTab] = React.useState<Tab>("grid");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "inline-flex",
          padding: 3,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line-soft)",
          alignSelf: "flex-start",
        }}
      >
        {(
          [
            { id: "grid", label: "Weekly grid" },
            { id: "feed", label: `Feed · ${feed.length}` },
            { id: "cash", label: `US wires · ${cashMovements.length}` },
          ] as Array<{ id: Tab; label: string }>
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setTab(o.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              background: tab === o.id ? "var(--bg-4)" : "transparent",
              color: tab === o.id ? "var(--text-0)" : "var(--text-2)",
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tab === "grid" && <ExpenseGrid grid={grid} />}
      {tab === "feed" && <ExpenseFeed rows={feed} />}
      {tab === "cash" && <CashMovementFeed rows={cashMovements} />}
    </div>
  );
}
