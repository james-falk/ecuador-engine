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

  // Column layout: week | one fr per label | total. Desktop keeps the
  // spreadsheet shape; mobile gets readable per-week cards instead of a
  // squeezed/scrolled 10-column table.
  const cols = `120px ${grid.columns.map(() => "1fr").join(" ")} 100px`;

  return (
    <>
      <div className="ee-grid-scroll ee-expense-grid-desktop">
        <div className="ee-expense-grid-table" style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
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

      <div className="ee-expense-week-cards">
        {grid.weeks.map((w) => {
          const activeCells = grid.columns
            .map((label) => ({ label, cell: w.byColumn[label], amount: Number(w.byColumn[label]?.amount ?? "0") }))
            .filter((item) => item.amount > 0);

          return (
            <section key={w.weekStartDate} className="ee-expense-week-card">
              <div className="ee-expense-week-card-head">
                <span>
                  <span className="label">Week of</span>{" "}
                  <span className="mono">{w.weekStartDate}</span>
                </span>
                <span className="mono num money-out">{formatUsdShort(w.gross)}</span>
              </div>

              {activeCells.length === 0 ? (
                <div className="ee-expense-empty-week">No expenses recorded.</div>
              ) : (
                <div className="ee-expense-week-lines">
                  {activeCells.map(({ label, cell, amount }) => (
                    <div key={label} className="ee-expense-week-line">
                      <div>
                        <div className="ee-expense-week-label">{label}</div>
                        {cell?.note && <div className="ee-expense-week-note">{cell.note}</div>}
                      </div>
                      <span className="mono num">{formatUsdShort(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
