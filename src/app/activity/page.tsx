// /activity — global audit feed. Newest first. Reads from activity_events.
//
// Each mutating server action drops a row here (best-effort; logger never
// throws). Use this surface to answer "what changed in the engine in the
// last 24h" or "who touched this row".

import { Topbar } from "@/components/design/topbar";
import { getRecentActivity } from "@/lib/queries/activity";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  create:   "var(--green)",
  update:   "var(--sky)",
  delete:   "var(--rose)",
  complete: "var(--green)",
  reopen:   "var(--amber)",
  pin_drive_file:   "var(--text-2)",
  unpin_drive_file: "var(--text-3)",
};

const KIND_LABELS: Record<string, string> = {
  task:            "Task",
  farm_harvest:    "Farm harvest",
  harvest:         "Harvest",
  harvest_payment: "Payment",
  expense:         "Expense",
  cash_movement:   "Wire",
  compliance:      "Compliance",
  buyer:           "Buyer",
  drive_pin:       "Drive pin",
};

function ago(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function ActivityPage() {
  const events = await getRecentActivity({ limit: 200 });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Activity"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {events.length} recent
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Activity
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Who did what, newest first.
            </span>
          </div>

          {events.length === 0 ? (
            <div
              style={{
                padding: "48px 18px",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
                border: "1px dashed var(--line-soft)",
                borderRadius: 10,
              }}
            >
              No activity recorded yet.
            </div>
          ) : (
            <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
              {events.map((e, i) => {
                const color = ACTION_COLORS[e.action] ?? "var(--text-2)";
                const kindLabel = KIND_LABELS[e.entityKind] ?? e.entityKind;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "84px 90px 110px 1fr 80px",
                      gap: 12,
                      padding: "10px 14px",
                      alignItems: "center",
                      borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                      fontSize: 12.5,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                      {ago(e.happenedAt)}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: `oklch(from ${color} l c h / 0.12)`,
                        textAlign: "center",
                      }}
                    >
                      {e.action}
                    </span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                      {kindLabel}
                    </span>
                    <span style={{ color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.summary}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
                      {e.actorName ?? "system"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
