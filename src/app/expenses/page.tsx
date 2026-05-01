// /expenses — narrow page that ONLY shows farm expenses (payments out).
// Settlements / capital flow / KPI dashboards left this page in James's
// review pass and will live on a future balance-sheet surface that pulls
// from multiple pillars. Tabs: Data Entry, View, Feed.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { ExpenseTabs } from "@/components/design/expense-tabs";
import { getWeeklyGrid, getExpenseFeed, getWeekRows } from "@/lib/queries/expenses";
import { formatUsd } from "@/lib/money";

const YEARS = [2022, 2023, 2024, 2025, 2026];

type TabKey = "entry" | "view" | "feed";
const VALID_TABS: TabKey[] = ["entry", "view", "feed"];

function mostRecentSunday(): string {
  const d = new Date();
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; tab?: string; week?: string }>;
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

  const tab: TabKey = VALID_TABS.includes(params.tab as TabKey) ? (params.tab as TabKey) : "view";
  const weekParam =
    params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : mostRecentSunday();

  const [grid, feed, weekBundle] = await Promise.all([
    getWeeklyGrid(filters),
    getExpenseFeed(filters),
    getWeekRows(weekParam),
  ]);

  // Single header stat: total expenses out for the selected scope. Net /
  // settlements / capital flow happen on the (future) balance-sheet page.
  let grossTotal = 0;
  for (const w of grid.weeks) grossTotal += Number(w.gross);
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Expenses
            </h1>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span className="label">Total</span>
              <span className="mono num money-out" style={{ fontSize: 16, fontWeight: 500 }}>
                {formatUsd(grossTotal)}
              </span>
            </span>
          </div>
          <YearPicker selected={isAll ? "all" : String(year)} />

          <ExpenseTabs
            grid={grid}
            feed={feed}
            weekBundle={weekBundle}
            initialWeek={weekParam}
            initialTab={tab}
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
