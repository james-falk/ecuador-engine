// Chronological list of cash movements. Server component receives the rows;
// each row is a client component that opens the drawer.

import type { CashMovementRow as CashMovementRowType } from "@/lib/queries/cash-movements";
import { CashMovementRow } from "./cash-movement-row";

export function CashMovementFeed({ rows }: { rows: CashMovementRowType[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
        No US-side wires yet.
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <CashMovementRow key={r.id} item={r} isFirst={i === 0} />
      ))}
    </div>
  );
}
