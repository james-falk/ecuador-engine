import Link from "next/link";
import { todos, pending, ops } from "@/lib/data";
import { getAllCompliance } from "@/lib/queries/compliance";
import { Globe } from "@/components/design/globe";
import { Icon } from "@/components/design/icons";

export default async function HomePage() {
  // Compliance is DB-backed; todos/pending/ops still mock until those pillars wire in.
  const compliance = await getAllCompliance();
  const today = todos.filter((t) => !t.done).slice(0, 6);
  const verifiedCount = compliance.filter((c) => c.status === "verified").length;

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: -180,
          transform: "translateY(-50%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Globe size={780} opacity={0.42} tilt={-0.3} />
      </div>

      <div style={{ width: "100%", maxWidth: 760, padding: "64px 32px 48px", position: "relative", zIndex: 1 }}>
        <div className="label" style={{ marginBottom: 14 }}>{currentDateStamp()}</div>
        <h1 style={{ font: "500 36px/1.1 var(--font-display)", letterSpacing: "-0.025em", margin: 0, color: "var(--text-0)" }}>
          <span style={{ color: "var(--text-2)" }}>Today,</span> {today.length} things on your plate.
        </h1>
        <div style={{ marginTop: 10, color: "var(--text-3)", fontSize: 13 }}>
          T-{ops.daysUntilFirstShipment} to target ship date.
        </div>

        <div style={{ marginTop: 36 }}>
          {today.length === 0 ? (
            <div style={{ padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>Nothing on the list.</div>
          ) : (
            today.map((b, i) => (
              <Link
                key={b.id}
                href="/todos"
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  alignItems: "center",
                  gap: 16,
                  width: "100%",
                  padding: "18px 0",
                  background: "transparent",
                  border: 0,
                  borderTop: "1px solid var(--line-soft)",
                  borderBottom: i === today.length - 1 ? "1px solid var(--line-soft)" : 0,
                  cursor: "pointer",
                  color: "var(--text-0)",
                  textAlign: "left",
                  textDecoration: "none",
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>{b.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 9.5 }}>{b.area}</span>
                    <span style={{ marginLeft: 10 }}>{b.owner}</span>
                  </span>
                </span>
                <Icon name="chev" size={12} color="var(--text-3)" />
              </Link>
            ))
          )}
        </div>

        {pending.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <div className="label" style={{ marginBottom: 14, color: "var(--text-3)" }}>
              Pending by design · {pending.length}
            </div>
            {pending.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--line-soft)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 12.5, color: "var(--text-1)" }}>{p.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right", flex: 1, fontStyle: "italic" }}>
                  {p.why}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 64,
            paddingTop: 18,
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>GYE → MIA · ~5d at sea · 40′ FCL ≈ 960 cartons</span>
          <span>
            {verifiedCount}/{compliance.length} verified
          </span>
        </div>
      </div>
    </div>
  );
}

function currentDateStamp(): string {
  return "THU · OCT 30 · 2025";
}
