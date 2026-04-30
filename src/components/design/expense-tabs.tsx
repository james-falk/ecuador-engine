"use client";

// Client-side tab switcher for /expenses. Server fetches all datasets; this
// component just toggles between tabs without a route round-trip. The
// active tab persists in the URL (`?tab=entry|view|insights`) so refreshes
// and shared links land on the right surface.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WeeklyGrid, ExpenseRow as ExpenseRowType, WeekRowsBundle } from "@/lib/queries/expenses";
import type { CashMovementRow as CashMovementRowType } from "@/lib/queries/cash-movements";
import { ExpenseGrid } from "./expense-grid";
import { ExpenseFeed } from "./expense-feed";
import { CashMovementFeed } from "./cash-movement-feed";
import { ExpenseDataEntry } from "./expense-data-entry";

type Tab = "entry" | "view" | "feed" | "cash" | "insights";

export function ExpenseTabs({
  grid,
  feed,
  cashMovements,
  weekBundle,
  initialWeek,
  initialTab,
}: {
  grid: WeeklyGrid;
  feed: ExpenseRowType[];
  cashMovements: CashMovementRowType[];
  weekBundle: WeekRowsBundle;
  initialWeek: string;
  initialTab: Tab;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    router.push(`/expenses?${params.toString()}`, { scroll: false });
  }

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
          flexWrap: "wrap",
        }}
      >
        {(
          [
            { id: "entry", label: "Data Entry" },
            { id: "view", label: "View" },
            { id: "feed", label: `Feed · ${feed.length}` },
            { id: "cash", label: `US wires · ${cashMovements.length}` },
            { id: "insights", label: "Insights" },
          ] as Array<{ id: Tab; label: string }>
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => selectTab(o.id)}
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

      {tab === "entry" && <ExpenseDataEntry initialWeek={initialWeek} bundle={weekBundle} />}
      {tab === "view" && <ExpenseGrid grid={grid} />}
      {tab === "feed" && <ExpenseFeed rows={feed} />}
      {tab === "cash" && <CashMovementFeed rows={cashMovements} />}
      {tab === "insights" && (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 13,
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
          }}
        >
          Insights dashboard — coming next.
        </div>
      )}
    </div>
  );
}
