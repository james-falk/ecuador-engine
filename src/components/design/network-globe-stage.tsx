"use client";

import * as React from "react";
import { Globe, type GlobePin } from "./globe";
import { Icon } from "./icons";

type City = GlobePin & { aliases: string[]; country: string };

const CITIES: City[] = [
  { id: "guayaquil", label: "Guayaquil, Ecuador", role: "export port", lat: -2.19, lon: -79.89, color: "green", country: "EC", aliases: ["gye", "guayaquil", "y ecuador", "why ecuador", "ecuador", "guayaquil ecuador"] },
  { id: "san-clemente", label: "San Clemente, Ecuador", role: "farm zone", lat: -0.83, lon: -80.43, color: "green", country: "EC", aliases: ["san clemente", "manabi", "finca", "finca del dragon", "san clemente ecuador"] },
  { id: "quito", label: "Quito, Ecuador", role: "capital", lat: -0.18, lon: -78.47, color: "sky", country: "EC", aliases: ["quito", "uio"] },
  { id: "manta", label: "Manta, Ecuador", role: "coastal port", lat: -0.95, lon: -80.73, color: "green", country: "EC", aliases: ["manta"] },
  { id: "miami", label: "Miami, Florida", role: "port of entry", lat: 25.77, lon: -80.19, color: "amber", country: "US", aliases: ["mia", "miami", "miami florida", "michael"] },
  { id: "garden-city", label: "Garden City, Michigan", role: "PureSol HQ", lat: 42.32, lon: -83.34, color: "green", country: "US", aliases: ["garden city", "garden city mi", "michigan", "detroit", "dtw", "pure sol", "puresol"] },
  { id: "new-york", label: "New York City, New York", role: "market", lat: 40.71, lon: -74.01, color: "sky", country: "US", aliases: ["new york", "nyc", "new york city"] },
  { id: "los-angeles", label: "Los Angeles, California", role: "market", lat: 34.05, lon: -118.24, color: "sky", country: "US", aliases: ["los angeles", "la", "lax"] },
  { id: "houston", label: "Houston, Texas", role: "market", lat: 29.76, lon: -95.37, color: "sky", country: "US", aliases: ["houston", "iah"] },
  { id: "chicago", label: "Chicago, Illinois", role: "market", lat: 41.88, lon: -87.63, color: "sky", country: "US", aliases: ["chicago", "ord"] },
];

const DEFAULT_FROM = CITIES[0];
const DEFAULT_TO = CITIES[4];

