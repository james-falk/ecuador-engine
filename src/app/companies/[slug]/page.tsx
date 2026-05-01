// /companies/[slug] — entity hub with sub-tabs:
//   • Overview   — ytd snapshot of money in/out + harvest activity
//   • Compliance — bucket grouping (was the entire page; now a tab)
//   • Activity   — chronological feed of cross-pillar interactions
//   • Documents  — Drive-linked files (placeholder until Slice 8)
//
// Sub-tab persists in URL (?sub=overview|compliance|activity|documents).

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComplianceItem } from "@/lib/data";
import { getEntityBySlug, getComplianceForEntity } from "@/lib/queries/compliance";
import { getCompanyActivity, getCompanyDocuments, getCompanyOverview } from "@/lib/queries/companies";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { companies as companiesTable } from "@/db/schema";
import { Topbar } from "@/components/design/topbar";
import { CompanyMark } from "@/components/design/icons";
import { ComplianceRow } from "@/components/design/compliance-row";
import { formatUsd } from "@/lib/money";

type SubTab = "overview" | "compliance" | "activity" | "documents";
const VALID_SUBS: SubTab[] = ["overview", "compliance", "activity", "documents"];

type BucketDef = { id: ComplianceItem["bucket"]; label: string; desc: string };
const BUCKETS: BucketDef[] = [
  { id: "importing", label: "Importing", desc: "US-side registrations, FSVP, Prior Notice" },
  { id: "exporting", label: "Exporting", desc: "Ecuadorian-side registrations, phyto, customs" },
  { id: "shipment",  label: "Shipment",  desc: "Per-container logistics, labels, cold chain" },
];

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sub?: string; year?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sub: SubTab = VALID_SUBS.includes(sp.sub as SubTab) ? (sp.sub as SubTab) : "overview";
  const requestedYear = sp.year;
  const year = (() => {
    if (requestedYear === "all") return null;
    const y = requestedYear ? parseInt(requestedYear, 10) : new Date().getFullYear();
    return Number.isFinite(y) ? y : new Date().getFullYear();
  })();
  const filters = year !== null ? { from: `${year}-01-01`, to: `${year}-12-31` } : {};

  const entity = await getEntityBySlug(slug);
  if (!entity) notFound();

  // Resolve UUID for cross-pillar queries (entity.id is the slug).
  const [companyRow] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.slug, slug))
    .limit(1);
  const companyId = companyRow?.id ?? null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar crumbs={["Companies", entity.name]} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 980, margin: "0 auto" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
            <CompanyMark entity={entity} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <h1 style={{ font: "500 26px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>{entity.name}</h1>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, letterSpacing: "0.04em" }}>
                {entity.kind} · {entity.country} · {entity.role}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18, marginBottom: 24 }}>
            {Object.entries(entity.ids).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  padding: "5px 9px",
                  borderRadius: 6,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-soft)",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  {k}
                </span>
                <span className="mono" style={{ fontSize: 11, color: v === "pending" ? "var(--amber)" : "var(--text-0)" }}>
                  {v}
                </span>
              </div>
            ))}
          </div>

          <SubTabs slug={slug} active={sub} year={requestedYear} />

          {sub === "overview" && companyId && (
            <OverviewTab companyId={companyId} entityName={entity.name} filters={filters} />
          )}
          {sub === "compliance" && <ComplianceTab slug={slug} entityName={entity.name} />}
          {sub === "activity" && companyId && (
            <ActivityTab companyId={companyId} filters={filters} />
          )}
          {sub === "documents" && companyId && <DocumentsTab companyId={companyId} />}
          {(sub === "overview" || sub === "activity") && !companyId && (
            <div style={{ padding: 32, color: "var(--text-3)", fontSize: 12 }}>
              Cross-pillar lookup unavailable for this entity (no UUID found).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubTabs({ slug, active, year }: { slug: string; active: SubTab; year?: string }) {
  const yp = year ? `&year=${year}` : "";
  const items: Array<{ id: SubTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "compliance", label: "Compliance" },
    { id: "activity", label: "Activity" },
    { id: "documents", label: "Documents" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 8,
        background: "var(--bg-2)",
        border: "1px solid var(--line-soft)",
        alignSelf: "flex-start",
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      {items.map((o) => (
        <Link
          key={o.id}
          href={`/companies/${slug}?sub=${o.id}${yp}`}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            background: active === o.id ? "var(--bg-4)" : "transparent",
            color: active === o.id ? "var(--text-0)" : "var(--text-2)",
            fontSize: 11.5,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

async function OverviewTab({
  companyId,
  entityName,
  filters,
}: {
  companyId: string;
  entityName: string;
  filters: { from?: string; to?: string };
}) {
  const [overview, items] = await Promise.all([
    getCompanyOverview(companyId, filters),
    getComplianceForEntity(/* slug not directly used here; recomputed below */ ""),
  ]);
  // We have entity.name only; compliance items need slug — fetch from row above. Done in ComplianceTab too. Keep minimal here.
  void items;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Tile
          label="Expenses paid to"
          primary={overview.expenseCount === 0 ? "—" : formatUsd(overview.expenseTotalUsd)}
          hint={`${overview.expenseCount} entries`}
          tone="money-out"
        />
        <Tile
          label="Harvest deliveries"
          primary={overview.harvestCount === 0 ? "—" : String(overview.harvestCount)}
          hint={`${overview.settlementsCount} settled · ${formatUsd(overview.settlementsTotalUsd)}`}
          tone="money-in"
        />
        <Tile
          label="US → EC wires"
          primary={overview.capitalInCount === 0 ? "—" : formatUsd(overview.capitalInTotalUsd)}
          hint={`${overview.capitalInCount} wires`}
          tone="capital-in"
        />
        <Tile
          label="EC → US wires"
          primary={overview.capitalOutCount === 0 ? "—" : formatUsd(overview.capitalOutTotalUsd)}
          hint={`${overview.capitalOutCount} wires`}
          tone="capital-out"
        />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
        Year-bounded snapshot for {entityName}. Counterparty match on cash movements is loose-text — accuracy improves once we add a hard FK on the wires table.
      </div>
    </div>
  );
}

function Tile({
  label,
  primary,
  hint,
  tone,
}: {
  label: string;
  primary: string;
  hint: string;
  tone: "money-in" | "money-out" | "capital-in" | "capital-out";
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        background: "var(--bg-1)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span className="label" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className={`mono num ${tone}`} style={{ fontSize: 18, fontWeight: 500 }}>{primary}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</span>
    </div>
  );
}

async function ComplianceTab({ slug, entityName }: { slug: string; entityName: string }) {
  const items = await getComplianceForEntity(slug);
  const counts = (b: ComplianceItem["bucket"]) => {
    const all = items.filter((i) => i.bucket === b);
    return {
      total: all.length,
      verified: all.filter((i) => i.status === "verified").length,
      todo: all.filter((i) => i.status === "todo").length,
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {BUCKETS.map((b) => {
        const c = counts(b.id);
        const list = items.filter((i) => i.bucket === b.id);
        return (
          <div key={b.id}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{b.label}</h2>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>{b.desc}</div>
              </div>
              <div style={{ display: "flex", gap: 12, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                <CountChip n={c.verified} color="var(--green)" label="ok" />
                <CountChip n={c.todo} color="var(--text-2)" label="to do" />
              </div>
            </div>
            {list.length === 0 ? (
              <div
                style={{
                  padding: "14px 16px",
                  border: "1px dashed var(--line-soft)",
                  borderRadius: 8,
                  color: "var(--text-3)",
                  fontSize: 12,
                }}
              >
                Nothing tracked under {b.label.toLowerCase()} for {entityName}.
              </div>
            ) : (
              <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
                {list.map((it, i) => (
                  <ComplianceRow key={it.id} item={it} isFirst={i === 0} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function ActivityTab({
  companyId,
  filters,
}: {
  companyId: string;
  filters: { from?: string; to?: string };
}) {
  const items = await getCompanyActivity(companyId, filters);
  if (items.length === 0) {
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
        No activity recorded for the selected window.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => {
        const tone =
          it.kind === "expense"
            ? "money-out"
            : it.kind === "harvest"
            ? "money-in"
            : "capital-in";
        return (
          <div
            key={`${it.kind}-${it.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr auto",
              gap: 12,
              padding: "12px 14px",
              alignItems: "center",
              borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
              fontSize: 12.5,
            }}
          >
            <span className="mono" style={{ color: "var(--text-2)" }}>{it.date}</span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ color: "var(--text-1)" }}>{it.primary}</span>
              {it.secondary && (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  {it.secondary}
                </span>
              )}
            </span>
            <span className={`mono num ${tone}`} style={{ fontWeight: 500 }}>
              {it.amountUsd ? formatUsd(it.amountUsd) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

async function DocumentsTab({ companyId }: { companyId: string }) {
  const docs = await getCompanyDocuments(companyId);
  if (docs.length === 0) {
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
        No Drive files linked to this entity yet. Pick PDFs from the Drive
        picker on the Harvests / Compliance surfaces and they will show up here.
      </div>
    );
  }
  const sourceLabel: Record<string, string> = {
    harvest_settlement: "Liquidación",
    harvest_evidence: "Delivery evidence",
    compliance: "Compliance",
  };
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
      {docs.map((d, i) => (
        <a
          key={`${d.source}-${d.id}`}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "grid",
            gridTemplateColumns: "100px 110px 1fr auto",
            gap: 12,
            padding: "12px 14px",
            alignItems: "center",
            borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
            textDecoration: "none",
            color: "var(--text-1)",
            fontSize: 12.5,
          }}
        >
          <span className="mono" style={{ color: "var(--text-2)" }}>{d.date}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {sourceLabel[d.source]}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--green)" }}>Open ↗</span>
        </a>
      ))}
    </div>
  );
}

function CountChip({ n, color, label }: { n: number; color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      <span style={{ color: "var(--text-1)" }}>{n}</span>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
    </span>
  );
}
