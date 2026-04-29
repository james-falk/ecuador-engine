"use client";

import * as React from "react";
import { entities, type ComplianceItem, type ComplianceStatus } from "@/lib/data";
import { Icon, StatusPill, EntityChip } from "./icons";
import { updateComplianceItem } from "@/lib/actions/compliance";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-3)",
  border: "1px solid var(--line-soft)",
  borderRadius: 8,
  color: "var(--text-0)",
  fontSize: 12.5,
  outline: "none",
};

// Full status set the operator can pick. Order: most-likely-action first.
const STATUS_OPTIONS: ComplianceStatus[] = [
  "todo",
  "in_flight",
  "consultant_claims_done",
  "verified",
  "blocked",
  "na",
];

export function ComplianceDetail({ item, onClose }: { item: ComplianceItem; onClose: () => void }) {
  const [status, setStatus] = React.useState<ComplianceStatus>(item.status);
  const [identifier, setIdentifier] = React.useState(item.identifier || "");
  const [notes, setNotes] = React.useState(item.notes || "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const owner = entities.find((e) => e.id === item.owner);

  const dirty =
    status !== item.status ||
    identifier !== (item.identifier || "") ||
    notes !== (item.notes || "");

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateComplianceItem({
        id: item.id,
        status,
        identifier: identifier.trim() || null,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <BucketChip bucket={item.bucket} />
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
              {item.area} · {item.jurisdiction}
            </span>
          </div>
          <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>{item.title}</h2>
        </div>
        <button onClick={onClose} className="btn btn--ghost"><Icon name="x" size={11} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Status">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  opacity: status === s ? 1 : 0.45,
                  outline: status === s ? "1px solid var(--line-strong)" : "none",
                  outlineOffset: 2,
                  borderRadius: 999,
                }}
              >
                <StatusPill status={s} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Identifier" hint="When verified, the actual reference number (RUC, DUNS, EIN, registration #).">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="—"
            className="mono"
            style={inputStyle}
          />
        </Field>

        <Field label="Owner entity">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: "var(--bg-3)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
            }}
          >
            {owner && (
              <>
                <EntityChip entity={owner} />
                <span style={{ fontSize: 12.5 }}>{owner.name}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}>
                  {owner.kind} · {owner.country}
                </span>
              </>
            )}
          </div>
        </Field>

        <Field label="Responsible">
          <div className="mono" style={{ fontSize: 12, color: "var(--text-1)" }}>{item.responsible}</div>
        </Field>

        <Field label="Evidence">
          <div style={{ fontSize: 12.5, color: item.evidence ? "var(--text-1)" : "var(--text-3)" }}>
            {item.evidence || "No evidence on file yet."}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
          />
        </Field>

        <div className="hr" />

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, color: "var(--text-2)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", width: 80 }}>Oct 29 14:02</span>
              <span>
                Status set to <b style={{ color: "var(--text-0)" }}>{statusLabel(item.status)}</b> from email checklist.
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", width: 80 }}>Oct 12 09:18</span>
              <span>Item created.</span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn--ghost" type="button"><Icon name="mail" size={11} /> Send follow-up</button>
          {error && (
            <span style={{ fontSize: 11, color: "var(--rose)" }}>{error}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={onSave}
            disabled={isPending || !dirty}
            style={{ opacity: !dirty ? 0.5 : 1 }}
          >
            <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

export function BucketChip({ bucket }: { bucket: "importing" | "exporting" | "shipment" }) {
  const map = {
    importing: { label: "Importing", color: "var(--sky)" },
    exporting: { label: "Exporting", color: "var(--green)" },
    shipment:  { label: "Shipment",  color: "var(--amber)" },
  } as const;
  const m = map[bucket];
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: m.color,
        padding: "2px 5px",
        borderRadius: 3,
        background: `oklch(from ${m.color} l c h / 0.12)`,
      }}
    >
      {m.label}
    </span>
  );
}

function statusLabel(s: ComplianceStatus): string {
  const map: Record<ComplianceStatus, string> = {
    verified: "Verified",
    todo: "To do",
    blocked: "Blocked",
    na: "N/A",
    in_flight: "In flight",
    consultant_claims_done: "Claimed",
  };
  return map[s] || s;
}
