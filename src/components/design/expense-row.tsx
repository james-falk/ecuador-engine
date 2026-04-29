"use client";

// One row in the expense feed. Click to open the drawer.

import { type ExpenseRow as ExpenseRowType, CATEGORY_LABEL } from "@/lib/queries/expenses";
import { formatUsd } from "@/lib/money";
import { Icon } from "./icons";
import { useDrawer } from "./drawer";

export function ExpenseRow({ item, isFirst }: { item: ExpenseRowType; isFirst: boolean }) {
  const { openExpense } = useDrawer();
  const label = item.categoryLabel || CATEGORY_LABEL[item.categoryType];

  return (
    <button
      onClick={() => openExpense(item)}
      style={{
        display: "grid",
        gridTemplateColumns: "82px 1fr 130px 100px 22px",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 16px",
        background: "var(--bg-1)",
        border: 0,
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{item.entryDate}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
          <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {item.categoryType.replace("_", " ")}
          </span>
          {item.payee ? <span> · {item.payee}</span> : null}
        </span>
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>{item.source ?? ""}</span>
      <span className="mono num" style={{ fontSize: 13, color: "var(--text-0)", textAlign: "right", fontWeight: 500 }}>
        {formatUsd(item.amountUsd)}
      </span>
      <Icon name="chev" size={11} color="var(--text-3)" />
    </button>
  );
}
