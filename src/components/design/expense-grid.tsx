// Weekly grid: rows = weeks (newest first), columns = category types,
// gross/settlements-in/net at the right edge of each row.
// Server component — pure presentational.

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

  // Column layout: week | one fr per category | gross | settlements-in | net | US-in | US-out
  const cols = `120px ${grid.categories.map(() => "1fr").join(" ")} 90px 90px 100px 80px 80px`;

  return (
    <div className="ee-grid-scroll">
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
      {/* header */}
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
        <span style={{ textAlign: "right", color: "var(--text-2)" }}>Gross</span>
        <span style={{ textAlign: "right", color: "var(--green)" }}>In</span>
        <span style={{ textAlign: "right", color: "var(--text-0)" }}>Net</span>
        <span style={{ textAlign: "right", color: "var(--sky)" }}>US in</span>
        <span style={{ textAlign: "right", color: "var(--amber)" }}>US out</span>
      </div>

      {/* body */}
      {grid.weeks.map((w, i) => {
        const netNum = Number(w.net);
        const netColor = netNum >= 0 ? "var(--green)" : "var(--rose)";
        return (
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
            <span className="mono num" style={{ textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {formatUsdShort(w.gross)}
            </span>
            <span className="mono num" style={{ textAlign: "right", color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>
              {Number(w.settlementsIn) > 0 ? formatUsdShort(w.settlementsIn) : "—"}
            </span>
            <span
              className="mono num"
              style={{ textAlign: "right", color: netColor, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
            >
              {formatUsdShort(w.net)}
            </span>
            <span
              className="mono num"
              style={{ textAlign: "right", color: Number(w.capitalIn) > 0 ? "var(--sky)" : "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
            >
              {Number(w.capitalIn) > 0 ? formatUsdShort(w.capitalIn) : "—"}
            </span>
            <span
              className="mono num"
              style={{ textAlign: "right", color: Number(w.capitalOut) > 0 ? "var(--amber)" : "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
            >
              {Number(w.capitalOut) > 0 ? formatUsdShort(w.capitalOut) : "—"}
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}
