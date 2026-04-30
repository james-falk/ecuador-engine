// /globe — interactive corridor globe + real entity list. Previously rendered
// mock vendor/carrier cards from `network[]` in src/lib/data.ts; those are
// gone. The list below the globe stage will be filled with DB-backed entities
// (companies grouped by role) when the Companies hub enrichment slice lands.
// For now: just the globe + the corridor sidebar, both real.

import { Topbar } from "@/components/design/topbar";
import { NetworkGlobeStage } from "@/components/design/network-globe-stage";

export default function GlobePage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Globe"]}
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
      </div>
    </div>
  );
}
