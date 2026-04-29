import { Topbar } from "./topbar";
import { PitayaGlyph } from "./icons";

export function PlaceholderPage({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Topbar crumbs={[label]} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
          gap: 8,
        }}
      >
        <PitayaGlyph size={36} />
        <div style={{ fontSize: 14, color: "var(--text-1)", marginTop: 8 }}>{label} module · stub</div>
        <div style={{ fontSize: 12 }}>Designed in Home + Compliance for now.</div>
      </div>
    </div>
  );
}
