"use client";

// Drawer body for editing a harvest + its (optional) settlement. Top section
// is harvest fields (always editable). Bottom section is the settlement —
// editable when present, "Add settlement" CTA when null.

import * as React from "react";
import type { HarvestRow } from "@/lib/queries/harvests";
import { updateHarvest, deleteHarvest, recordSettlement, updateSettlement } from "@/lib/actions/harvests";
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

export function HarvestDetail({
  item,
  defaultAccountId,
  onClose,
}: {
  item: HarvestRow;
  defaultAccountId: string; // Finca EC for v1
  onClose: () => void;
}) {
  // Harvest fields
  const [harvestDate, setHarvestDate] = React.useState(item.harvestDate);
  const [lotNumber, setLotNumber] = React.useState(item.lotNumber ?? "");
  const [kgDelivered, setKgDelivered] = React.useState(item.kgDelivered);
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [evidenceUrl, setEvidenceUrl] = React.useState(item.evidenceUrl ?? "");

  // Settlement fields (start empty if no settlement yet)
  const s = item.settlement;
  const [settlementDate, setSettlementDate] = React.useState(s?.settlementDate ?? "");
  const [kgManifested, setKgManifested] = React.useState(s?.kgManifested ?? item.kgDelivered);
  const [kgProcessed, setKgProcessed] = React.useState(s?.kgProcessed ?? "");
  const [kgWaste, setKgWaste] = React.useState(s?.kgWaste ?? "");
  const [grade1_5Kg, setGrade1_5Kg] = React.useState(s?.grade1_5Kg ?? "");
  const [grade2Kg, setGrade2Kg] = React.useState(s?.grade2Kg ?? "");
  const [gradeSmallKg, setGradeSmallKg] = React.useState(s?.gradeSmallKg ?? "");
  const [grade1_5RateUsd, setGrade1_5RateUsd] = React.useState(s?.grade1_5RateUsd ?? "2.0000");
  const [grade2RateUsd, setGrade2RateUsd] = React.useState(s?.grade2RateUsd ?? "2.0000");
  const [gradeSmallRateUsd, setGradeSmallRateUsd] = React.useState(s?.gradeSmallRateUsd ?? "1.0000");
  const [subtotalUsd, setSubtotalUsd] = React.useState(s?.subtotalUsd ?? "");
  const [retentionUsd, setRetentionUsd] = React.useState(s?.retentionUsd ?? "0.00");
  const [netPayUsd, setNetPayUsd] = React.useState(s?.netPayUsd ?? "");
  const [paidDate, setPaidDate] = React.useState(s?.paidDate ?? "");
  const [pdfUrl, setPdfUrl] = React.useState(s?.pdfUrl ?? "");
  const [wasteObservations, setWasteObservations] = React.useState(s?.wasteObservations ?? "");

  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const harvestDirty =
    harvestDate !== item.harvestDate ||
    lotNumber !== (item.lotNumber ?? "") ||
    kgDelivered !== item.kgDelivered ||
    notes !== (item.notes ?? "") ||
    evidenceUrl !== (item.evidenceUrl ?? "");

  const settlementDirty = (() => {
    if (!s) {
      // New settlement — dirty iff at least the required fields filled in.
      return !!(settlementDate && kgManifested && kgProcessed && kgWaste && subtotalUsd && netPayUsd);
    }
    return (
      settlementDate !== s.settlementDate ||
      kgManifested !== s.kgManifested ||
      kgProcessed !== s.kgProcessed ||
      kgWaste !== s.kgWaste ||
      grade1_5Kg !== (s.grade1_5Kg ?? "") ||
      grade2Kg !== (s.grade2Kg ?? "") ||
      gradeSmallKg !== (s.gradeSmallKg ?? "") ||
      grade1_5RateUsd !== (s.grade1_5RateUsd ?? "") ||
      grade2RateUsd !== (s.grade2RateUsd ?? "") ||
      gradeSmallRateUsd !== (s.gradeSmallRateUsd ?? "") ||
      subtotalUsd !== s.subtotalUsd ||
      retentionUsd !== s.retentionUsd ||
      netPayUsd !== s.netPayUsd ||
      paidDate !== (s.paidDate ?? "") ||
      pdfUrl !== (s.pdfUrl ?? "") ||
      wasteObservations !== (s.wasteObservations ?? "")
    );
  })();

  const dirty = harvestDirty || settlementDirty;

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      if (harvestDirty) {
        const r = await updateHarvest({
          id: item.id,
          harvestDate,
          lotNumber: lotNumber || null,
          kgDelivered,
          notes: notes || null,
          evidenceUrl: evidenceUrl || null,
        });
        if (!r.ok) { setError(r.error); return; }
      }
      if (settlementDirty) {
        const payload = {
          settlementDate,
          kgManifested,
          kgProcessed,
          kgWaste,
          grade1_5Kg: grade1_5Kg || null,
          grade2Kg: grade2Kg || null,
          gradeSmallKg: gradeSmallKg || null,
          grade1_5RateUsd: grade1_5RateUsd || null,
          grade2RateUsd: grade2RateUsd || null,
          gradeSmallRateUsd: gradeSmallRateUsd || null,
          subtotalUsd,
          retentionUsd: retentionUsd || "0.00",
          netPayUsd,
          paidDate: paidDate || null,
          pdfUrl: pdfUrl || null,
          wasteObservations: wasteObservations || null,
        };
        const r = s
          ? await updateSettlement({ id: s.id, ...payload, paidToAccountId: s.paidToAccountId })
          : await recordSettlement({ harvestId: item.id, ...payload, paidToAccountId: defaultAccountId });
        if (!r.ok) { setError(r.error); return; }
      }
      onClose();
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete harvest ${item.lotNumber ?? ""} and its settlement? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteHarvest(item.id);
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
          <div className="label" style={{ marginBottom: 6 }}>Harvest</div>
          <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>
            Lot {item.lotNumber ?? "—"} · {Number(item.kgDelivered).toFixed(0)} kg
          </h2>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
            {item.harvestDate} · {item.processorName}
          </div>
        </div>
        <button onClick={onClose} className="btn btn--ghost" type="button"><Icon name="x" size={11} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* HARVEST */}
        <Section title="Delivery">
          <Row>
            <Field label="Harvest date">
              <input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} className="mono" style={inputStyle} />
            </Field>
            <Field label="Lot #">
              <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="mono" style={inputStyle} />
            </Field>
          </Row>
          <Field label="kg delivered">
            <input value={kgDelivered} onChange={(e) => setKgDelivered(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)" }} />
          </Field>
          <Field label="Evidence URL" hint="Drive link to the delivery slip / photo.">
            <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} className="mono" style={inputStyle} />
          </Field>
        </Section>

        {/* SETTLEMENT */}
        <Section
          title="Liquidación settlement"
          right={
            !s ? (
              <span className="mono" style={{ fontSize: 10, color: "var(--amber)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Awaiting Liquidación
              </span>
            ) : null
          }
        >
          <Row>
            <Field label="Settlement date">
              <input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} className="mono" style={inputStyle} />
            </Field>
            <Field label="Paid date" hint="When cash hit the account.">
              <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="mono" style={inputStyle} />
            </Field>
          </Row>
          <Row>
            <Field label="kg manifested">
              <input value={kgManifested} onChange={(e) => setKgManifested(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
            <Field label="kg processed">
              <input value={kgProcessed} onChange={(e) => setKgProcessed(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
            <Field label="kg waste">
              <input value={kgWaste} onChange={(e) => setKgWaste(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
          </Row>
          <Section title="Grades">
            <Row>
              <Field label="Grade 1.5 kg">
                <input value={grade1_5Kg} onChange={(e) => setGrade1_5Kg(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
              <Field label="Grade 1.5 rate $/kg">
                <input value={grade1_5RateUsd} onChange={(e) => setGrade1_5RateUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
            </Row>
            <Row>
              <Field label="Grade 2 kg">
                <input value={grade2Kg} onChange={(e) => setGrade2Kg(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
              <Field label="Grade 2 rate $/kg">
                <input value={grade2RateUsd} onChange={(e) => setGrade2RateUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
            </Row>
            <Row>
              <Field label="Small kg">
                <input value={gradeSmallKg} onChange={(e) => setGradeSmallKg(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
              <Field label="Small rate $/kg">
                <input value={gradeSmallRateUsd} onChange={(e) => setGradeSmallRateUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
              </Field>
            </Row>
          </Section>
          <Row>
            <Field label="Subtotal USD">
              <input value={subtotalUsd} onChange={(e) => setSubtotalUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
            <Field label="Retention USD">
              <input value={retentionUsd} onChange={(e) => setRetentionUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
            <Field label="Net pay USD">
              <input value={netPayUsd} onChange={(e) => setNetPayUsd(e.target.value)} inputMode="decimal" className="mono" style={inputStyle} />
            </Field>
          </Row>
          <Field label="PDF URL">
            <input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} className="mono" style={inputStyle} />
          </Field>
          <Field label="Waste observations">
            <textarea value={wasteObservations} onChange={(e) => setWasteObservations(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)" }} />
          </Field>
          {s && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
              Net pay {formatUsd(s.netPayUsd)} {s.paidDate ? `· paid ${s.paidDate}` : "· awaiting payment"}
            </div>
          )}
        </Section>
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
            <Icon name="check" size={11} /> {isPending ? "Saving…" : s ? "Save" : "Add settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div className="label">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}
