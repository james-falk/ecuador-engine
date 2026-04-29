"use client";

import { compliance, findEntity, findNetworkItem } from "@/lib/data";
import { Icon, EntityChip, StatusPill } from "./icons";

export function EntityDetail({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const mine = findEntity(entityId);
  const networkHit = mine ? null : findNetworkItem(entityId);
  const e = mine ?? networkHit;
  if (!e) return null;
  const isMine = !!mine;
  const related = compliance.filter((c) => c.owner === entityId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isMine && mine ? (
            <EntityChip entity={mine} />
          ) : (
            <span style={{ width: 20, height: 20, borderRadius: 6, background: "var(--bg-3)", border: "1px solid var(--line-soft)" }} />
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{e.name}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
              {isMine && mine
                ? `${mine.kind} · ${mine.country} · ${mine.role}`
                : `${networkHit?._group ?? "Network"} · ${e.country}`}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn--ghost"><Icon name="x" size={11} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        {isMine && mine && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Identifiers</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(mine.ids).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr",
                    padding: "8px 12px",
                    background: "var(--bg-3)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 8,
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <span
                    className="mono"
                    style={{ color: "var(--text-2)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    {k}
                  </span>
                  <span className="mono" style={{ color: v === "pending" ? "var(--amber)" : "var(--green)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isMine && networkHit && (
          <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.55 }}>{networkHit.note}</div>
        )}

        {related.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Compliance for {e.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {related.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "8px 12px",
                    background: "var(--bg-3)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 8,
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  <StatusPill status={it.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
