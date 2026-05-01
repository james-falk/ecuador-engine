// /companies (no slug) — index of every company in the engine, grouped by
// kind. Each row links to /companies/[slug] for the entity hub.
//
// Companies without slugs (carriers, buyers, etc. imported as references)
// render unlinked — they exist as audit references but don't have entity hubs.

import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { companies, type Company } from "@/db/schema";
import { Topbar } from "@/components/design/topbar";

export const dynamic = "force-dynamic";

const KIND_GROUPS: Array<{ id: Company["kind"]; label: string; hint: string }> = [
  { id: "holding",          label: "Holding",          hint: "Parent entities" },
  { id: "producer",         label: "Producers",        hint: "Farms / growers" },
  { id: "importer",         label: "Importers",        hint: "US side of record" },
  { id: "packing_facility", label: "Packing facilities", hint: "Third-party processors" },
  { id: "carrier",          label: "Carriers",         hint: "Freight" },
  { id: "freight_forwarder", label: "Freight forwarders", hint: "Origin coordination" },
  { id: "customs_broker",   label: "Customs brokers",  hint: "" },
  { id: "buyer",            label: "Buyers",           hint: "Distributors / end customers" },
  { id: "consultant",       label: "Consultants",      hint: "" },
  { id: "lawyer",           label: "Lawyers",          hint: "" },
  { id: "other",            label: "Other",            hint: "" },
];

export default async function CompaniesIndexPage() {
  const rows = await db.select().from(companies).orderBy(asc(companies.name));

  const byKind = new Map<Company["kind"], Company[]>();
  for (const r of rows) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind)!.push(r);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Companies"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {rows.length} total
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Companies
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Every entity the engine knows about. Click into one for its hub.
            </span>
          </div>

          {KIND_GROUPS.map((g) => {
            const list = byKind.get(g.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={g.id} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                  <h2 style={{ font: "500 14px/1.2 var(--font-display)", margin: 0, color: "var(--text-1)" }}>
                    {g.label}
                  </h2>
                  {g.hint && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{g.hint}</span>}
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginLeft: "auto" }}>
                    {list.length}
                  </span>
                </div>
                <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
                  {list.map((c, i) => {
                    const inner = (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: 14,
                          padding: "12px 14px",
                          alignItems: "center",
                          borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                          fontSize: 12.5,
                          textDecoration: "none",
                          color: "var(--text-1)",
                        }}
                      >
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ color: "var(--text-1)" }}>{c.name}</span>
                          {c.legalName && c.legalName !== c.name && (
                            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                              {c.legalName}
                            </span>
                          )}
                        </span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                          {c.country ?? "—"}
                        </span>
                        <VettingChip status={c.vettingStatus} />
                      </div>
                    );
                    return c.slug ? (
                      <Link key={c.id} href={`/companies/${c.slug}`} style={{ textDecoration: "none" }}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={c.id}>{inner}</div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {rows.length === 0 && (
            <div
              style={{
                padding: "48px 18px",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 12.5,
                border: "1px dashed var(--line-soft)",
                borderRadius: 10,
              }}
            >
              No companies on file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VettingChip({ status }: { status: Company["vettingStatus"] }) {
  const map = {
    vetted:       { label: "vetted",       color: "var(--green)" },
    unvetted:     { label: "unvetted",     color: "var(--text-3)" },
    disqualified: { label: "disqualified", color: "var(--rose)" },
    dead:         { label: "dead",         color: "var(--text-3)" },
  } as const;
  const m = map[status];
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
      }}
    >
      {m.label}
    </span>
  );
}
