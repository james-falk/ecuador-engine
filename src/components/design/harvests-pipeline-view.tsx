// Pipeline view of harvests — every harvest grouped by current stage.
// Status is computed from the harvest + its settlements (no extra query).
//
// Status rules (in priority order):
//   • complete         — has at least one paid settlement AND no balance owed
//                         (no expected, OR sum(paid) >= expected)
//   • awaiting_balance — partial paid (sum > 0) but expected > received
//   • awaiting_payment — kg report exists (kg_processed > 0) but no payment
//   • awaiting_report  — harvest exists but kg_processed == 0 AND nothing paid
// Plus a Farm picking section that shows farm_harvests not yet linked to a
// processor delivery (still in the field side of the pipeline).

"use client";

import * as React from "react";
import type { HarvestRow } from "@/lib/queries/harvests";
import type { FarmHarvestRow } from "@/lib/queries/farm-harvests";
import { formatUsd } from "@/lib/money";

type Status =
  | "complete"
  | "awaiting_balance"
  | "awaiting_payment"
  | "awaiting_report";

function statusOf(h: HarvestRow): Status {
  let received = 0;
  let expected = 0;
  let kgReported = 0;
  let hasPayment = false;
  for (const s of h.settlements) {
    received += Number(s.netPayUsd) || 0;
    const exp = Number(s.expectedTotalUsd ?? 0);
    if (exp > expected) expected = exp;
    const kp = Number(s.kgProcessed) || 0;
    if (kp > kgReported) kgReported = kp;
    if (s.paidDate && Number(s.netPayUsd) > 0) hasPayment = true;
  }
  if (received > 0 && expected > 0 && expected - received > 0.01) return "awaiting_balance";
  if (received > 0 && (expected === 0 || received >= expected - 0.01)) return "complete";
  if (received === 0 && kgReported > 0) return "awaiting_payment";
  if (received === 0 && kgReported === 0 && !hasPayment) return "awaiting_report";
  return "complete";
}

const STATUS_META: Record<Status, { label: string; color: string; hint: string }> = {
  awaiting_report:  { label: "Awaiting report",  color: "var(--amber)",  hint: "Processor hasn't sent the report back yet." },
  awaiting_payment: { label: "Awaiting payment", color: "var(--rose)",   hint: "Report filed, payment hasn't landed." },
  awaiting_balance: { label: "Awaiting balance", color: "var(--sky)",    hint: "Advance received; balance still outstanding." },
  complete:         { label: "Complete",         color: "var(--green)",  hint: "Paid in full." },
};

const ORDER: Status[] = ["awaiting_report", "awaiting_payment", "awaiting_balance", "complete"];

