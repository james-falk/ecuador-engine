"use client";

// Client-side tab switcher for /expenses. Narrowed to the 3 tabs that are
// actually about expenses (payments out): Data Entry, View, Feed.
// US wires (capital movements) and Insights / KPIs left this page in
// James's review pass — those belong on a future balance-sheet surface
// alongside settlements and capital flow.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WeeklyGrid, ExpenseRow as ExpenseRowType, WeekRowsBundle } from "@/lib/queries/expenses";
import { ExpenseGrid } from "./expense-grid";
import { ExpenseFeed } from "./expense-feed";
import { ExpenseDataEntry } from "./expense-data-entry";

type Tab = "entry" | "view" | "feed";

export function ExpenseTabs({
  grid,
  feed,
  weekBundle,
  initialWeek,
  initialTab,
}: {
  grid: WeeklyGrid;
  feed: ExpenseRowType[];
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
    </div>
  );
}
