"use client";

// Drawer body for editing a single cash movement (US ↔ EC wire).

import * as React from "react";
import {
  type CashMovementRow,
  type CashMovementDirection,
  DIRECTION_LABEL,
} from "@/lib/queries/cash-movements";
import { updateCashMovement, deleteCashMovement } from "@/lib/actions/cash-movements";
import { Icon } from "./icons";
import { formatUsd } from "@/lib/money";

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

const DIRECTIONS: CashMovementDirection[] = ["in_to_ec", "out_to_us"];

export function CashMovementDetail({ item, onClose }: { item: CashMovementRow; onClose: () => void }) {
  const [transferDate, setTransferDate] = React.useState(item.transferDate);
  const [direction, setDirection] = React.useState<CashMovementDirection>(item.direction);
  const [amountUsd, setAmountUsd] = React.useState(item.amountUsd);
  const [counterparty, setCounterparty] = React.useState(item.counterparty ?? "");
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    transferDate !== item.transferDate ||
    direction !== item.direction ||
    amountUsd !== item.amountUsd ||
    counterparty !== (item.counterparty ?? "") ||
    notes !== (item.notes ?? "");

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateCashMovement({
        id: item.id,
        transferDate,
        direction,
        amountUsd,
        counterparty: counterparty.trim() || null,
        notes,
      });
      if (!r.ok) { setError(r.error); return; }
      onClose();
    });
  };

  const onDelete = () => {
    if (!confirm("Delete this cash movement? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteCashMovement(item.id);
      if (!r.ok) { setError(r.error); return; }
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
          <div className="label" style={{ marginBottom: 6 }}>Cash movement</div>
          <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>
            {DIRECTION_LABEL[item.direction]} · {formatUsd(item.amountUsd)}
          </h2>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
            {item.transferDate} · {item.source ?? "manual"}
          </div>
        </div>
        <button onClick={onClose} className="btn btn--ghost" type="button"><Icon name="x" size={11} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Transfer date">
          <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="mono" style={inputStyle} />
        </Field>

        <Field label="Direction">
          <div style={{ display: "flex", gap: 6 }}>
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: d === direction ? "1px solid var(--green)" : "1px solid var(--line-soft)",
                  background: d === direction ? "var(--green-glow)" : "var(--bg-3)",
                  color: d === direction ? "var(--green)" : "var(--text-2)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {DIRECTION_LABEL[d]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Amount (USD)">
          <input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
        </Field>

        <Field label="Counterparty" hint="The other side of the wire — 'James US', 'Enigma US bank', etc.">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
          />
        </Field>
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
          <button className="btn btn--ghost" type="button" onClick={onDelete} disabled={isPending} style={{ color: "var(--rose)" }}>
            <Icon name="x" size={11} color="var(--rose)" /> Delete
          </button>
          {error && <span style={{ fontSize: 11, color: "var(--rose)" }}>{error}</span>}
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
