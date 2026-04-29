"use client";

import { network } from "@/lib/data";
import { Topbar } from "@/components/design/topbar";
import { NetworkGlobeStage } from "@/components/design/network-globe-stage";
import { useDrawer } from "@/components/design/drawer";

export default function NetworkPage() {
  const { openEntity } = useDrawer();
  const totalParties = network.reduce((a, g) => a + g.items.length, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Network"]}
        right={
          <span
            className="mono"
            style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            Drag the globe to rotate
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <NetworkGlobeStage />

        <div style={{ padding: "24px 32px 48px", maxWidth: 1100, margin: "0 auto" }}>
          <div className="label" style={{ marginBottom: 14 }}>The wider network · {totalParties} parties</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {network.map((g) => (
              <div key={g.group}>
                <div className="label" style={{ marginBottom: 10 }}>
                  {g.group} · {g.items.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => openEntity(it.id)}
                      className="card"
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        cursor: "pointer",
                        background: "var(--bg-2)",
                        color: "var(--text-0)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        border: "1px solid var(--line-soft)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{it.country}</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{it.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
