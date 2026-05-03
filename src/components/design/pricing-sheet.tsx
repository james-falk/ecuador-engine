// Recreates Ecuador/Selling in US/Documents/Pricing Sheet.xlsx, table-for-table.
// Sheet 1: Pricing Model — shared inputs, logistics, container scenarios,
//          sell pricing by margin, sell pricing by carton price.
// Sheet 2: Market Data — USDA snapshot + seasonal summary.
//
// Inputs are editable (yellow cells); everything else is computed live.

"use client";

import * as React from "react";
import {
  computePricing,
  sellByMargin,
  sellByCartonPrice,
  DEFAULT_MARGIN_PCTS,
  DEFAULT_CARTON_PRICES,
  MARKET_DATA_SNAPSHOT,
  SEASONAL_SUMMARY,
  type PricingInputsRow,
} from "@/lib/queries/pricing";
import { updatePricingInputs } from "@/lib/actions/pricing";

const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd4 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString("en-US", opts);
const pct = (n: number) => `${n.toFixed(1)}%`;

const inputCellStyle: React.CSSProperties = {
  width: 110,
  padding: "4px 8px",
  background: "oklch(from #facc15 l c h / 0.18)", // soft yellow per the source sheet
  border: "1px solid oklch(from #facc15 l c h / 0.4)",
  borderRadius: 5,
  color: "var(--text-0)",
  fontSize: 12.5,
  outline: "none",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right" as const,
  fontFamily: "var(--font-mono)",
};

