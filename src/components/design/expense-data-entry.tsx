"use client";

// /expenses Data Entry tab. Form-driven write surface that replaces the
// Excel sheet for ongoing weekly entry. Master-sheet rows ARE shown for
// context but the form refuses to save over them. Manual rows can be
// edited from here.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  upsertWeek,
  WEEKLY_SLOTS,
  type WeeklySlotKey,
} from "@/lib/actions/expenses";
import { Icon } from "./icons";
import type { WeekRowsBundle } from "@/lib/queries/expenses";

const CANONICAL_KEYS: Array<{ key: WeeklySlotKey; label: string; hint?: string }> = [
  { key: "water", label: "Water" },
  { key: "jornales", label: "Jornales", hint: "day labor" },
  { key: "chavito", label: "Chavito", hint: "farm manager" },
  { key: "engineer", label: "Engineer", hint: "agro engineer" },
  { key: "isaac", label: "Isaac", hint: "$100/wk wage" },
];

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

function isMasterSheetSource(s: string | null | undefined): boolean {
  return !!s && s.startsWith("master_sheet:");
}

// Sat-of-week display from YYYY-MM-DD Sunday.
function saturdayOf(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

// Step the week ±1.
function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

// Most recent Sunday-start week relative to today.
function mostRecentSunday(): string {
  const d = new Date();
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type ExpenseDataEntryProps = {
  initialWeek: string; // Sunday YYYY-MM-DD
  bundle: WeekRowsBundle; // initial data for the week
};

type OtherEntry = { note: string; amountUsd: string; existingId?: string; locked?: boolean };

export function ExpenseDataEntry({ initialWeek, bundle }: ExpenseDataEntryProps) {
  const router = useRouter();
  const week = initialWeek;

  // Week navigation pushes a URL param so the server re-renders with fresh
  // data for the chosen week. This keeps the form's "what's saved" preview
  // truthful without an extra client fetch.
  function navigateToWeek(next: string) {
    router.push(`/expenses?tab=entry&week=${next}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <WeekPicker week={week} onChange={navigateToWeek} />
      <DataEntryForm weekStart={week} bundle={bundle} />
      <ExistingRowsPreview bundle={bundle} />
    </div>
  );
}

function WeekPicker({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const sat = saturdayOf(week);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
        flexWrap: "wrap",
      }}
    >
      <span className="label" style={{ color: "var(--text-3)" }}>Week</span>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onChange(shiftWeek(week, -1))}
        title="Previous week"
      >
        <Icon name="chev" size={11} /> Prev
      </button>
      <input
        type="date"
        value={week}
        onChange={(e) => onChange(e.target.value)}
        className="mono"
        style={{ ...inputStyle, width: 160 }}
      />
      <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
        Sun {week} → Sat {sat}
      </span>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onChange(shiftWeek(week, 1))}
        title="Next week"
      >
        Next <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chev" size={11} /></span>
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => onChange(mostRecentSunday())}
        style={{ marginLeft: "auto" }}
      >
        This week
      </button>
    </div>
  );
}

function DataEntryForm({
  weekStart,
  bundle,
}: {
  weekStart: string;
  bundle: WeekRowsBundle;
}) {
  // Build initial form values from the bundle. For each canonical slot,
  // prefill from the existing row (manual or master). For Other, list each
  // existing Other row as an editable line; locked ones are read-only.
  const initial = React.useMemo(() => buildInitialFormState(bundle), [bundle]);
  const [values, setValues] = React.useState<Record<string, string>>(initial.canonical);
  const [others, setOthers] = React.useState<OtherEntry[]>(initial.others);
  const [capitalIn, setCapitalIn] = React.useState(initial.capitalIn);
  const [capitalOut, setCapitalOut] = React.useState(initial.capitalOut);
  const [counterparty, setCounterparty] = React.useState(initial.counterparty);
  const [harvestPayment, setHarvestPayment] = React.useState(initial.harvestPayment);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [conflicts, setConflicts] = React.useState<string[]>([]);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const router = useRouter();

  // Reset form whenever the week changes (bundle prop new identity).
  React.useEffect(() => {
    const fresh = buildInitialFormState(bundle);
    setValues(fresh.canonical);
    setOthers(fresh.others);
    setCapitalIn(fresh.capitalIn);
    setCapitalOut(fresh.capitalOut);
    setCounterparty(fresh.counterparty);
    setHarvestPayment(fresh.harvestPayment);
    setError(null);
    setConflicts([]);
    setSavedAt(null);
  }, [bundle]);

  // Build a quick map of which slots are LOCKED by master_sheet, so we can
  // disable those inputs without depending on the server's pre-flight.
  const lockedSlots = React.useMemo(() => {
    const locks: Partial<Record<WeeklySlotKey, true>> = {};
    for (const e of bundle.expenses) {
      if (!isMasterSheetSource(e.source)) continue;
      for (const key of Object.keys(WEEKLY_SLOTS) as WeeklySlotKey[]) {
        const s = WEEKLY_SLOTS[key];
        if (
          e.categoryType === s.categoryType &&
          (e.categoryLabel ?? "").toLowerCase() === s.categoryLabel.toLowerCase()
        ) {
          locks[key] = true;
        }
      }
    }
    return locks;
  }, [bundle]);

  function setSlot(key: WeeklySlotKey, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function addOther() {
    setOthers((prev) => [...prev, { note: "", amountUsd: "" }]);
  }
  function removeOther(idx: number) {
    setOthers((prev) => prev.filter((_, i) => i !== idx));
  }
  function setOther(idx: number, patch: Partial<OtherEntry>) {
    setOthers((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }

  function onSave() {
    setError(null);
    setConflicts([]);
    startTransition(async () => {
      const r = await upsertWeek({
        weekStartDate: weekStart,
        water: values.water,
        jornales: values.jornales,
        chavito: values.chavito,
        engineer: values.engineer,
        isaac: values.isaac,
        others: others.filter((o) => !o.locked).map((o) => ({ note: o.note, amountUsd: o.amountUsd })),
        capitalIn,
        capitalOut,
        counterparty: counterparty.trim() || null,
        harvestPayment,
      });
      if (!r.ok) {
        setError(r.error);
        setConflicts(r.conflicts ?? []);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      // Re-fetch the week's data on the server.
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: 18,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {CANONICAL_KEYS.map(({ key, label, hint }) => {
          const locked = !!lockedSlots[key];
          return (
            <Field key={key} label={label} hint={locked ? "Locked from master sheet" : hint} locked={locked}>
              <input
                value={values[key] ?? ""}
                onChange={(e) => setSlot(key, e.target.value)}
                placeholder="0"
                inputMode="decimal"
                disabled={locked}
                className="mono num"
                style={{ ...inputStyle, opacity: locked ? 0.55 : 1 }}
              />
            </Field>
          );
        })}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="label">Other purchases</span>
          <button type="button" className="btn btn--ghost" onClick={addOther}>
            <Icon name="plus" size={11} /> Add another
          </button>
        </div>
        {others.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>None this week.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {others.map((o, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px auto",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  value={o.note}
                  onChange={(e) => setOther(i, { note: e.target.value })}
                  placeholder="Note (e.g. fertilizer 2 bags)"
                  disabled={!!o.locked}
                  style={{ ...inputStyle, opacity: o.locked ? 0.55 : 1 }}
                />
                <input
                  value={o.amountUsd}
                  onChange={(e) => setOther(i, { amountUsd: e.target.value })}
                  placeholder="$0"
                  inputMode="decimal"
                  disabled={!!o.locked}
                  className="mono num"
                  style={{ ...inputStyle, opacity: o.locked ? 0.55 : 1, width: 140 }}
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => removeOther(i)}
                  disabled={!!o.locked}
                  title={o.locked ? "Locked from master sheet" : "Remove"}
                >
                  <Icon name="x" size={11} color={o.locked ? "var(--text-3)" : "var(--rose)"} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--line-soft)",
        }}
      >
        <Field label="US in" hint="Wire from US into FincaEC">
          <input
            value={capitalIn}
            onChange={(e) => setCapitalIn(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num capital-in"
            style={inputStyle}
          />
        </Field>
        <Field label="US out" hint="Wire from FincaEC back to US">
          <input
            value={capitalOut}
            onChange={(e) => setCapitalOut(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num capital-out"
            style={inputStyle}
          />
        </Field>
        <Field label="Counterparty" hint="Name on the wire">
          <input
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="James US"
            style={inputStyle}
          />
        </Field>
        <Field label="Harvest payment" hint="Lump-sum from processor">
          <input
            value={harvestPayment}
            onChange={(e) => setHarvestPayment(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num money-in"
            style={inputStyle}
          />
        </Field>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--line-soft)",
        }}
      >
        <button className="btn btn--primary" type="button" onClick={onSave} disabled={isPending}>
          <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save week"}
        </button>
        {savedAt && <span style={{ fontSize: 11.5, color: "var(--green)" }}>Saved at {savedAt}</span>}
        {error && (
          <div style={{ fontSize: 11.5, color: "var(--rose)" }}>
            {error}
            {conflicts.length > 0 && (
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                {conflicts.map((c, i) => (
                  <li key={i} className="mono" style={{ fontSize: 10.5 }}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, locked, children }: { label: string; hint?: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label" style={{ color: locked ? "var(--text-3)" : undefined }}>{label}{locked && " · 🔒"}</div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

function ExistingRowsPreview({ bundle }: { bundle: WeekRowsBundle }) {
  if (
    bundle.expenses.length === 0 &&
    bundle.cashMovements.length === 0 &&
    !bundle.harvestPayment
  ) {
    return null;
  }
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      <div className="label" style={{ marginBottom: 10 }}>
        Currently saved for this week
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bundle.expenses.map((e) => (
          <RowSummary
            key={e.id}
            primary={e.categoryLabel ?? e.categoryType}
            amount={e.amountUsd}
            source={e.source}
            tone={e.categoryType === "other" ? "money-out" : "money-out"}
          />
        ))}
        {bundle.cashMovements.map((cm) => (
          <RowSummary
            key={cm.id}
            primary={cm.direction === "in_to_ec" ? "US → EC" : "EC → US"}
            amount={cm.amountUsd}
            source={cm.source}
            tone={cm.direction === "in_to_ec" ? "capital-in" : "capital-out"}
            label={cm.counterparty ?? undefined}
          />
        ))}
        {bundle.harvestPayment && (
          <RowSummary
            primary="Harvest payment received"
            amount={bundle.harvestPayment.netPayUsd}
            source={bundle.harvestPayment.source}
            tone="money-in"
          />
        )}
      </div>
    </div>
  );
}

function RowSummary({
  primary,
  amount,
  source,
  tone,
  label,
}: {
  primary: string;
  amount: string;
  source: string | null;
  tone: "money-in" | "money-out" | "capital-in" | "capital-out";
  label?: string;
}) {
  const locked = isMasterSheetSource(source);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 12,
        alignItems: "center",
        padding: "6px 8px",
        borderRadius: 6,
        background: locked ? "var(--bg-2)" : "transparent",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 12.5 }}>{primary}{label ? ` · ${label}` : ""}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
          {locked ? "🔒 master sheet" : source ?? "—"}
        </span>
      </span>
      <span className={`mono num ${tone}`} style={{ fontSize: 13, fontWeight: 500 }}>${amount}</span>
    </div>
  );
}

function buildInitialFormState(bundle: WeekRowsBundle): {
  canonical: Record<string, string>;
  others: OtherEntry[];
  capitalIn: string;
  capitalOut: string;
  counterparty: string;
  harvestPayment: string;
} {
  const canonical: Record<string, string> = {};
  const others: OtherEntry[] = [];

  for (const e of bundle.expenses) {
    let placedInSlot = false;
    for (const key of Object.keys(WEEKLY_SLOTS) as WeeklySlotKey[]) {
      const s = WEEKLY_SLOTS[key];
      if (
        e.categoryType === s.categoryType &&
        (e.categoryLabel ?? "").toLowerCase() === s.categoryLabel.toLowerCase()
      ) {
        canonical[key] = e.amountUsd;
        placedInSlot = true;
        break;
      }
    }
    if (!placedInSlot && e.categoryType === "other") {
      others.push({
        note: e.categoryLabel ?? "Other",
        amountUsd: e.amountUsd,
        existingId: e.id,
        locked: isMasterSheetSource(e.source),
      });
    }
  }

  const capitalInRow = bundle.cashMovements.find((m) => m.direction === "in_to_ec");
  const capitalOutRow = bundle.cashMovements.find((m) => m.direction === "out_to_us");

  return {
    canonical,
    others,
    capitalIn: capitalInRow ? capitalInRow.amountUsd : "",
    capitalOut: capitalOutRow ? capitalOutRow.amountUsd : "",
    counterparty: capitalInRow?.counterparty ?? capitalOutRow?.counterparty ?? "",
    harvestPayment: bundle.harvestPayment?.netPayUsd ?? "",
  };
}
