// Weekly grid: rows = weeks (newest first), columns = master-sheet labels
// (Water / Jornales / Chavito / Engineer / Isaac / Other …) with a Total at
// the right edge. The Other column shows its note inline below the amount.
//
// Server component — pure presentational, click-free. To open a row's
// details, the Feed tab is the entry point.

import type { WeeklyGrid } from "@/lib/queries/expenses";
import { formatUsdShort } from "@/lib/money";

export function ExpenseGrid({ grid }: { grid: WeeklyGrid }) {
  if (grid.weeks.length === 0) {
    return (
      <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
        No weeks to display yet.
      </div>
    );
  }

  // Column layout: week | one fr per label | total
  const cols = `120px ${grid.columns.map(() => "1fr").join(" ")} 100px`;

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
          {grid.columns.map((c) => (
            <span key={c} style={{ textAlign: "right" }}>{c}</span>
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
              alignItems: "start",
            }}
          >
            <span className="mono" style={{ color: "var(--text-1)", paddingTop: 2 }}>{w.weekStartDate}</span>
            {grid.columns.map((c) => {
              const cell = w.byColumn[c];
              const v = Number(cell?.amount ?? "0");
              return (
                <span
                  key={c}
                  style={{
                    textAlign: "right",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                  }}
                >
                  <span
                    className="mono num"
                    style={{
                      color: v > 0 ? "var(--text-1)" : "var(--text-3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {v > 0 ? formatUsdShort(v) : "—"}
                  </span>
                  {cell?.note && v > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-3)",
                        textAlign: "right",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={cell.note}
                    >
                      {cell.note}
                    </span>
                  )}
                </span>
              );
            })}
            <span className="mono num money-out" style={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>
              {formatUsdShort(w.gross)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
