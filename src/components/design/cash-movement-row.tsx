"use client";

import { type CashMovementRow as CashMovementRowType, DIRECTION_LABEL } from "@/lib/queries/cash-movements";
import { formatUsd } from "@/lib/money";
import { Icon } from "./icons";
import { useDrawer } from "./drawer";

export function CashMovementRow({ item, isFirst }: { item: CashMovementRowType; isFirst: boolean }) {
  const { openCashMovement } = useDrawer();
  const isIn = item.direction === "in_to_ec";
  const accent = isIn ? "var(--green)" : "var(--amber)";

  return (
    <button
      onClick={() => openCashMovement(item)}
      style={{
        display: "grid",
        gridTemplateColumns: "82px 100px 1fr 100px 22px",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 16px",
        background: "var(--bg-1)",
        border: 0,
        borderLeft: `2px solid ${accent}`,
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{item.transferDate}</span>
      <span className="mono" style={{ fontSize: 10.5, color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {DIRECTION_LABEL[item.direction]}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.counterparty || "—"}</span>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{item.notes || ""}</span>
      </span>
      <span className="mono num" style={{ fontSize: 13, color: "var(--text-0)", textAlign: "right", fontWeight: 500 }}>
        {formatUsd(item.amountUsd)}
      </span>
      <Icon name="chev" size={11} color="var(--text-3)" />
    </button>
  );
}
