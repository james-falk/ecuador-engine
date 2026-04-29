"use client";

import * as React from "react";
import { Globe } from "./globe";

const CORRIDOR_POINTS = [
  { id: "san-clemente", label: "San Clemente, EC", sub: "Finca del Dragón", lat: -0.83, color: "green" as const },
  { id: "miami",        label: "Miami, FL",        sub: "Port of entry",    lat: 25.76, color: "amber" as const },
  { id: "garden-city",  label: "Garden City, MI",  sub: "PureSol HQ",       lat: 42.32, color: "green" as const },
];

export function NetworkGlobeStage() {
  const [size, setSize] = React.useState(560);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const s = Math.max(360, Math.min(640, r.width - 380));
      setSize(s);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="ee-network-stage"
      style={{
        position: "relative",
        borderBottom: "1px solid var(--line-soft)",
        background: "var(--bg-0)",
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 0,
        minHeight: 540,
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(var(--line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--line-soft) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.3,
            pointerEvents: "none",
          }}
        />
        <Globe size={size} opacity={0.95} interactive autoRotate />
        <div
          className="mono"
          style={{
            position: "absolute",
            bottom: 14,
            left: 22,
            fontSize: 10.5,
            color: "var(--text-3)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          3 nodes · 1 active corridor
        </div>
      </div>

      <aside
        style={{
          padding: "28px 24px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          borderLeft: "1px solid var(--line-soft)",
          background: "var(--bg-1)",
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Corridor
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em" }}>Manabí → Miami → Michigan</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
            One container leaves Guayaquil every 14 days. Cleared at PortMiami, trucked to Garden City for redistribution.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="mono"
            style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Nodes
          </div>
          {CORRIDOR_POINTS.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--line-soft)",
                background: "var(--bg-0)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: p.color === "amber" ? "var(--amber)" : "var(--green)",
                  boxShadow:
                    "0 0 0 3px " +
                    (p.color === "amber" ? "oklch(0.82 0.15 78 / 0.18)" : "oklch(0.74 0.16 145 / 0.18)"),
                }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.sub}</span>
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {Math.abs(p.lat).toFixed(2)}°{p.lat >= 0 ? "N" : "S"}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px dashed var(--line-soft)",
            color: "var(--text-3)",
            fontSize: 11.5,
            lineHeight: 1.55,
          }}
        >
          <div
            className="mono"
            style={{
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontSize: 10,
              marginBottom: 4,
            }}
          >
            Tip
          </div>
          Drag horizontally to spin the globe; vertically to tilt. Release and it resumes a slow drift.
        </div>
      </aside>
    </div>
  );
}
