"use client";

// Harvests page tab switcher + entry forms. Two surfaces:
//   • "Farm" — the picking event. Form: date, flower_count, bucket_count,
//     notes, recordedBy. List below shows recent farm harvests.
//   • "Reports" — what processor reported back. Form: date, processor
//     (picker w/ add-new), kg_accepted, kg_declined, net pay, paid_date.
//     List below shows the existing harvests feed.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createFarmHarvest,
  recordDelivery,
  createProcessorCompany,
} from "@/lib/actions/farm-harvests";
import type { FarmHarvestRow, FarmHarvestStats } from "@/lib/queries/farm-harvests";
import type { HarvestRow as DeliveryRow, HarvestStats } from "@/lib/queries/harvests";
import { Icon } from "./icons";
import { formatUsd } from "@/lib/money";
import { DrivePicker, type DriveFile } from "./drive-picker";

type TabKey = "farm" | "reports";

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
  deliveryFeed: DeliveryRow[];
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
        }}
      >
        {([
          { id: "farm", label: `Farm · ${farmStats.count}` },
          { id: "reports", label: `Reports · ${deliveryStats.count}` },
        ] as Array<{ id: TabKey; label: string }>).map((o) => (
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

      {tab === "farm" && (
        <FarmTab farmHarvests={farmHarvests} farmStats={farmStats} />
      )}
      {tab === "reports" && (
        <ReportsTab
          deliveryFeed={deliveryFeed}
          deliveryStats={deliveryStats}
          processorOptions={processorOptions}
        />
      )}
    </div>
  );
}

// ── Farm tab ──────────────────────────────────────────────────────────

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
          No farm harvests recorded for this window.
        </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Field label="Date">
          <input
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>
        <Field label="Flowers">
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

// ── Reports tab ───────────────────────────────────────────────────────

function ReportsTab({
  deliveryFeed,
  deliveryStats,
  processorOptions,
}: {
  deliveryFeed: DeliveryRow[];
  deliveryStats: HarvestStats;
  processorOptions: Array<{ id: string; name: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ReportForm processorOptions={processorOptions} />
      <div style={{ display: "flex", gap: 24, padding: "8px 0", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
        <Stat label="Reports" value={String(deliveryStats.count)} />
        <Stat label="kg accepted" value={Number(deliveryStats.kgProcessed).toLocaleString()} />
        <Stat label="kg declined" value={Number(deliveryStats.kgWaste).toLocaleString()} tone="amber" />
        <Stat label="decline rate" value={`${deliveryStats.wastePct}%`} tone="amber" />
        <Stat label="Net pay" value={formatUsd(deliveryStats.netPayUsd)} tone="green" />
      </div>
      {deliveryFeed.length === 0 ? (
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
          No reports recorded.
        </div>
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
}: {
  processorOptions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [date, setDate] = React.useState(todayIso());
  const [processorId, setProcessorId] = React.useState(processorOptions[0]?.id ?? "");
  const [kgAccepted, setKgAccepted] = React.useState("");
  const [kgDeclined, setKgDeclined] = React.useState("");
  const [netPay, setNetPay] = React.useState("");
  const [paidDate, setPaidDate] = React.useState("");
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
    const pay = parseFloat(netPay || "0") || 0;
    if (acc <= 0 && dec <= 0) {
      setError("Enter kg accepted or kg declined.");
      return;
    }
    startTransition(async () => {
      const r = await recordDelivery({
        deliveryDate: date,
        processorCompanyId: processorId,
        kgAccepted: acc,
        kgDeclined: dec,
        netPayUsd: pay,
        paidDate: paidDate || null,
        notes: notes || null,
        pdfUrl: pdfUrl || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setKgAccepted("");
      setKgDeclined("");
      setNetPay("");
      setPaidDate("");
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

  const declineRate = (() => {
    const a = parseFloat(kgAccepted || "0") || 0;
    const d = parseFloat(kgDeclined || "0") || 0;
    const total = a + d;
    if (total === 0) return null;
    return ((d / total) * 100).toFixed(1);
  })();
  const pricePerKg = (() => {
    const a = parseFloat(kgAccepted || "0") || 0;
    const p = parseFloat(netPay || "0") || 0;
    if (a === 0 || p === 0) return null;
    return (p / a).toFixed(2);
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
      <div className="label">Record processor report</div>

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
        <Field label="Net pay (USD)">
          <input
            value={netPay}
            onChange={(e) => setNetPay(e.target.value)}
            placeholder="0"
            inputMode="decimal"
            className="mono num money-in"
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

      <Field label="Liquidación PDF" hint="Pick from Drive, or paste a link">
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

      <DrivePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onDriveSelect}
      />

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

function ReportListRow({ item, isFirst }: { item: DeliveryRow; isFirst: boolean }) {
  const isLumpSum = !!item.lotNumber?.startsWith("master_sheet:");
  const kg = item.settlement && Number(item.settlement.kgProcessed) > 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr auto auto auto",
        gap: 14,
        padding: "12px 14px",
        alignItems: "center",
        borderTop: isFirst ? 0 : "1px solid var(--line-soft)",
        fontSize: 12.5,
      }}
    >
      <span className="mono" style={{ color: "var(--text-2)" }}>{item.harvestDate}</span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ color: "var(--text-1)" }}>{item.processorName}</span>
        {isLumpSum && (
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            lump-sum from master sheet · awaiting full PDF
          </span>
        )}
      </span>
      <span className="mono num" style={{ color: kg ? "var(--text-1)" : "var(--text-3)" }}>
        {kg ? `${item.settlement!.kgProcessed} kg` : "—"}
      </span>
      <span className="mono num" style={{ color: item.settlement && Number(item.settlement.kgWaste) > 0 ? "var(--amber)" : "var(--text-3)" }}>
        {item.settlement && Number(item.settlement.kgWaste) > 0
          ? `${item.settlement.wastePct ?? "—"}%`
          : "—"}
      </span>
      <span className="mono num money-in" style={{ fontWeight: 500 }}>
        {item.settlement?.netPayUsd ? formatUsd(item.settlement.netPayUsd) : "—"}
      </span>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────

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
