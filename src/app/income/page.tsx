// /income — cross-pillar money rollup. The "did we make money this year?"
// page. Pulls expenses (out), settlements (in), capital flows (US ↔ EC),
// and farm-side bucket counts into a single year/month view.
//
// Seasonal overlay is the heart of the page: monthly avg price/kg vs
// monthly bucket count. Goal — see when prices spike and decide whether
// to use lights/products to push harvest into those windows.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import {
  getIncomeMonthly,
  getIncomeYearSummary,
  getYearsAvailable,
  getYoYSummary,
  type MonthRow,
  type IncomeYearSummary,
} from "@/lib/queries/income";
import { formatUsd, formatUsdShort } from "@/lib/money";
import { CashMovementEntry } from "@/components/design/cash-movement-entry";
import { getDefaultAccountId } from "@/lib/queries/accounts";

const FALLBACK_YEARS = [2022, 2023, 2024, 2025, 2026];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type CompanyKey = "finca-del-dragon" | "puresol-imports";
const COMPANY_TABS: Array<{ key: CompanyKey; label: string }> = [
  { key: "finca-del-dragon", label: "Finca del Dragón" },
  { key: "puresol-imports",  label: "PureSol Imports" },
];

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; company?: string }>;
}) {
  const params = await searchParams;
  const requested = params.year;
  const year = (() => {
    const y = requested ? parseInt(requested, 10) : new Date().getFullYear();
    return Number.isFinite(y) ? y : new Date().getFullYear();
  })();
  const companyTab: CompanyKey = COMPANY_TABS.some((t) => t.key === params.company)
    ? (params.company as CompanyKey)
    : "finca-del-dragon";

  const yearsAvailable = await getYearsAvailable();
  const years = yearsAvailable.length > 0 ? yearsAvailable : FALLBACK_YEARS;

  const [months, summary, yoy, fincaAccountId] = await Promise.all([
    getIncomeMonthly(year, companyTab),
    getIncomeYearSummary(year, companyTab),
    getYoYSummary(years, companyTab),
    getDefaultAccountId(),
  ]);

  const isEmptyCompany = companyTab === "puresol-imports" && Number(summary.expensesUsd) === 0 && Number(summary.settlementsUsd) === 0 && summary.capitalInUsd === "0.00" && summary.capitalOutUsd === "0.00";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Income sheet", String(year)]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            net {formatUsdShort(summary.netUsd)}
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Income sheet
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Money in, money out — per company, never mixed.
            </span>
          </div>

          <CompanyTabs current={companyTab} year={requested ?? String(year)} />
          <YearPicker selected={String(year)} years={years} companyTab={companyTab} />

          {isEmptyCompany ? (
            <EmptyCompanyState companyLabel="PureSol Imports" />
          ) : (
            <>
              {companyTab === "finca-del-dragon" && fincaAccountId && (
                <CashMovementEntry accountId={fincaAccountId} />
              )}
              <Kpis summary={summary} />
              <MonthlyChart months={months} />
              {companyTab === "finca-del-dragon" && <SeasonalOverlay months={months} />}
              <YoYTable yoy={yoy} currentYear={year} companyTab={companyTab} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Year picker ──────────────────────────────────────────────────────

function CompanyTabs({ current, year }: { current: CompanyKey; year: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 8,
        background: "var(--bg-2)",
        border: "1px solid var(--line-soft)",
        marginBottom: 14,
      }}
    >
      {COMPANY_TABS.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={`?company=${t.key}&year=${year}`}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              background: active ? "var(--bg-4)" : "transparent",
              color: active ? "var(--text-0)" : "var(--text-2)",
              fontSize: 11.5,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyCompanyState({ companyLabel }: { companyLabel: string }) {
  return (
    <div
      style={{
        padding: "48px 18px",
        textAlign: "center",
        color: "var(--text-3)",
        fontSize: 13,
        border: "1px dashed var(--line-soft)",
        borderRadius: 10,
        marginTop: 8,
      }}
    >
      No financial activity recorded for {companyLabel} yet.
    </div>
  );
}

function YearPicker({ selected, years, companyTab }: { selected: string; years: number[]; companyTab: CompanyKey }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
      <span className="label" style={{ color: "var(--text-3)", marginRight: 8 }}>Year</span>
      {years.map((y) => {
        const key = String(y);
        const active = key === selected;
        return (
          <Link
            key={key}
            href={`?company=${companyTab}&year=${y}`}
            className="mono"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              borderRadius: 4,
              textDecoration: "none",
              color: active ? "var(--text-1)" : "var(--text-3)",
              background: active ? "var(--surface-2)" : "transparent",
              border: `1px solid ${active ? "var(--border-2)" : "var(--border-1)"}`,
            }}
          >
            {key}
          </Link>
        );
      })}
    </div>
  );
}

// ── KPI tiles ────────────────────────────────────────────────────────

function Kpis({ summary }: { summary: IncomeYearSummary }) {
  const net = Number(summary.netUsd);
  const tiles: Array<{ label: string; value: string; color?: string; sub?: string }> = [
    { label: "Settlements in", value: formatUsd(summary.settlementsUsd), color: "money-in" },
    { label: "Expenses out",   value: formatUsd(summary.expensesUsd),    color: "money-out" },
    { label: "Operating net",  value: formatUsd(summary.netUsd),         color: net >= 0 ? "money-in" : "capital-out" },
    { label: "Capital in",     value: formatUsd(summary.capitalInUsd),   color: "capital-in" },
    { label: "Capital out",    value: formatUsd(summary.capitalOutUsd),  color: "capital-out" },
    { label: "Buckets",        value: summary.buckets.toLocaleString(),  sub: `${summary.kgProcessed} kg` },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 28,
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            padding: "14px 16px",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            background: "var(--bg-1)",
          }}
        >
          <div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>
            {t.label}
          </div>
          <div className={`mono num ${t.color ?? ""}`} style={{ fontSize: 16, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            {t.value}
          </div>
          {t.sub && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
              {t.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Monthly bar chart: expenses (amber) vs settlements (green) ──────

function MonthlyChart({ months }: { months: MonthRow[] }) {
  const peak = Math.max(
    1,
    ...months.map((m) => Math.max(Number(m.expensesUsd), Number(m.settlementsUsd)))
  );
  const W = 1080;
  const H = 200;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const colW = innerW / 12;
  const barW = (colW - 6) / 2;

  return (
    <Section title="Monthly — expenses vs settlements">
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 720 }}>
          {/* Y axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + innerH * (1 - t);
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--line-soft)" strokeDasharray={t === 0 ? "" : "2 3"} />
                <text x={padL - 6} y={y + 3} fill="var(--text-3)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
                  {formatUsdShort(peak * t)}
                </text>
              </g>
            );
          })}

          {months.map((m, i) => {
            const exp = Number(m.expensesUsd);
            const set = Number(m.settlementsUsd);
            const x = padL + i * colW;
            const expH = (exp / peak) * innerH;
            const setH = (set / peak) * innerH;
            return (
              <g key={m.month}>
                <rect
                  x={x + 3}
                  y={padT + innerH - setH}
                  width={barW}
                  height={Math.max(0, setH)}
                  fill="var(--green)"
                  opacity={0.85}
                />
                <rect
                  x={x + 3 + barW}
                  y={padT + innerH - expH}
                  width={barW}
                  height={Math.max(0, expH)}
                  fill="var(--amber)"
                  opacity={0.85}
                />
                <text
                  x={x + colW / 2}
                  y={H - 10}
                  fill="var(--text-3)"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {MONTH_LABELS[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend
        items={[
          { color: "var(--green)", label: "Settlements" },
          { color: "var(--amber)", label: "Expenses" },
        ]}
      />
    </Section>
  );
}

// ── Seasonal overlay: bucket bars + price/kg line ────────────────────

function SeasonalOverlay({ months }: { months: MonthRow[] }) {
  const buckets = months.map((m) => m.buckets);
  const prices = months.map((m) => (m.pricePerKg ? Number(m.pricePerKg) : null));
  const peakBuckets = Math.max(1, ...buckets);
  const validPrices = prices.filter((p): p is number => p !== null && Number.isFinite(p));
  const peakPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const priceRange = peakPrice - minPrice || 1;

  const bestPriceIdx = prices.findIndex((p) => p === peakPrice);
  const bestBucketsIdx = buckets.indexOf(peakBuckets);

  const W = 1080;
  const H = 220;
  const padL = 44;
  const padR = 44;
  const padT = 16;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const colW = innerW / 12;

  // Build the price polyline (skip months where price is null).
  const linePoints = prices
    .map((p, i) => {
      if (p === null) return null;
      const x = padL + i * colW + colW / 2;
      const y = padT + innerH - ((p - minPrice) / priceRange) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((p): p is string => p !== null);

  const noPrice = validPrices.length === 0;
  const noBuckets = peakBuckets <= 1;

  return (
    <Section
      title="Seasonal — when fruit is worth the most"
      hint="Bars = buckets harvested · Line = $/kg paid by processor"
    >
      {noPrice && noBuckets ? (
        <Empty text="No farm or settlement data yet for this year." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 720 }}>
              {/* Left axis (buckets) */}
              {[0, 0.5, 1].map((t) => {
                const y = padT + innerH * (1 - t);
                return (
                  <g key={`yl${t}`}>
                    <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--line-soft)" strokeDasharray={t === 0 ? "" : "2 3"} />
                    <text x={padL - 6} y={y + 3} fill="var(--text-3)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
                      {Math.round(peakBuckets * t).toLocaleString()}
                    </text>
                  </g>
                );
              })}
              {/* Right axis (price) */}
              {!noPrice && [0, 0.5, 1].map((t) => {
                const y = padT + innerH * (1 - t);
                const v = minPrice + priceRange * t;
                return (
                  <text key={`yr${t}`} x={W - padR + 6} y={y + 3} fill="var(--text-3)" fontSize="9" textAnchor="start" fontFamily="var(--font-mono)">
                    ${v.toFixed(2)}
                  </text>
                );
              })}

              {/* Bucket bars */}
              {months.map((m, i) => {
                const x = padL + i * colW;
                const h = (m.buckets / peakBuckets) * innerH;
                const isPeak = i === bestBucketsIdx && m.buckets > 0;
                return (
                  <g key={`b${m.month}`}>
                    <rect
                      x={x + 4}
                      y={padT + innerH - h}
                      width={colW - 8}
                      height={Math.max(0, h)}
                      fill="var(--sky)"
                      opacity={isPeak ? 0.9 : 0.45}
                    />
                    <text
                      x={x + colW / 2}
                      y={H - 12}
                      fill="var(--text-3)"
                      fontSize="10"
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                    >
                      {MONTH_LABELS[i]}
                    </text>
                  </g>
                );
              })}

              {/* Price polyline + dots */}
              {!noPrice && linePoints.length > 0 && (
                <polyline
                  points={linePoints.join(" ")}
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="1.75"
                />
              )}
              {!noPrice && prices.map((p, i) => {
                if (p === null) return null;
                const x = padL + i * colW + colW / 2;
                const y = padT + innerH - ((p - minPrice) / priceRange) * innerH;
                const isPeak = i === bestPriceIdx;
                return (
                  <g key={`p${i}`}>
                    <circle cx={x} cy={y} r={isPeak ? 4 : 2.5} fill="var(--green)" />
                    {isPeak && (
                      <text x={x} y={y - 8} fill="var(--green)" fontSize="9.5" textAnchor="middle" fontFamily="var(--font-mono)">
                        ${p.toFixed(2)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <Insight
              label="Peak price"
              value={!noPrice ? `$${peakPrice.toFixed(2)}/kg` : "—"}
              sub={!noPrice && bestPriceIdx >= 0 ? MONTH_LABELS[bestPriceIdx] : undefined}
              color="money-in"
            />
            <Insight
              label="Peak harvest"
              value={!noBuckets ? `${peakBuckets.toLocaleString()} buckets` : "—"}
              sub={!noBuckets ? MONTH_LABELS[bestBucketsIdx] : undefined}
              color="capital-in"
            />
            <Insight
              label="Aligned?"
              value={
                !noPrice && !noBuckets
                  ? bestPriceIdx === bestBucketsIdx
                    ? "Yes — peak price hit during peak harvest"
                    : `${Math.abs(bestPriceIdx - bestBucketsIdx)} mo apart`
                  : "—"
              }
              sub={
                !noPrice && !noBuckets && bestPriceIdx !== bestBucketsIdx
                  ? "Lights/products could shift harvest"
                  : undefined
              }
            />
          </div>
        </>
      )}
      <Legend
        items={[
          { color: "var(--sky)", label: "Buckets" },
          { color: "var(--green)", label: "Price $/kg" },
        ]}
      />
    </Section>
  );
}

// ── YoY table ────────────────────────────────────────────────────────

function YoYTable({ yoy, currentYear, companyTab }: { yoy: IncomeYearSummary[]; currentYear: number; companyTab: CompanyKey }) {
  const sorted = [...yoy].sort((a, b) => b.year - a.year);
  return (
    <Section title="Year over year">
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 1fr 1fr 1fr 1fr 90px",
            padding: "10px 14px",
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--line)",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          <span>Year</span>
          <span style={{ textAlign: "right" }}>Settlements</span>
          <span style={{ textAlign: "right" }}>Expenses</span>
          <span style={{ textAlign: "right" }}>Net</span>
          <span style={{ textAlign: "right" }}>Capital in</span>
          <span style={{ textAlign: "right" }}>Capital out</span>
          <span style={{ textAlign: "right" }}>Buckets</span>
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: "24px 14px", color: "var(--text-3)", fontSize: 12.5, textAlign: "center" }}>
            No years on record yet.
          </div>
        ) : (
          sorted.map((row, i) => {
            const net = Number(row.netUsd);
            const isCurrent = row.year === currentYear;
            return (
              <Link
                key={row.year}
                href={`?company=${companyTab}&year=${row.year}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr 1fr 1fr 1fr 90px",
                  padding: "12px 14px",
                  borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                  fontSize: 12.5,
                  alignItems: "center",
                  textDecoration: "none",
                  color: "var(--text-1)",
                  background: isCurrent ? "var(--surface-2)" : "transparent",
                }}
              >
                <span className="mono" style={{ fontWeight: isCurrent ? 500 : 400 }}>{row.year}</span>
                <span className="mono num money-in"   style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatUsdShort(row.settlementsUsd)}</span>
                <span className="mono num money-out"  style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatUsdShort(row.expensesUsd)}</span>
                <span
                  className={`mono num ${net >= 0 ? "money-in" : "capital-out"}`}
                  style={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
                >
                  {formatUsdShort(row.netUsd)}
                </span>
                <span className="mono num capital-in"  style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatUsdShort(row.capitalInUsd)}</span>
                <span className="mono num capital-out" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatUsdShort(row.capitalOutUsd)}</span>
                <span className="mono num" style={{ textAlign: "right", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                  {row.buckets.toLocaleString()}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </Section>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
        <h2 style={{ font: "500 14px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0, color: "var(--text-1)" }}>
          {title}
        </h2>
        {hint && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: it.color, borderRadius: 2 }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Insight({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--line-soft)", borderRadius: 8, background: "var(--bg-1)" }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>
        {label}
      </div>
      <div className={`mono ${color ?? ""}`} style={{ fontSize: 13.5, fontWeight: 500 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5, border: "1px dashed var(--line-soft)", borderRadius: 10 }}>
      {text}
    </div>
  );
}