export function PricingSheet({ inputs }: { inputs: PricingInputsRow }) {
  const [draft, setDraft] = React.useState<PricingInputsRow>(inputs);
  const [saving, startSave] = React.useTransition();
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const computed = React.useMemo(() => computePricing(draft), [draft]);
  const marginRows20 = sellByMargin(computed.twentyFt, DEFAULT_MARGIN_PCTS);
  const marginRows40 = sellByMargin(computed.fortyFt, DEFAULT_MARGIN_PCTS);
  const cartonRows20 = sellByCartonPrice(computed.twentyFt, DEFAULT_CARTON_PRICES, draft.kgPerCarton);
  const cartonRows40 = sellByCartonPrice(computed.fortyFt, DEFAULT_CARTON_PRICES, draft.kgPerCarton);

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const r = await updatePricingInputs({
        fruitCostPerKgUsd: draft.fruitCostPerKgUsd,
        kgPerCarton: draft.kgPerCarton,
        labelCostPerCartonUsd: draft.labelCostPerCartonUsd,
        packingCostPerCartonUsd: draft.packingCostPerCartonUsd,
        materialCostPerCartonUsd: draft.materialCostPerCartonUsd,
        ecuadorTransportUsd: draft.ecuadorTransportUsd,
        oceanFreightUsd: draft.oceanFreightUsd,
        importCustomsUsd: draft.importCustomsUsd,
        cartonsPer20ft: draft.cartonsPer20ft,
        cartonsPer40ft: draft.cartonsPer40ft,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    });
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(inputs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>
          Dragonfruit Landed Cost &amp; Pricing Model
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Mirror of <code style={{ background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>Ecuador/Selling in US/Documents/Pricing Sheet.xlsx</code>. Yellow cells are editable.
        </span>
      </header>

      <SaveBar dirty={dirty} saving={saving} saved={savedFlash} error={error} onSave={onSave} onReset={() => setDraft(inputs)} />

      <Section title="Shared inputs">
        <KV label="Fruit cost per kg">
          <NumInput value={draft.fruitCostPerKgUsd} step={0.01} prefix="$" onChange={(v) => setDraft({ ...draft, fruitCostPerKgUsd: v })} />
        </KV>
        <KV label="Kg per carton">
          <NumInput value={draft.kgPerCarton} step={0.1} onChange={(v) => setDraft({ ...draft, kgPerCarton: v })} />
        </KV>
        <KV label="Label cost per carton">
          <NumInput value={draft.labelCostPerCartonUsd} step={0.01} prefix="$" onChange={(v) => setDraft({ ...draft, labelCostPerCartonUsd: v })} />
        </KV>
        <KV label="Packing cost per carton">
          <NumInput value={draft.packingCostPerCartonUsd} step={0.01} prefix="$" onChange={(v) => setDraft({ ...draft, packingCostPerCartonUsd: v })} />
        </KV>
        <KV label="Material cost per carton">
          <NumInput value={draft.materialCostPerCartonUsd} step={0.01} prefix="$" onChange={(v) => setDraft({ ...draft, materialCostPerCartonUsd: v })} />
        </KV>
      </Section>

      <Section title="Logistics (per FCL — applies to both scenarios)">
        <KV label="Ecuador transport">
          <NumInput value={draft.ecuadorTransportUsd} step={10} prefix="$" onChange={(v) => setDraft({ ...draft, ecuadorTransportUsd: v })} />
        </KV>
        <KV label="Ocean freight">
          <NumInput value={draft.oceanFreightUsd} step={50} prefix="$" onChange={(v) => setDraft({ ...draft, oceanFreightUsd: v })} />
        </KV>
        <KV label="Import / customs">
          <NumInput value={draft.importCustomsUsd} step={50} prefix="$" onChange={(v) => setDraft({ ...draft, importCustomsUsd: v })} />
        </KV>
        <KV label="Total shipping (entire unit)">
          <ReadOnlyValue>{usd2(computed.totalShippingUsd)}</ReadOnlyValue>
        </KV>
      </Section>

      <Section title="Container scenarios">
        <ContainerTable
          rows={[
            { label: "Cartons per shipment", a: num(computed.twentyFt.cartons), b: num(computed.fortyFt.cartons) },
            { label: "Total kg",             a: num(computed.twentyFt.totalKg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), b: num(computed.fortyFt.totalKg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
            { label: "Total fruit cost",     a: usd2(computed.twentyFt.totalFruitCostUsd), b: usd2(computed.fortyFt.totalFruitCostUsd) },
            { label: "Total packing cost",   a: usd2(computed.twentyFt.totalPackingCostUsd), b: usd2(computed.fortyFt.totalPackingCostUsd) },
            { label: "Total shipping",       a: usd2(computed.twentyFt.totalShippingUsd), b: usd2(computed.fortyFt.totalShippingUsd) },
            { label: "Total landed cost",    a: usd2(computed.twentyFt.totalLandedUsd), b: usd2(computed.fortyFt.totalLandedUsd), bold: true },
            { label: "Cost per kg",          a: usd4(computed.twentyFt.costPerKgUsd), b: usd4(computed.fortyFt.costPerKgUsd), accent: "amber" },
            { label: "Cost per carton",      a: usd4(computed.twentyFt.costPerCartonUsd), b: usd4(computed.fortyFt.costPerCartonUsd), accent: "amber" },
          ]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "120px 110px 110px 110px", marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
          <span>20'/40' editable</span>
          <NumInput value={draft.cartonsPer20ft} step={1} onChange={(v) => setDraft({ ...draft, cartonsPer20ft: Math.trunc(v) })} />
          <span />
          <NumInput value={draft.cartonsPer40ft} step={1} onChange={(v) => setDraft({ ...draft, cartonsPer40ft: Math.trunc(v) })} />
        </div>
      </Section>

      <Section title="Sell pricing — by margin">
        <MarginTable rows20={marginRows20} rows40={marginRows40} />
      </Section>

      <Section title="Sell pricing — by carton price">
        <CartonPriceTable rows20={cartonRows20} rows40={cartonRows40} />
      </Section>

      <Section title="Market data — USDA Miami shipping point">
        <MarketDataTable />
      </Section>

      <Section title="Seasonal price summary — Red Skin / White Flesh, 4.5 kg carton, Ecuador origin">
        <SeasonalTable />
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>
          Seasonal swing is ~$10–15/carton between spring lows and fall highs. Landed cost of ~$13/carton sits below the lowest USDA Miami FOB of $18/carton.
        </div>
      </Section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ margin: "0 0 12px", color: "var(--text-1)", fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {title}
      </h3>
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: 14, background: "var(--bg-1)" }}>
        {children}
      </div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px dashed var(--line-soft)",
        fontSize: 12.5,
      }}
    >
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{children}</span>
    </div>
  );
}

function NumInput({
  value,
  step,
  prefix,
  onChange,
}: {
  value: number;
  step: number;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {prefix && <span style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{prefix}</span>}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        style={inputCellStyle}
      />
    </span>
  );
}

function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono num" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 500, color: "var(--text-1)" }}>
      {children}
    </span>
  );
}

