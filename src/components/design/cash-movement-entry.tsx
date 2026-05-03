"use client";

// Manual cash-movement entry. Triggered from /income's Finca tab.
// Direction: in_to_ec (US → Ecuador) or out_to_us (Ecuador → US).
// Counterparty is free text — "James US", "PureSol", etc.

import * as React from "react";
import { useRouter } from "next/navigation";
import { createCashMovement } from "@/lib/actions/cash-movements";
import { Icon } from "./icons";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-3)",
  border: "1px solid var(--line-soft)",
  borderRadius: 8,
  color: "var(--text-0)",
  fontSize: 13,
  outline: "none",
  fontVariantNumeric: "tabular-nums",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CashMovementEntry({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [direction, setDirection] = React.useState<"in_to_ec" | "out_to_us">("in_to_ec");
  const [transferDate, setTransferDate] = React.useState(todayIso());
  const [amount, setAmount] = React.useState("");
  const [counterparty, setCounterparty] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedFlash, setSavedFlash] = React.useState(false);

  function reset() {
    setAmount("");
    setCounterparty("");
    setNotes("");
    setTransferDate(todayIso());
    setError(null);
  }

  function onSave() {
    setError(null);
    const amt = parseFloat(amount || "0");
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be positive.");
      return;
    }
    startTransition(async () => {
      const r = await createCashMovement({
        transferDate,
        direction,
        amountUsd: amt.toFixed(2),
        accountId,
        counterparty: counterparty.trim() || null,
        notes: notes.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedFlash(true);
      reset();
      setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
          <Icon name="plus" size={11} /> Record wire
        </button>
        {savedFlash && (
          <span className="mono" style={{ marginLeft: 10, fontSize: 11, color: "var(--green)" }}>
            Saved.
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 18,
        padding: 14,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="label">Record wire</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn--ghost" onClick={() => { setOpen(false); reset(); }} style={{ fontSize: 11 }}>
          Cancel
        </button>
      </div>

      <Field label="Direction">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              { v: "in_to_ec",  label: "US → Ecuador (in)",  color: "var(--sky)" },
              { v: "out_to_us", label: "Ecuador → US (out)", color: "var(--rose)" },
            ] as const
          ).map((o) => {
            const active = direction === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setDirection(o.v)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${active ? o.color : "var(--line-soft)"}`,
                  background: active ? `oklch(from ${o.color} l c h / 0.15)` : "var(--bg-3)",
                  color: active ? o.color : "var(--text-2)",
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Field label="Transfer date">
          <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="mono" style={inputStyle} />
        </Field>
        <Field label="Amount (USD)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num"
            style={inputStyle}
          />
        </Field>
        <Field label="Counterparty" hint="Who sent / received it (free text).">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="James US" style={inputStyle} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }} />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="btn btn--primary" onClick={onSave} disabled={pending || !amount.trim()}>
          <Icon name="check" size={11} /> {pending ? "Saving…" : "Save wire"}
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{error}</span>}
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
