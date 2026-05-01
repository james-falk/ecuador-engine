"use client";

// Drawer body for a single expense entry. Two modes:
//   • view — the default for clicks from /expenses Feed: read-only fields,
//     no Save/Delete buttons, source provenance prominent. Edits happen in
//     the Data Entry tab; a "Edit in Data Entry" button at the bottom
//     routes there with the right week pre-selected.
//   • edit — explicit one-off correction flow (rarely used; not the
//     default path).

import * as React from "react";
import Link from "next/link";
import {
  CATEGORY_TYPES,
  CATEGORY_LABEL,
  type ExpenseCategoryType,
  type ExpenseRow,
} from "@/lib/queries/expenses";
import { updateExpenseEntry, deleteExpenseEntry } from "@/lib/actions/expenses";
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

const readOnlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: "var(--bg-2)",
  color: "var(--text-1)",
  cursor: "default",
};

function isMasterSheetSource(s: string | null | undefined): boolean {
  return !!s && s.startsWith("master_sheet:");
}

export function ExpenseDetail({
  item,
  mode = "edit",
  onClose,
}: {
  item: ExpenseRow;
  mode?: "view" | "edit";
  onClose: () => void;
}) {
  const [entryDate, setEntryDate] = React.useState(item.entryDate);
  const [categoryType, setCategoryType] = React.useState<ExpenseCategoryType>(item.categoryType);
  const [categoryLabel, setCategoryLabel] = React.useState(item.categoryLabel ?? "");
  const [amountUsd, setAmountUsd] = React.useState(item.amountUsd);
  const [payee, setPayee] = React.useState(item.payee ?? "");
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    entryDate !== item.entryDate ||
    categoryType !== item.categoryType ||
    categoryLabel !== (item.categoryLabel ?? "") ||
    amountUsd !== item.amountUsd ||
    payee !== (item.payee ?? "") ||
    notes !== (item.notes ?? "");

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateExpenseEntry({
        id: item.id,
        entryDate,
        categoryType,
        categoryLabel: categoryLabel.trim() || null,
        amountUsd,
        payee: payee.trim() || null,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  const onDelete = () => {
    if (!confirm("Delete this expense entry? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteExpenseEntry(item.id);
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
          <div className="label" style={{ marginBottom: 6 }}>Expense</div>
          <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>
            {item.categoryLabel || CATEGORY_LABEL[item.categoryType]} · {formatUsd(item.amountUsd)}
          </h2>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
            {item.entryDate} · {item.source ?? "manual"}
          </div>
        </div>
        <button onClick={onClose} className="btn btn--ghost" type="button"><Icon name="x" size={11} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Entry date">
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mono"
            style={mode === "view" ? readOnlyStyle : inputStyle}
            readOnly={mode === "view"}
          />
        </Field>

        <Field label="Category">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORY_TYPES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => mode === "edit" && setCategoryType(c)}
                disabled={mode === "view"}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: c === categoryType ? "1px solid var(--green)" : "1px solid var(--line-soft)",
                  background: c === categoryType ? "var(--green-glow)" : "var(--bg-3)",
                  color: c === categoryType ? "var(--green)" : "var(--text-2)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: mode === "view" ? "default" : "pointer",
                  opacity: mode === "view" && c !== categoryType ? 0.45 : 1,
                }}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Label">
          <input
            value={categoryLabel}
            onChange={(e) => setCategoryLabel(e.target.value)}
            placeholder={CATEGORY_LABEL[categoryType]}
            style={mode === "view" ? readOnlyStyle : inputStyle}
            readOnly={mode === "view"}
          />
        </Field>

        <Field label="Amount (USD)">
          <input
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            inputMode="decimal"
            className="mono num money-out"
            style={mode === "view" ? readOnlyStyle : inputStyle}
            readOnly={mode === "view"}
          />
        </Field>

        <Field label="Payee">
          <input
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Worker name or vendor"
            style={mode === "view" ? readOnlyStyle : inputStyle}
            readOnly={mode === "view"}
          />
          {(item.payeePersonName || item.payeeCompanyName) && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
              Linked: {item.payeePersonName ?? item.payeeCompanyName}
            </div>
          )}
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{
              ...(mode === "view" ? readOnlyStyle : inputStyle),
              resize: "vertical",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.5,
            }}
            readOnly={mode === "view"}
          />
        </Field>

        <div
          style={{
            padding: "10px 12px",
            border: "1px dashed var(--line-soft)",
            borderRadius: 8,
            color: "var(--text-3)",
            fontSize: 11,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div className="label" style={{ fontSize: 9.5 }}>Provenance</div>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-2)" }}>
            {item.source ?? "manual"}
            {isMasterSheetSource(item.source) && " · 🔒 immutable historical ingest"}
          </span>
        </div>
      </div>

      {mode === "view" ? (
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-1)",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>Read-only view.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/expenses?tab=entry&week=${item.weekStartDate}`}
              className="btn"
              onClick={onClose}
            >
              Edit in Data Entry
            </Link>
            <button className="btn btn--primary" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
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
            <button
              className="btn btn--ghost"
              type="button"
              onClick={onDelete}
              disabled={isPending || isMasterSheetSource(item.source)}
              style={{ color: "var(--rose)" }}
              title={isMasterSheetSource(item.source) ? "Master-sheet rows are immutable" : ""}
            >
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
              disabled={isPending || !dirty || isMasterSheetSource(item.source)}
              style={{ opacity: !dirty ? 0.5 : 1 }}
            >
              <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
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
