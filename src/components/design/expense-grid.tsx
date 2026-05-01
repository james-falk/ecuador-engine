// Weekly grid: rows = weeks (newest first), columns = category types,
// gross at the right edge of each row.
//
// Trimmed for the narrowed /expenses page: the In / Net / US-in / US-out
// columns moved to the Income page (cross-pillar money view). This grid is
// strictly expenses-out.
//
// Server component — pure presentational, click-free. To open a row's
// details, the Feed tab is the entry point.

import { CATEGORY_LABEL, type WeeklyGrid } from "@/lib/queries/expenses";
import { formatUsdShort } from "@/lib/money";

export function ExpenseGrid({ grid }: { grid: WeeklyGrid }) {
  if (grid.weeks.length === 0) {
    return (
      <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
        No weeks to display yet.
      </div>
    );
  }

  // Column layout: week | one fr per category | gross
  const cols = `120px ${grid.categories.map(() => "1fr").join(" ")} 100px`;

  return (
    <div className="ee-grid-scroll">
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 0,
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--line)",
            padding: "10px 14px",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          <span>Week of</span>
          {grid.categories.map((c) => (
            <span key={c} style={{ textAlign: "right" }}>{CATEGORY_LABEL[c]}</span>
          ))}
          <span style={{ textAlign: "right", color: "var(--amber)" }}>Total</span>
        </div>

        {grid.weeks.map((w, i) => (
          <div
            key={w.weekStartDate}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 0,
              padding: "12px 14px",
              borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
              fontSize: 12.5,
              alignItems: "center",
            }}
          >
            <span className="mono" style={{ color: "var(--text-1)" }}>{w.weekStartDate}</span>
            {grid.categories.map((c) => {
              const v = Number(w.byCategory[c]);
              return (
                <span
                  key={c}
                  className="mono num"
                  style={{
                    textAlign: "right",
                    color: v > 0 ? "var(--text-1)" : "var(--text-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {v > 0 ? formatUsdShort(v) : "—"}
                </span>
              );
            })}
            <span className="mono num money-out" style={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {formatUsdShort(w.gross)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
