// /selling — single pillar covering everything related to selling fruit OUT of
// Ecuador (into the US, or internationally). Replaces the four placeholder
// pillars Catalog / Buyers / Pricing / Shipments. Stub for now; content gets
// built in a follow-on session. Future shape (per the steady-the-engine plan):
//
//   • Catalog       — products + grades + pack specs
//   • Buyers        — buyer CRM (intl + US distributors)
//   • Pricing       — cost models, FOB / CIF / DDP, target margins
//   • Shipments     — containers in transit + delivered
//
// All four sections will live as sub-tabs on this page once they have real
// data behind them. For now the page is a sketch so the pillar exists in the
// nav and the route resolves.

import { Topbar } from "@/components/design/topbar";

const SECTIONS = [
  { id: "catalog", label: "Catalog", note: "products, grades, pack specs" },
  { id: "buyers", label: "Buyers", note: "intl + US distributors" },
  { id: "pricing", label: "Pricing", note: "cost models, FOB / CIF / DDP, target margins" },
  { id: "shipments", label: "Shipments", note: "containers in transit + delivered" },
];

export default function SellingPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar crumbs={["Selling"]} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Selling
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Outbound: Ecuador → US, EU, and beyond.
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24 }}>
            Pillar scaffolding. Each section below becomes a sub-tab when the data behind it lands.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {SECTIONS.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "16px 18px",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 10,
                  background: "var(--bg-1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{s.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{s.note}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