export function NetworkGlobeStage() {
  const [size, setSize] = React.useState(560);
  const [fromText, setFromText] = React.useState(DEFAULT_FROM.label);
  const [toText, setToText] = React.useState(DEFAULT_TO.label);
  const [from, setFrom] = React.useState<City>(DEFAULT_FROM);
  const [to, setTo] = React.useState<City>(DEFAULT_TO);
  const [message, setMessage] = React.useState("Showing Guayaquil → Miami. Type a city or airport code.");
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const s = Math.max(360, Math.min(680, r.width - 410));
      setSize(s);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const pins = React.useMemo<GlobePin[]>(() => dedupePins([from, to, DEFAULT_FROM, DEFAULT_TO, CITIES[5]]), [from, to]);
  const arcs = React.useMemo(() => [{ from, to, duration: 5.8, delay: 0 }], [from, to]);
  const miles = Math.round(distanceMiles(from, to));
  const suggestions = CITIES.slice(0, 6);

  function applyRoute(nextFromText = fromText, nextToText = toText) {
    const nextFrom = findCity(nextFromText);
    const nextTo = findCity(nextToText);
    if (!nextFrom || !nextTo) {
      const missing = [!nextFrom ? `from “${nextFromText}”` : null, !nextTo ? `to “${nextToText}”` : null].filter(Boolean).join(" and ");
      setMessage(`I don't know ${missing} yet. Try Guayaquil, Y Ecuador, Miami, Garden City, Quito, Manta, NYC, LA, Houston, or Chicago.`);
      return;
    }
    setFrom(nextFrom);
    setTo(nextTo);
    setFromText(nextFrom.label);
    setToText(nextTo.label);
    setMessage(`Route set: ${nextFrom.label} → ${nextTo.label}.`);
  }

  function swap() {
    const oldFrom = from;
    setFrom(to);
    setTo(oldFrom);
    setFromText(to.label);
    setToText(oldFrom.label);
    setMessage(`Route swapped: ${to.label} → ${oldFrom.label}.`);
  }

  return (
    <div
      ref={containerRef}
      className="ee-network-stage"
      style={{
        position: "relative",
        borderBottom: "1px solid var(--line-soft)",
        background: "var(--bg-0)",
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: 0,
        minHeight: 620,
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(var(--map-grid, var(--line-soft)) 1px, transparent 1px), linear-gradient(90deg, var(--map-grid, var(--line-soft)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.46,
            pointerEvents: "none",
          }}
        />
        <Globe size={size} opacity={0.96} interactive autoRotate pins={pins} arcs={arcs} />
        <div className="mono" style={{ position: "absolute", bottom: 16, left: 22, fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {pins.length} nodes · {miles.toLocaleString()} mi route · drag to rotate
        </div>
      </div>

      <aside
        style={{
          padding: "26px 24px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          borderLeft: "1px solid var(--line-soft)",
          background: "var(--bg-1)",
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Route builder
          </div>
          <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.025em" }}>Connect two cities</div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
            Type a from and to city — for example <b>Y Ecuador</b> or <b>Guayaquil</b> to <b>Miami</b> — and the globe draws the shipping lane.
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyRoute();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <RouteInput label="From" value={fromText} onChange={setFromText} />
          <button type="button" onClick={swap} style={smallButtonStyle} aria-label="Swap route endpoints">
            <Icon name="arrow" size={13} /> Swap
          </button>
          <RouteInput label="To" value={toText} onChange={setToText} />
          <button type="submit" style={{ ...smallButtonStyle, justifyContent: "center", background: "var(--green)", color: "white", borderColor: "var(--green)", fontWeight: 700 }}>
            Draw route
          </button>
        </form>

        <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--line-soft)", background: "var(--bg-2)", boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{from.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{from.role}</div>
            </div>
            <div className="mono" style={{ color: "var(--text-3)", fontSize: 10 }}>{from.country}</div>
          </div>
          <div style={{ height: 28, display: "flex", alignItems: "center", color: "var(--amber)", gap: 8 }}>
            <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
            <Icon name="ship" size={16} />
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{miles.toLocaleString()} mi</span>
            <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{to.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{to.role}</div>
            </div>
            <div className="mono" style={{ color: "var(--text-3)", fontSize: 10 }}>{to.country}</div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>{message}</div>

        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Quick picks
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => {
                  setToText(city.label);
                  applyRoute(from.label, city.label);
                }}
                style={{ ...smallButtonStyle, padding: "7px 9px" }}
              >
                {city.label.split(",")[0]}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function RouteInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} city`}
        style={{
          height: 40,
          borderRadius: 11,
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
          color: "var(--text-0)",
          padding: "0 12px",
          outline: "none",
          font: "inherit",
          boxShadow: "var(--shadow-card)",
        }}
      />
    </label>
  );
}

const smallButtonStyle: React.CSSProperties = {
  minHeight: 32,
  borderRadius: 10,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-2)",
  color: "var(--text-1)",
  padding: "7px 11px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  boxShadow: "var(--shadow-card)",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}

function findCity(value: string): City | null {
  const q = normalize(value);
  if (!q) return null;
  return CITIES.find((city) => normalize(city.label) === q || city.aliases.some((alias) => normalize(alias) === q))
    ?? CITIES.find((city) => normalize(city.label).includes(q) || city.aliases.some((alias) => normalize(alias).includes(q) || q.includes(normalize(alias))))
    ?? null;
}

function dedupePins(items: GlobePin[]): GlobePin[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function distanceMiles(a: GlobePin, b: GlobePin): number {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
