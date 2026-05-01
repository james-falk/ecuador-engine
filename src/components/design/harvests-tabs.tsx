"use client";

// Harvests page tab switcher — 4-stage pipeline:
//   1. Flowers picked (optional)  → tracked on the same farm-harvest row
//   2. Farm harvest               → bucket count, notes, etc.
//   3. Processed report           → kg accepted/declined, expected payment
//   4. Payment                    → cash received (advance / balance / lump)
//
// Each tab focuses on one stage's data entry + recent list. Cross-stage
// status (what's awaiting next) lives on /pending.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createFarmHarvest,
  recordProcessedReport,
  recordPayment,
  createProcessorCompany,
} from "@/lib/actions/farm-harvests";
import type { FarmHarvestRow, FarmHarvestStats } from "@/lib/queries/farm-harvests";
import type { HarvestRow, HarvestStats } from "@/lib/queries/harvests";
import { Icon } from "./icons";
import { formatUsd } from "@/lib/money";
import { DrivePicker, type DriveFile } from "./drive-picker";

type TabKey = "farm" | "reports" | "payments";

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

export function HarvestsTabs({
  initialTab,
  farmHarvests,
  farmStats,
  deliveryFeed,
  deliveryStats,
  processorOptions,
}: {
  initialTab: TabKey;
  farmHarvests: FarmHarvestRow[];
  farmStats: FarmHarvestStats;
  deliveryFeed: HarvestRow[];
  deliveryStats: HarvestStats;
  processorOptions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<TabKey>(initialTab);

  function selectTab(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    router.push(`/harvests?${params.toString()}`, { scroll: false });
  }

  const paymentsCount = deliveryFeed.reduce(
    (acc, h) => acc + h.settlements.filter((s) => s.paidDate).length,
    0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "inline-flex",
          padding: 3,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line-soft)",
          alignSelf: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {(
          [
            { id: "farm", label: `Farm · ${farmStats.count}` },
            { id: "reports", label: `Processed · ${deliveryStats.count}` },
            { id: "payments", label: `Payments · ${paymentsCount}` },
          ] as Array<{ id: TabKey; label: string }>
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => selectTab(o.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              background: tab === o.id ? "var(--bg-4)" : "transparent",
              color: tab === o.id ? "var(--text-0)" : "var(--text-2)",
              fontSize: 11.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tab === "farm" && <FarmTab farmHarvests={farmHarvests} farmStats={farmStats} />}
      {tab === "reports" && (
        <ReportsTab
          deliveryFeed={deliveryFeed}
          deliveryStats={deliveryStats}
          processorOptions={processorOptions}
          farmHarvests={farmHarvests}
        />
      )}
      {tab === "payments" && <PaymentsTab deliveryFeed={deliveryFeed} />}
    </div>
  );
}

// ── Farm tab (stages 1 + 2) ──────────────────────────────────────────

function FarmTab({
  farmHarvests,
  farmStats,
}: {
  farmHarvests: FarmHarvestRow[];
  farmStats: FarmHarvestStats;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <FarmHarvestForm />
      <div style={{ display: "flex", gap: 24, padding: "8px 0", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
        <Stat label="Picking events" value={String(farmStats.count)} />
        <Stat label="Total flowers" value={farmStats.totalFlowers.toLocaleString()} />
        <Stat label="Total buckets" value={farmStats.totalBuckets.toLocaleString()} />
      </div>
      {farmHarvests.length === 0 ? (
        <Empty text="No farm harvests recorded for this window." />
      ) : (
        <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
          {farmHarvests.map((h, i) => (
            <FarmHarvestListRow key={h.id} item={h} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function FarmHarvestForm() {
  const router = useRouter();
  const [showFlowersPicked, setShowFlowersPicked] = React.useState(false);
  const [flowersPickedDate, setFlowersPickedDate] = React.useState("");
  const [flowersPickedCount, setFlowersPickedCount] = React.useState("");
  const [harvestDate, setHarvestDate] = React.useState(todayIso());
  const [flowerCount, setFlowerCount] = React.useState("");
  const [bucketCount, setBucketCount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [recordedBy, setRecordedBy] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createFarmHarvest({
        harvestDate,
        flowerCount: flowerCount ? parseInt(flowerCount, 10) : null,
        bucketCount: bucketCount ? parseInt(bucketCount, 10) : null,
        flowersPickedDate: showFlowersPicked && flowersPickedDate ? flowersPickedDate : null,
        flowersPickedCount: showFlowersPicked && flowersPickedCount ? parseInt(flowersPickedCount, 10) : null,
        notes: notes || null,
        recordedBy: recordedBy || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFlowerCount("");
      setBucketCount("");
      setNotes("");
      setFlowersPickedDate("");
      setFlowersPickedCount("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      <div className="label">Record farm harvest</div>

      {!showFlowersPicked ? (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowFlowersPicked(true)}
          style={{ alignSelf: "flex-start", fontSize: 11.5 }}
        >
          <Icon name="plus" size={11} /> Add flowers-picked stage (optional)
        </button>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            padding: 12,
            border: "1px dashed var(--line-soft)",
            borderRadius: 8,
            background: "var(--bg-2)",
          }}
        >
          <Field label="Flowers-picked date">
            <input
              type="date"
              value={flowersPickedDate}
              onChange={(e) => setFlowersPickedDate(e.target.value)}
              className="mono"
              style={inputStyle}
            />
          </Field>
          <Field label="Flowers picked">
            <input
              value={flowersPickedCount}
              onChange={(e) => setFlowersPickedCount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              inputMode="numeric"
              className="mono num"
              style={inputStyle}
            />
          </Field>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setShowFlowersPicked(false);
              setFlowersPickedDate("");
              setFlowersPickedCount("");
            }}
            style={{ alignSelf: "flex-end", fontSize: 11, color: "var(--text-3)" }}
          >
            <Icon name="x" size={10} /> Skip
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Field label="Harvest date">
          <input
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>
        <Field label="Flowers (today)">
          <input
            value={flowerCount}
            onChange={(e) => setFlowerCount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            inputMode="numeric"
            className="mono num"
            style={inputStyle}
          />
        </Field>
        <Field label="Buckets">
          <input
            value={bucketCount}
            onChange={(e) => setBucketCount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            inputMode="numeric"
            className="mono num money-in"
            style={inputStyle}
          />
        </Field>
        <Field label="Recorded by">
          <input
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
            placeholder="Isaac"
            style={inputStyle}
          />
        </Field>
      </div>
      <Field label="Notes" hint="Lots, plant treatments, weather, anything to remember">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
        />
      </Field>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn--primary" disabled={isPending}>
          <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save farm harvest"}
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{error}</span>}
      </div>
    </form>
  );
}

function FarmHarvestListRow({ item, isFirst }: { item: FarmHarvestRow; isFirst: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr auto auto",
        gap: 14,
        padding: "12px 14px",
        alignItems: "center",
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        fontSize: 12.5,
      }}
    >
      <span className="mono" style={{ color: "var(--text-2)" }}>{item.harvestDate}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ color: "var(--text-1)" }}>
          {item.flowersPickedCount !== null && (
            <span style={{ color: "var(--text-3)", fontSize: 11 }}>
              {item.flowersPickedCount.toLocaleString()} flowers picked{item.flowersPickedDate ? ` (${item.flowersPickedDate})` : ""} → {" "}
            </span>
          )}
          {item.flowerCount !== null ? `${item.flowerCount.toLocaleString()} flowers` : ""}
          {item.flowerCount !== null && item.bucketCount !== null ? " · " : ""}
          {item.bucketCount !== null ? `${item.bucketCount.toLocaleString()} buckets` : ""}
        </span>
        {item.notes && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{item.notes}</span>
        )}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{item.recordedBy ?? ""}</span>
      <span className="mono" style={{ fontSize: 10.5, color: item.delivery ? "var(--green)" : "var(--text-3)" }}>
        {item.delivery
          ? `→ ${item.delivery.processorName ?? "—"} · ${item.delivery.deliveryDate}`
          : "no delivery yet"}
      </span>
    </div>
  );
}

// ── Reports tab (stage 3 — what processor reported back) ──────────────

function ReportsTab({
  deliveryFeed,
  deliveryStats,
  processorOptions,
  farmHarvests,
}: {
  deliveryFeed: HarvestRow[];
  deliveryStats: HarvestStats;
  processorOptions: Array<{ id: string; name: string }>;
  farmHarvests: FarmHarvestRow[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ReportForm processorOptions={processorOptions} farmHarvests={farmHarvests} />
      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "8px 0",
          borderTop: "1px solid var(--line-soft)",
          borderBottom: "1px solid var(--line-soft)",
          flexWrap: "wrap",
        }}
      >
        <Stat label="Reports" value={String(deliveryStats.count)} />
        <Stat label="kg accepted" value={Number(deliveryStats.kgProcessed).toLocaleString()} />
        <Stat label="kg declined" value={Number(deliveryStats.kgWaste).toLocaleString()} tone="amber" />
        <Stat label="decline rate" value={`${deliveryStats.wastePct}%`} tone="amber" />
        <Stat label="Total received" value={formatUsd(deliveryStats.netPayUsd)} tone="green" />
      </div>
      {deliveryFeed.length === 0 ? (
        <Empty text="No reports recorded." />
      ) : (
        <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
          {deliveryFeed.map((d, i) => (
            <ReportListRow key={d.id} item={d} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportForm({
  processorOptions,
  farmHarvests,
}: {
  processorOptions: Array<{ id: string; name: string }>;
  farmHarvests: FarmHarvestRow[];
}) {
  const router = useRouter();
  const [date, setDate] = React.useState(todayIso());
  const [processorId, setProcessorId] = React.useState(processorOptions[0]?.id ?? "");
  const [farmHarvestId, setFarmHarvestId] = React.useState("");
  const [kgAccepted, setKgAccepted] = React.useState("");
  const [kgDeclined, setKgDeclined] = React.useState("");
  const [expectedTotal, setExpectedTotal] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pdfUrl, setPdfUrl] = React.useState("");
  const [pdfName, setPdfName] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Add-new-processor inline.
  const [showAddNew, setShowAddNew] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newCountry, setNewCountry] = React.useState("EC");
  const [addingProcessor, startAddProcessor] = React.useTransition();
  const [options, setOptions] = React.useState(processorOptions);

  React.useEffect(() => setOptions(processorOptions), [processorOptions]);

  // Farm harvests not yet linked to a delivery.
  const unlinkedFarm = farmHarvests.filter((f) => !f.delivery);

  function onAddProcessor() {
    if (!newName.trim()) return;
    startAddProcessor(async () => {
      const r = await createProcessorCompany({ name: newName.trim(), country: newCountry.trim() });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOptions((prev) => [...prev, { id: r.id, name: r.name }].sort((a, b) => a.name.localeCompare(b.name)));
      setProcessorId(r.id);
      setNewName("");
      setShowAddNew(false);
      router.refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!processorId) {
      setError("Select a processor (or add a new one).");
      return;
    }
    const acc = parseFloat(kgAccepted || "0") || 0;
    const dec = parseFloat(kgDeclined || "0") || 0;
    const exp = expectedTotal ? parseFloat(expectedTotal) : null;
    if (acc <= 0 && dec <= 0) {
      setError("Enter kg accepted or kg declined.");
      return;
    }
    startTransition(async () => {
      const r = await recordProcessedReport({
        deliveryDate: date,
        processorCompanyId: processorId,
        farmHarvestId: farmHarvestId || null,
        kgAccepted: acc,
        kgDeclined: dec,
        expectedTotalUsd: exp,
        notes: notes || null,
        pdfUrl: pdfUrl || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setKgAccepted("");
      setKgDeclined("");
      setExpectedTotal("");
      setNotes("");
      setPdfUrl("");
      setPdfName("");
      setFarmHarvestId("");
      router.refresh();
    });
  }

  function onDriveSelect(file: DriveFile) {
    setPdfUrl(file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`);
    setPdfName(file.name);
    setPickerOpen(false);
  }

  const declineRate = (() => {
    const a = parseFloat(kgAccepted || "0") || 0;
    const d = parseFloat(kgDeclined || "0") || 0;
    const total = a + d;
    if (total === 0) return null;
    return ((d / total) * 100).toFixed(1);
  })();
  const pricePerKg = (() => {
    const a = parseFloat(kgAccepted || "0") || 0;
    const e = expectedTotal ? parseFloat(expectedTotal) : 0;
    if (a === 0 || e === 0) return null;
    return (e / a).toFixed(2);
  })();

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      <div className="label">Record processed report</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Field label="Report date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>
        <Field label="Processor">
          <div style={{ display: "flex", gap: 6 }}>
            <select
              value={processorId}
              onChange={(e) => setProcessorId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              {options.length === 0 && <option value="">— no processors yet —</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowAddNew((s) => !s)}
              title="Add new processor"
            >
              <Icon name="plus" size={11} />
            </button>
          </div>
          {showAddNew && (
            <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 70px auto", gap: 6 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New processor name"
                style={inputStyle}
              />
              <input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="EC"
                className="mono"
                style={inputStyle}
              />
              <button
                type="button"
                className="btn"
                onClick={onAddProcessor}
                disabled={addingProcessor || !newName.trim()}
              >
                {addingProcessor ? "…" : "Add"}
              </button>
            </div>
          )}
        </Field>
        {unlinkedFarm.length > 0 && (
          <Field label="Link to farm harvest" hint="Optional">
            <select
              value={farmHarvestId}
              onChange={(e) => setFarmHarvestId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {unlinkedFarm.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.harvestDate} · {f.bucketCount ?? "?"} buckets
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Field label="Kg accepted">
          <input
            value={kgAccepted}
            onChange={(e) => setKgAccepted(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num money-in"
            style={inputStyle}
          />
        </Field>
        <Field label="Kg declined">
          <input
            value={kgDeclined}
            onChange={(e) => setKgDeclined(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num"
            style={{ ...inputStyle, color: "var(--amber)" }}
          />
        </Field>
        <Field label="Decline rate" hint="auto">
          <input
            value={declineRate ? `${declineRate}%` : "—"}
            disabled
            className="mono num"
            style={{ ...inputStyle, background: "var(--bg-2)", color: "var(--amber)" }}
          />
        </Field>
        <Field label="Expected total (USD)" hint="kg × rate, what you're owed">
          <input
            value={expectedTotal}
            onChange={(e) => setExpectedTotal(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num"
            style={inputStyle}
          />
        </Field>
        <Field label="Price/kg" hint="auto">
          <input
            value={pricePerKg ? `$${pricePerKg}` : "—"}
            disabled
            className="mono num"
            style={{ ...inputStyle, background: "var(--bg-2)", color: "var(--green)" }}
          />
        </Field>
      </div>

      <Field label="Report PDF" hint="Pick from Drive, or paste a link">
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={pdfName || pdfUrl}
            onChange={(e) => {
              setPdfUrl(e.target.value);
              setPdfName("");
            }}
            placeholder="https://drive.google.com/…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" className="btn btn--ghost" onClick={() => setPickerOpen(true)}>
            <Icon name="search" size={11} /> Browse Drive
          </button>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ textDecoration: "none" }}>
              Open
            </a>
          )}
        </div>
      </Field>

      <DrivePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onDriveSelect} />

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
        />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn--primary" disabled={isPending}>
          <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save report"}
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{error}</span>}
      </div>
    </form>
  );
}

function ReportListRow({ item, isFirst }: { item: HarvestRow; isFirst: boolean }) {
  const isLumpSum = !!item.lotNumber?.startsWith("master_sheet:");
  const reportSettlement = item.settlements.find((s) => Number(s.kgProcessed) > 0 || Number(s.kgWaste) > 0);
  const totalReceived = item.settlements.reduce((a, s) => a + Number(s.netPayUsd), 0);
  const expected = item.settlements.reduce((a, s) => Math.max(a, Number(s.expectedTotalUsd ?? 0)), 0);
  const remaining = expected > 0 ? Math.max(0, expected - totalReceived) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr auto auto auto auto",
        gap: 14,
        padding: "12px 14px",
        alignItems: "center",
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        fontSize: 12.5,
      }}
    >
      <span className="mono" style={{ color: "var(--text-2)" }}>{item.harvestDate}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ color: "var(--text-1)" }}>
          {item.processorName ?? <span style={{ color: "var(--text-3)" }}>Unattributed</span>}
        </span>
        {isLumpSum && (
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            historical lump-sum from master sheet
          </span>
        )}
      </span>
      <span className="mono num" style={{ color: reportSettlement ? "var(--text-1)" : "var(--text-3)" }}>
        {reportSettlement ? `${reportSettlement.kgProcessed} kg` : "—"}
      </span>
      <span className="mono num" style={{ color: reportSettlement && Number(reportSettlement.kgWaste) > 0 ? "var(--amber)" : "var(--text-3)" }}>
        {reportSettlement && Number(reportSettlement.kgWaste) > 0 ? `${reportSettlement.wastePct ?? "—"}%` : "—"}
      </span>
      <span className="mono num money-in" style={{ fontWeight: 500 }}>
        {totalReceived > 0 ? formatUsd(totalReceived.toFixed(2)) : "—"}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: remaining !== null && remaining > 0 ? "var(--rose)" : "var(--text-3)",
        }}
      >
        {remaining !== null && remaining > 0 ? `${formatUsd(remaining.toFixed(2))} pending` : "—"}
      </span>
    </div>
  );
}

// ── Payments tab (stage 4) ────────────────────────────────────────────

function PaymentsTab({ deliveryFeed }: { deliveryFeed: HarvestRow[] }) {
  // Surface harvests with at least one settlement row that has expected > received.
  const pendingPayments = deliveryFeed.filter((h) => {
    const received = h.settlements.reduce((a, s) => a + Number(s.netPayUsd), 0);
    const expected = h.settlements.reduce((a, s) => Math.max(a, Number(s.expectedTotalUsd ?? 0)), 0);
    return expected > received + 0.01;
  });

  // Recent payment events (settlement rows with paidDate set).
  type PaymentEvent = {
    settlementId: string;
    harvestId: string;
    harvestDate: string;
    processorName: string | null;
    kind: string;
    amount: string;
    paidDate: string;
    pdfUrl: string | null;
  };
  const events: PaymentEvent[] = [];
  for (const h of deliveryFeed) {
    for (const s of h.settlements) {
      if (s.paidDate && Number(s.netPayUsd) > 0) {
        events.push({
          settlementId: s.id,
          harvestId: h.id,
          harvestDate: h.harvestDate,
          processorName: h.processorName,
          kind: s.kind,
          amount: s.netPayUsd,
          paidDate: s.paidDate,
          pdfUrl: s.pdfUrl,
        });
      }
    }
  }
  events.sort((a, b) => (a.paidDate < b.paidDate ? 1 : -1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PaymentForm pendingHarvests={pendingPayments} allHarvests={deliveryFeed} />
      {events.length === 0 ? (
        <Empty text="No payments recorded." />
      ) : (
        <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
          {events.map((p, i) => (
            <div
              key={p.settlementId}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 100px 1fr auto auto",
                gap: 14,
                padding: "12px 14px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                fontSize: 12.5,
              }}
            >
              <span className="mono" style={{ color: "var(--text-2)" }}>{p.paidDate}</span>
              <KindChip kind={p.kind} />
              <span style={{ color: "var(--text-1)" }}>
                {p.processorName ?? "Unattributed"} · harvest {p.harvestDate}
              </span>
              <span className="mono num money-in" style={{ fontWeight: 500 }}>
                {formatUsd(p.amount)}
              </span>
              {p.pdfUrl ? (
                <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 10.5, color: "var(--green)" }}>
                  Open ↗
                </a>
              ) : (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentForm({
  pendingHarvests,
  allHarvests,
}: {
  pendingHarvests: HarvestRow[];
  allHarvests: HarvestRow[];
}) {
  const router = useRouter();
  const harvestOptions = pendingHarvests.length > 0 ? pendingHarvests : allHarvests;
  const [harvestId, setHarvestId] = React.useState(harvestOptions[0]?.id ?? "");
  const [kind, setKind] = React.useState<"advance" | "balance" | "lump_sum">("advance");
  const [amount, setAmount] = React.useState("");
  const [paidDate, setPaidDate] = React.useState(todayIso());
  const [pdfUrl, setPdfUrl] = React.useState("");
  const [pdfName, setPdfName] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount || "0") || 0;
    if (!harvestId) {
      setError("Pick a harvest.");
      return;
    }
    if (amt <= 0) {
      setError("Amount must be positive.");
      return;
    }
    startTransition(async () => {
      const r = await recordPayment({
        harvestId,
        kind,
        amountUsd: amt,
        paidDate,
        pdfUrl: pdfUrl || null,
        notes: notes || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAmount("");
      setNotes("");
      setPdfUrl("");
      setPdfName("");
      router.refresh();
    });
  }

  function onDriveSelect(file: DriveFile) {
    setPdfUrl(file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`);
    setPdfName(file.name);
    setPickerOpen(false);
  }

  if (harvestOptions.length === 0) {
    return (
      <Empty text="No harvests yet. Record a processed report first." />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
      }}
    >
      <div className="label">Record payment</div>

      <Field label="Harvest" hint={pendingHarvests.length > 0 ? "Pending payments first; switch to all harvests if needed." : "All harvests."}>
        <select value={harvestId} onChange={(e) => setHarvestId(e.target.value)} style={inputStyle}>
          {harvestOptions.map((h) => {
            const expected = h.settlements.reduce((a, s) => Math.max(a, Number(s.expectedTotalUsd ?? 0)), 0);
            const received = h.settlements.reduce((a, s) => a + Number(s.netPayUsd), 0);
            const remainingLabel =
              expected > received + 0.01 ? ` · $${(expected - received).toFixed(2)} pending` : "";
            return (
              <option key={h.id} value={h.id}>
                {h.harvestDate} · {h.processorName ?? "Unattributed"}{remainingLabel}
              </option>
            );
          })}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as "advance" | "balance" | "lump_sum")} style={inputStyle}>
            <option value="advance">Advance (~30% upfront)</option>
            <option value="balance">Balance (final)</option>
            <option value="lump_sum">Single payment</option>
          </select>
        </Field>
        <Field label="Amount (USD)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num money-in"
            style={inputStyle}
          />
        </Field>
        <Field label="Paid date">
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Receipt / PDF" hint="Optional Drive link">
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={pdfName || pdfUrl}
            onChange={(e) => {
              setPdfUrl(e.target.value);
              setPdfName("");
            }}
            placeholder="https://drive.google.com/…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" className="btn btn--ghost" onClick={() => setPickerOpen(true)}>
            <Icon name="search" size={11} /> Browse Drive
          </button>
        </div>
      </Field>

      <DrivePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onDriveSelect} />

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
        />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn--primary" disabled={isPending}>
          <Icon name="check" size={11} /> {isPending ? "Saving…" : "Save payment"}
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{error}</span>}
      </div>
    </form>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
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
      {text}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "amber";
}) {
  const color =
    tone === "green" ? "var(--green)" : tone === "amber" ? "var(--amber)" : "var(--text-1)";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span className="label">{label}</span>
      <span className="mono num" style={{ fontSize: 14, color, fontWeight: 500 }}>
        {value}
      </span>
    </span>
  );
}

function KindChip({ kind }: { kind: string }) {
  const map: Record<string, { label: string; color: string }> = {
    advance:  { label: "advance",  color: "var(--sky)" },
    balance:  { label: "balance",  color: "var(--green)" },
    lump_sum: { label: "lump",     color: "var(--text-2)" },
  };
  const m = map[kind] ?? { label: kind, color: "var(--text-2)" };
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: m.color,
        padding: "2px 6px",
        borderRadius: 3,
        background: `oklch(from ${m.color} l c h / 0.12)`,
        textAlign: "center",
        width: 80,
      }}
    >
      {m.label}
    </span>
  );
}
