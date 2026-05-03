// Buyer kanban — columns are stages (Lead / In conversation / Negotiating /
// Active / Lost). Cards live inside columns. Click a card → drawer-style
// edit modal. "+ New buyer" appends to Lead.

"use client";

import * as React from "react";
import { STAGE_META, STAGE_ORDER, type BuyerRow, type BuyerStage } from "@/lib/queries/buyers";
import { createBuyer, updateBuyer, deleteBuyer } from "@/lib/actions/buyers";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

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

export function BuyerBoard({ buyers }: { buyers: BuyerRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<BuyerRow | "new" | null>(null);

  const byStage = new Map<BuyerStage, BuyerRow[]>();
  for (const b of buyers) {
    if (!byStage.has(b.stage)) byStage.set(b.stage, []);
    byStage.get(b.stage)!.push(b);
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(220px, 1fr))`,
          gap: 12,
          overflowX: "auto",
        }}
      >
        {STAGE_ORDER.map((stage) => {
          const list = byStage.get(stage) ?? [];
          const meta = STAGE_META[stage];
          return (
            <div
              key={stage}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 10,
                background: "var(--bg-1)",
                border: "1px solid var(--line-soft)",
                borderRadius: 10,
                minWidth: 220,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: meta.color,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: `oklch(from ${meta.color} l c h / 0.12)`,
                  }}
                >
                  {meta.label}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginLeft: "auto" }}>{list.length}</span>
              </div>
              {list.length === 0 && (
                <div style={{ padding: 18, textAlign: "center", fontSize: 11, color: "var(--text-3)", border: "1px dashed var(--line-soft)", borderRadius: 8 }}>
                  Empty
                </div>
              )}
              {list.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setEditing(b)}
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-0)" }}>{b.name}</span>
                  {b.country && <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{b.country}</span>}
                  {b.contactName && <span style={{ fontSize: 11, color: "var(--text-2)" }}>{b.contactName}</span>}
                  {b.nextAction && (
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
                      Next: {b.nextAction}{b.nextActionDate ? ` (${b.nextActionDate})` : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-start" }}>
        <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
          <Icon name="plus" size={11} /> New buyer
        </button>
      </div>

      {editing && (
        <BuyerDialog
          item={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BuyerDialog({ item, onClose }: { item: BuyerRow | null; onClose: () => void }) {
  const isCreate = item === null;
  const [name, setName] = React.useState(item?.name ?? "");
  const [country, setCountry] = React.useState(item?.country ?? "");
  const [stage, setStage] = React.useState<BuyerStage>(item?.stage ?? "lead");
  const [contactName, setContactName] = React.useState(item?.contactName ?? "");
  const [contactEmail, setContactEmail] = React.useState(item?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = React.useState(item?.contactPhone ?? "");
  const [notes, setNotes] = React.useState(item?.notes ?? "");
  const [pricingNotes, setPricingNotes] = React.useState(item?.pricingNotes ?? "");
  const [nextAction, setNextAction] = React.useState(item?.nextAction ?? "");
  const [nextActionDate, setNextActionDate] = React.useState(item?.nextActionDate ?? "");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onSave = () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const payload = {
      name: name.trim(),
      country: country.trim() || null,
      stage,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      notes: notes.trim() || null,
      pricingNotes: pricingNotes.trim() || null,
      nextAction: nextAction.trim() || null,
      nextActionDate: nextActionDate || null,
    };
    startTransition(async () => {
      const r = isCreate
        ? await createBuyer(payload)
        : await updateBuyer({ id: item!.id, ...payload });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onClose();
    });
  };

  const onDelete = () => {
    if (isCreate) return;
    if (!confirm(`Delete buyer "${item!.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteBuyer(item!.id);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "oklch(0 0 0 / 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ee-drawer-panel"
        style={{
          width: 520,
          maxWidth: "100%",
          maxHeight: "85vh",
          background: "var(--bg-1)",
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, font: "500 16px/1.2 var(--font-display)", letterSpacing: "-0.01em" }}>
            {isCreate ? "New buyer" : item.name}
          </h3>
          <button onClick={onClose} className="btn btn--ghost" type="button"><Icon name="x" size={11} /></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus={isCreate} />
          </Field>

          <Field label="Stage">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STAGE_ORDER.map((s) => {
                const active = stage === s;
                const m = STAGE_META[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 8,
                      border: `1px solid ${active ? m.color : "var(--line-soft)"}`,
                      background: active ? `oklch(from ${m.color} l c h / 0.15)` : "var(--bg-3)",
                      color: active ? m.color : "var(--text-2)",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" style={inputStyle} /></Field>
            <Field label="Contact name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Contact email"><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={inputStyle} /></Field>
            <Field label="Contact phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={inputStyle} /></Field>
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }} />
          </Field>

          <Field label="Pricing notes" hint="Volume terms, NET, INCO terms specific to this buyer.">
            <textarea value={pricingNotes} onChange={(e) => setPricingNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Next action"><input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Send pricing one-pager" style={inputStyle} /></Field>
            <Field label="Next action date"><input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} className="mono" style={inputStyle} /></Field>
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-1)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isCreate && (
            <button type="button" className="btn btn--ghost" onClick={onDelete} disabled={pending} style={{ color: "var(--rose)" }}>
              <Icon name="x" size={11} color="var(--rose)" /> Delete
            </button>
          )}
          {error && <span style={{ fontSize: 11, color: "var(--rose)" }}>{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={onSave} disabled={pending || !name.trim()}>
            <Icon name="check" size={11} /> {pending ? "Saving…" : isCreate ? "Create" : "Save"}
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
