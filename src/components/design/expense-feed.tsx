// Chronological feed of every expense entry. Server component receives the
// rows from the page; each row is a client component that opens the drawer.

import type { ExpenseRow as ExpenseRowType } from "@/lib/queries/expenses";
import { ExpenseRow } from "./expense-row";

export function ExpenseFeed({ rows }: { rows: ExpenseRowType[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
        No expense entries yet.
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <ExpenseRow key={r.id} item={r} isFirst={i === 0} />
      ))}
    </div>
  );
}
