"use client";

// Single compliance row that opens the drawer when clicked. Split out so the
// CompanyPage can stay a server component that just maps over DB rows.

import type { ComplianceItem } from "@/lib/data";
import { Icon, StatusPill } from "./icons";
import { useDrawer } from "./drawer";

export function ComplianceRow({ item, isFirst }: { item: ComplianceItem; isFirst: boolean }) {
  const { openCompliance } = useDrawer();
  return (
    <button
      onClick={() => openCompliance(item)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 100px 22px",
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
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</span>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
          <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.area}</span>
          {item.responsible ? <span> · {item.responsible}</span> : null}
        </span>
      </span>
      <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{item.jurisdiction}</span>
      <StatusPill status={item.status} />
      <Icon name="chev" size={11} color="var(--text-3)" />
    </button>
  );
}
