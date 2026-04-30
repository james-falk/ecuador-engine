"use client";

// /expenses Data Entry tab — narrowed to JUST expenses (payments out).
// Capital flow + harvest payment entry moved off this page (they live on a
// future balance-sheet surface and the harvests page respectively).
//
// Form layout:
//   Row 1: Water (amount + note) | Jornales (amount + note)
//   Row 2: Chavito (default $50) | Engineer ($100) | Isaac ($100)
//   Row 3: Other entries — at least one row visible by default; "+ Add another"
//          appends more.
//
// Pre-fill rules:
//   • If a row already exists for the (week, category) slot, value is the
//     existing amount and (for Water/Jornales) note.
//   • Otherwise: Chavito=50, Engineer=100, Isaac=100 by default; Water and
//     Jornales empty (variable per week).
//   • Master-sheet rows are still locked; the field shows the master value
//     and refuses edits.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  upsertWeek,
  WEEKLY_SLOTS,
  type WeeklySlotKey,
} from "@/lib/actions/expenses";
import { Icon } from "./icons";
import type { WeekRowsBundle } from "@/lib/queries/expenses";

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

// Defaults applied only when a slot has no existing row at all. If the slot
// is locked (master-sheet) or already has a manual value, the default is NOT
// re-applied.
const SLOT_DEFAULTS: Partial<Record<WeeklySlotKey, string>> = {
  chavito: "50",
  engineer: "100",
  isaac: "100",
};

function isMasterSheetSource(s: string | null | undefined): boolean {
  return !!s && s.startsWith("master_sheet:");
}

function saturdayOf(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function mostRecentSunday(): string {
  const d = new Date();
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type ExpenseDataEntryProps = {
  initialWeek: string;
  bundle: WeekRowsBundle;
};

type OtherEntry = { note: string; amountUsd: string; existingId?: string; locked?: boolean };

export function ExpenseDataEntry({ initialWeek, bundle }: ExpenseDataEntryProps) {
  const router = useRouter();
  const week = initialWeek;

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

function DataEntryForm({ weekStart, bundle }: { weekStart: string; bundle: WeekRowsBundle }) {
  const initial = React.useMemo(() => buildInitialFormState(bundle), [bundle]);
  const [values, setValues] = React.useState<Record<string, string>>(initial.canonical);
  const [waterNote, setWaterNote] = React.useState(initial.waterNote);
  const [jornalesNote, setJornalesNote] = React.useState(initial.jornalesNote);
  const [others, setOthers] = React.useState<OtherEntry[]>(
    // Always show at least one Other row, even if empty, so the user can fill
    // it without clicking "Add another" first.
    initial.others.length > 0 ? initial.others : [{ note: "", amountUsd: "" }]
  );
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [conflicts, setConflicts] = React.useState<string[]>([]);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const fresh = buildInitialFormState(bundle);
    setValues(fresh.canonical);
    setWaterNote(fresh.waterNote);
    setJornalesNote(fresh.jornalesNote);
    setOthers(fresh.others.length > 0 ? fresh.others : [{ note: "", amountUsd: "" }]);
    setError(null);
    setConflicts([]);
    setSavedAt(null);
  }, [bundle]);

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
    setOthers((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Always keep at least one (possibly empty) row visible.
      return next.length === 0 ? [{ note: "", amountUsd: "" }] : next;
    });
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
        waterNote,
        jornalesNote,
        others: others
          .filter((o) => !o.locked && o.note.trim() && o.amountUsd.trim())
          .map((o) => ({ note: o.note, amountUsd: o.amountUsd })),
      });
      if (!r.ok) {
        setError(r.error);
        setConflicts(r.conflicts ?? []);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 18,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      {/* Row 1 — Water + Jornales (each with note) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <SlotWithNote
          slot="water"
          label="Water"
          amount={values.water ?? ""}
          onAmount={(v) => setSlot("water", v)}
          note={waterNote}
          onNote={setWaterNote}
          notePlaceholder="vendor / delivery details"
          locked={!!lockedSlots.water}
        />
        <SlotWithNote
          slot="jornales"
          label="Jornales"
          amount={values.jornales ?? ""}
          onAmount={(v) => setSlot("jornales", v)}
          note={jornalesNote}
          onNote={setJornalesNote}
          notePlaceholder='e.g. "3 workers × $12 × 5 days"'
          locked={!!lockedSlots.jornales}
        />
      </div>

      {/* Row 2 — fixed-rate roles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
        {(["chavito", "engineer", "isaac"] as const).map((key) => (
          <SimpleSlot
            key={key}
            label={key === "chavito" ? "Chavito" : key === "engineer" ? "Engineer" : "Isaac"}
            value={values[key] ?? ""}
            onChange={(v) => setSlot(key, v)}
            locked={!!lockedSlots[key]}
          />
        ))}
      </div>

      {/* Row 3 — Other entries */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="label">Other purchases</span>
          <button type="button" className="btn btn--ghost" onClick={addOther}>
            <Icon name="plus" size={11} /> Add another
          </button>
        </div>
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
                className="mono num money-out"
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

function SimpleSlot({
  label,
  value,
  onChange,
  locked,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label" style={{ color: locked ? "var(--text-3)" : undefined }}>
        {label}{locked && " · 🔒"}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="decimal"
        disabled={locked}
        className="mono num money-out"
        style={{ ...inputStyle, opacity: locked ? 0.55 : 1 }}
      />
    </div>
  );
}

function SlotWithNote({
  slot,
  label,
  amount,
  onAmount,
  note,
  onNote,
  notePlaceholder,
  locked,
}: {
  slot: WeeklySlotKey;
  label: string;
  amount: string;
  onAmount: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  notePlaceholder: string;
  locked: boolean;
}) {
  void slot;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label" style={{ color: locked ? "var(--text-3)" : undefined }}>
        {label}{locked && " · 🔒"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
        <input
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          disabled={locked}
          className="mono num money-out"
          style={{ ...inputStyle, opacity: locked ? 0.55 : 1 }}
        />
        <input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={notePlaceholder}
          disabled={locked}
          style={{ ...inputStyle, opacity: locked ? 0.55 : 1 }}
        />
      </div>
    </div>
  );
}

function ExistingRowsPreview({ bundle }: { bundle: WeekRowsBundle }) {
  if (bundle.expenses.length === 0) return null;
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
            secondary={e.notes ?? null}
            amount={e.amountUsd}
            source={e.source}
          />
        ))}
      </div>
    </div>
  );
}