export function HarvestsPipelineView({
  harvests,
  farmHarvests,
}: {
  harvests: HarvestRow[];
  farmHarvests: FarmHarvestRow[];
}) {
  const [showComplete, setShowComplete] = React.useState(false);

  // Group harvests by status.
  const byStatus = new Map<Status, HarvestRow[]>();
  for (const h of harvests) {
    const s = statusOf(h);
    if (!byStatus.has(s)) byStatus.set(s, []);
    byStatus.get(s)!.push(h);
  }

  // Farm picking events not yet linked to a delivery.
  const orphanFarm = farmHarvests.filter((f) => !f.delivery && (f.bucketCount ?? 0) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Farm picking — pre-delivery */}
      {orphanFarm.length > 0 && (
        <PipelineSection
          title="Farm picking — not yet delivered"
          color="var(--text-2)"
          hint="Buckets picked but no processor delivery recorded."
          count={orphanFarm.length}
        >
          {orphanFarm.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr auto",
                gap: 14,
                padding: "12px 14px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                fontSize: 12.5,
              }}
            >
              <span className="mono" style={{ color: "var(--text-2)" }}>{f.harvestDate}</span>
              <span style={{ color: "var(--text-1)" }}>
                {f.bucketCount?.toLocaleString() ?? "—"} buckets
                {f.flowerCount !== null ? ` · ${f.flowerCount.toLocaleString()} flowers` : ""}
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {f.recordedBy ?? ""}
              </span>
            </div>
          ))}
        </PipelineSection>
      )}

      {/* Per-status sections */}
      {ORDER.map((s) => {
        const list = byStatus.get(s) ?? [];
        if (list.length === 0) return null;
        if (s === "complete" && !showComplete) {
          return (
            <PipelineSection
              key={s}
              title={STATUS_META[s].label}
              color={STATUS_META[s].color}
              hint={STATUS_META[s].hint}
              count={list.length}
              right={
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowComplete(true)}
                  style={{ fontSize: 11 }}
                >
                  Show
                </button>
              }
            >
              <div style={{ padding: "16px 14px", color: "var(--text-3)", fontSize: 12 }}>
                {list.length} complete harvest{list.length === 1 ? "" : "s"} — collapsed by default.
              </div>
            </PipelineSection>
          );
        }
        return (
          <PipelineSection
            key={s}
            title={STATUS_META[s].label}
            color={STATUS_META[s].color}
            hint={STATUS_META[s].hint}
            count={list.length}
            right={
              s === "complete" ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowComplete(false)}
                  style={{ fontSize: 11 }}
                >
                  Hide
                </button>
              ) : null
            }
          >
            {list.map((h, i) => (
              <PipelineRow key={h.id} h={h} status={s} isFirst={i === 0} />
            ))}
          </PipelineSection>
        );
      })}

      {orphanFarm.length === 0 && byStatus.size === 0 && (
        <div
          style={{
            padding: "32px 18px",
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 12.5,
            border: "1px dashed var(--line-soft)",
            borderRadius: 10,
          }}
        >
          No harvests in this window.
        </div>
      )}
    </div>
  );
}

function PipelineSection({
  title,
  hint,
  color,
  count,
  right,
  children,
}: {
  title: string;
  hint?: string;
  color: string;
  count: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color,
            padding: "2px 6px",
            borderRadius: 3,
            background: `oklch(from ${color} l c h / 0.12)`,
          }}
        >
          {title} · {count}
        </span>
        {hint && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{hint}</span>}
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
        {children}
      </div>
    </section>
  );
}

function PipelineRow({ h, status, isFirst }: { h: HarvestRow; status: Status; isFirst: boolean }) {
  let received = 0;
  let expected = 0;
  let kgProcessed = 0;
  for (const s of h.settlements) {
    received += Number(s.netPayUsd) || 0;
    const exp = Number(s.expectedTotalUsd ?? 0);
    if (exp > expected) expected = exp;
    const kp = Number(s.kgProcessed) || 0;
    if (kp > kgProcessed) kgProcessed = kp;
  }
  const remaining = expected > 0 ? Math.max(0, expected - received) : 0;
  const isHistorical = !!h.lotNumber?.startsWith("master_sheet:");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 100px 110px 110px",
        gap: 14,
        padding: "12px 14px",
        alignItems: "center",
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        fontSize: 12.5,
      }}
    >
      <span className="mono" style={{ color: "var(--text-2)" }}>{h.harvestDate}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ color: h.processorName ? "var(--text-1)" : "var(--text-3)" }}>
          {h.processorName ?? "Unattributed"}
        </span>
        {isHistorical && (
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            historical lump-sum
          </span>
        )}
      </span>
      <span className="mono num" style={{ color: kgProcessed > 0 ? "var(--text-1)" : "var(--text-3)", textAlign: "right" }}>
        {kgProcessed > 0 ? `${kgProcessed} kg` : "—"}
      </span>
      <span className="mono num money-in" style={{ textAlign: "right", fontWeight: 500 }}>
        {received > 0 ? formatUsd(received.toFixed(2)) : "—"}
      </span>
      <span
        className="mono num"
        style={{
          textAlign: "right",
          color:
            status === "awaiting_balance" ? "var(--sky)" :
            status === "awaiting_payment" ? "var(--rose)" :
            "var(--text-3)",
        }}
      >
        {status === "awaiting_balance" ? formatUsd(remaining.toFixed(2)) :
         status === "awaiting_payment" && expected > 0 ? `${formatUsd(expected.toFixed(2))} due` :
         status === "awaiting_report" ? "—" :
         "paid"}
      </span>
    </div>
  );
}