function ContainerTable({
  rows,
}: {
  rows: Array<{ label: string; a: string; b: string; bold?: boolean; accent?: "amber" | "green" }>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={th}></th>
            <th style={{ ...th, textAlign: "right" }}>20&apos; FCL</th>
            <th style={{ ...th, textAlign: "right" }}>40&apos; FCL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={td}>{r.label}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: r.bold ? 600 : 400, color: r.accent === "amber" ? "var(--amber)" : "var(--text-1)" }}>{r.a}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: r.bold ? 600 : 400, color: r.accent === "amber" ? "var(--amber)" : "var(--text-1)" }}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginTable({
  rows20,
  rows40,
}: {
  rows20: ReturnType<typeof sellByMargin>;
  rows40: ReturnType<typeof sellByMargin>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>Margin %</th>
            <th colSpan={4} style={{ ...th, textAlign: "center", borderLeft: "1px solid var(--line-soft)" }}>20&apos; FCL</th>
            <th colSpan={4} style={{ ...th, textAlign: "center", borderLeft: "1px solid var(--line-soft)" }}>40&apos; FCL</th>
          </tr>
          <tr>
            <th style={th2}>$/kg</th>
            <th style={th2}>$/carton</th>
            <th style={th2}>Revenue</th>
            <th style={th2}>Profit</th>
            <th style={{ ...th2, borderLeft: "1px solid var(--line-soft)" }}>$/kg</th>
            <th style={th2}>$/carton</th>
            <th style={th2}>Revenue</th>
            <th style={th2}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows20.map((r, i) => {
            const r2 = rows40[i];
            return (
              <tr key={r.marginPct}>
                <td style={{ ...td, fontWeight: 500 }}>{r.marginPct}%</td>
                <td style={tdNum}>{usd4(r.pricePerKg)}</td>
                <td style={tdNum}>{usd2(r.pricePerCarton)}</td>
                <td style={tdNum}>{usd2(r.revenue)}</td>
                <td style={{ ...tdNum, color: "var(--green)", fontWeight: 500 }}>{usd2(r.profit)}</td>
                <td style={{ ...tdNum, borderLeft: "1px solid var(--line-soft)" }}>{usd4(r2.pricePerKg)}</td>
                <td style={tdNum}>{usd2(r2.pricePerCarton)}</td>
                <td style={tdNum}>{usd2(r2.revenue)}</td>
                <td style={{ ...tdNum, color: "var(--green)", fontWeight: 500 }}>{usd2(r2.profit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CartonPriceTable({
  rows20,
  rows40,
}: {
  rows20: ReturnType<typeof sellByCartonPrice>;
  rows40: ReturnType<typeof sellByCartonPrice>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>$/carton</th>
            <th colSpan={4} style={{ ...th, textAlign: "center", borderLeft: "1px solid var(--line-soft)" }}>20&apos; FCL</th>
            <th colSpan={4} style={{ ...th, textAlign: "center", borderLeft: "1px solid var(--line-soft)" }}>40&apos; FCL</th>
          </tr>
          <tr>
            <th style={th2}>$/kg</th>
            <th style={th2}>Margin</th>
            <th style={th2}>Revenue</th>
            <th style={th2}>Profit</th>
            <th style={{ ...th2, borderLeft: "1px solid var(--line-soft)" }}>$/kg</th>
            <th style={th2}>Margin</th>
            <th style={th2}>Revenue</th>
            <th style={th2}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows20.map((r, i) => {
            const r2 = rows40[i];
            return (
              <tr key={r.pricePerCarton}>
                <td style={{ ...td, fontWeight: 500 }}>{usd2(r.pricePerCarton)}</td>
                <td style={tdNum}>{usd4(r.pricePerKg)}</td>
                <td style={{ ...tdNum, color: r.marginPct < 0 ? "var(--rose)" : "var(--text-1)" }}>{pct(r.marginPct)}</td>
                <td style={tdNum}>{usd2(r.revenue)}</td>
                <td style={{ ...tdNum, color: r.profit < 0 ? "var(--rose)" : "var(--green)", fontWeight: 500 }}>{usd2(r.profit)}</td>
                <td style={{ ...tdNum, borderLeft: "1px solid var(--line-soft)" }}>{usd4(r2.pricePerKg)}</td>
                <td style={{ ...tdNum, color: r2.marginPct < 0 ? "var(--rose)" : "var(--text-1)" }}>{pct(r2.marginPct)}</td>
                <td style={tdNum}>{usd2(r2.revenue)}</td>
                <td style={{ ...tdNum, color: r2.profit < 0 ? "var(--rose)" : "var(--green)", fontWeight: 500 }}>{usd2(r2.profit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketDataTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Variety</th>
            <th style={th}>Package</th>
            <th style={th}>Size</th>
            <th style={th}>Price low</th>
            <th style={th}>Price high</th>
            <th style={th}>Demand</th>
            <th style={th}>Market</th>
            <th style={th}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {MARKET_DATA_SNAPSHOT.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{r.date}</td>
              <td style={td}>{r.variety}</td>
              <td style={td}>{r.pkg}</td>
              <td style={td}>{r.size}</td>
              <td style={tdNum}>{r.priceLow}</td>
              <td style={tdNum}>{r.priceHigh}</td>
              <td style={td}>{r.demand}</td>
              <td style={td}>{r.market}</td>
              <td style={{ ...td, fontSize: 11, color: "var(--text-3)" }}>{r.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeasonalTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>Period</th>
            <th style={th}>Source</th>
            <th style={th}>Market</th>
            <th style={th}>Price low</th>
            <th style={th}>Price high</th>
            <th style={th}>Avg $/kg</th>
          </tr>
        </thead>
        <tbody>
          {SEASONAL_SUMMARY.map((r, i) => (
            <tr key={i}>
              <td style={td}>{r.period}</td>
              <td style={td}>{r.source}</td>
              <td style={td}>{r.market}</td>
              <td style={tdNum}>{r.priceLow}</td>
              <td style={tdNum}>{r.priceHigh}</td>
              <td style={{ ...tdNum, color: "var(--green)", fontWeight: 500 }}>{r.avgPerKg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SaveBar({
  dirty,
  saving,
  saved,
  error,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty && !saved && !error) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: error ? "oklch(from var(--rose) l c h / 0.10)" : saved ? "oklch(from var(--green) l c h / 0.10)" : "var(--bg-2)",
        border: `1px solid ${error ? "var(--rose)" : saved ? "var(--green)" : "var(--line-soft)"}`,
        borderRadius: 10,
        fontSize: 12.5,
      }}
    >
      <span style={{ flex: 1, color: error ? "var(--rose)" : saved ? "var(--green)" : "var(--text-2)" }}>
        {error ? `Save failed: ${error}` : saved ? "Saved." : "Pricing inputs changed — save to apply."}
      </span>
      <button type="button" className="btn btn--ghost" onClick={onReset} disabled={saving} style={{ fontSize: 11 }}>Reset</button>
      <button type="button" className="btn btn--primary" onClick={onSave} disabled={saving || !dirty} style={{ fontSize: 11 }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  borderBottom: "1px solid var(--line-soft)",
};

const th2: React.CSSProperties = {
  ...th,
  textAlign: "right",
  fontSize: 9.5,
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 12.5,
  color: "var(--text-1)",
  borderBottom: "1px solid var(--line-soft)",
};

const tdNum: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
};