function RowSummary({
  primary,
  secondary,
  amount,
  source,
}: {
  primary: string;
  secondary: string | null;
  amount: string;
  source: string | null;
}) {
  const locked = isMasterSheetSource(source);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "6px 8px",
        borderRadius: 6,
        background: locked ? "var(--bg-2)" : "transparent",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 12.5 }}>{primary}{secondary ? ` · ${secondary}` : ""}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
          {locked ? "🔒 master sheet" : source ?? "—"}
        </span>
      </span>
      <span className="mono num money-out" style={{ fontSize: 13, fontWeight: 500 }}>${amount}</span>
    </div>
  );
}

function buildInitialFormState(bundle: WeekRowsBundle): {
  canonical: Record<string, string>;
  waterNote: string;
  jornalesNote: string;
  others: OtherEntry[];
} {
  const canonical: Record<string, string> = {};
  const others: OtherEntry[] = [];
  let waterNote = "";
  let jornalesNote = "";

  for (const e of bundle.expenses) {
    let placedInSlot = false;
    for (const key of Object.keys(WEEKLY_SLOTS) as WeeklySlotKey[]) {
      const s = WEEKLY_SLOTS[key];
      if (
        e.categoryType === s.categoryType &&
        (e.categoryLabel ?? "").toLowerCase() === s.categoryLabel.toLowerCase()
      ) {
        canonical[key] = e.amountUsd;
        if (key === "water") waterNote = e.notes ?? "";
        if (key === "jornales") jornalesNote = e.notes ?? "";
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

  // Apply pre-fill defaults ONLY for slots that have no existing row at all.
  // If a slot is locked (master_sheet) it'll already be in `canonical` from
  // the loop above; if a manual row exists, same. Defaults fill in the gaps.
  for (const [key, def] of Object.entries(SLOT_DEFAULTS) as Array<[WeeklySlotKey, string]>) {
    if (canonical[key] === undefined) canonical[key] = def;
  }

  return { canonical, waterNote, jornalesNote, others };
}
