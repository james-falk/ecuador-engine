import { notFound } from "next/navigation";
import type { ComplianceItem } from "@/lib/data";
import { getEntityBySlug, getComplianceForEntity } from "@/lib/queries/compliance";
import { Topbar } from "@/components/design/topbar";
import { CompanyMark } from "@/components/design/icons";
import { ComplianceRow } from "@/components/design/compliance-row";

type BucketDef = { id: ComplianceItem["bucket"]; label: string; desc: string };

const BUCKETS: BucketDef[] = [
  { id: "importing", label: "Importing", desc: "US-side registrations, FSVP, Prior Notice" },
  { id: "exporting", label: "Exporting", desc: "Ecuadorian-side registrations, phyto, customs" },
  { id: "shipment",  label: "Shipment",  desc: "Per-container logistics, labels, cold chain" },
];

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [entity, items] = await Promise.all([
    getEntityBySlug(slug),
    getComplianceForEntity(slug),
  ]);

  if (!entity) notFound();

  const counts = (b: ComplianceItem["bucket"]) => {
    const all = items.filter((i) => i.bucket === b);
    return {
      total: all.length,
      verified: all.filter((i) => i.status === "verified").length,
      todo: all.filter((i) => i.status === "todo").length,
    };
  };

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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18, marginBottom: 28 }}>
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
                      Nothing tracked under {b.label.toLowerCase()} for {entity.name}.
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

          <div
            style={{
              marginTop: 40,
              paddingTop: 16,
              borderTop: "1px solid var(--line-soft)",
              fontSize: 11,
              color: "var(--text-3)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{items.length} compliance items tracked for {entity.name}.</span>
            <span className="mono">{entity.country} · {entity.kind}</span>
          </div>
        </div>
      </div>
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
