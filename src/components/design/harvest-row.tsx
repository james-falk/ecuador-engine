"use client";

// One row in the harvests list. Click to open the drawer.

import type { HarvestRow as HarvestRowType } from "@/lib/queries/harvests";
import { formatUsd } from "@/lib/money";
import { Icon } from "./icons";
import { useDrawer } from "./drawer";

export function HarvestRow({ item, isFirst }: { item: HarvestRowType; isFirst: boolean }) {
  const { openHarvest } = useDrawer();
  const settled = !!item.settlement;
  const paid = !!item.settlement?.paidDate;

  const statusColor = !settled ? "var(--amber)" : paid ? "var(--green)" : "var(--sky)";
  const statusLabel = !settled ? "Pending" : paid ? "Paid" : "Settled";

  return (
    <button
      onClick={() => openHarvest(item)}
      style={{
        display: "grid",
        gridTemplateColumns: "92px 80px 1fr 90px 110px 22px",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "14px 16px",
        background: "var(--bg-1)",
        border: 0,
        borderLeft: `2px solid ${statusColor}`,
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
      }}
    >
      <span className="mono" style={{ fontSize: 11.5, color: "var(--text-1)" }}>{item.harvestDate}</span>
      <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
        Lot {item.lotNumber ?? "—"}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.processorName}</span>
        <span className="mono" style={{ fontSize: 10.5, color: statusColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {statusLabel}
          {item.settlement && (
            <span style={{ color: "var(--text-3)", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
              · {item.settlement.kgProcessed}kg processed · waste {item.settlement.wastePct ?? "—"}%
            </span>
          )}
        </span>
      </span>
      <span className="mono num" style={{ fontSize: 12, color: "var(--text-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {Number(item.kgDelivered).toFixed(0)} kg
      </span>
      <span className="mono num" style={{ fontSize: 13, color: settled ? "var(--text-0)" : "var(--text-3)", textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {item.settlement ? formatUsd(item.settlement.netPayUsd) : "—"}
      </span>
      <Icon name="chev" size={11} color="var(--text-3)" />
    </button>
  );
}
