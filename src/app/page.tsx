// /home — command-center landing for daily fruit ops.

import Link from "next/link";
import { Globe } from "@/components/design/globe";
import { Icon, type IconName } from "@/components/design/icons";
import { BlockyCrew } from "@/components/design/blocky-crew";

const LINKS: Array<{ href: string; label: string; hint: string; icon: IconName }> = [
  { href: "/pending", label: "Pending", hint: "the one thing to clear next", icon: "check" },
  { href: "/globe", label: "Globe", hint: "search a city and draw a route", icon: "globe" },
  { href: "/expenses", label: "Expenses", hint: "weekly payments out", icon: "coin" },
  { href: "/harvests", label: "Harvests", hint: "field → processor → payment", icon: "leaf" },
  { href: "/selling", label: "Pricing", hint: "buyer-ready selling math", icon: "tag" },
];

const ROUTES = [
  { label: "GYE → MIA", sub: "export lane", tone: "var(--green)" },
  { label: "MIA → DTW", sub: "redistribution", tone: "var(--amber)" },
  { label: "EC → US", sub: "live ops", tone: "var(--sky)" },
];

export default async function HomePage() {
  return (
    <div style={{ flex: 1, overflow: "auto", position: "relative", background: "var(--bg-0)" }}>
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -220,
          width: 820,
          height: 820,
          borderRadius: 999,
          background: "radial-gradient(circle, oklch(0.74 0.16 145 / 0.16), transparent 62%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "56px 34px 46px",
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(360px, 0.9fr) minmax(420px, 1.1fr)",
          gap: 32,
          alignItems: "center",
        }}
      >
        <section>
          <div className="label" style={{ marginBottom: 14 }}>{currentDateStamp()}</div>
          <h1 style={{ font: "600 48px/0.98 var(--font-display)", letterSpacing: "-0.045em", margin: 0, color: "var(--text-0)" }}>
            Ecuador Engine
          </h1>
          <p style={{ maxWidth: 520, margin: "16px 0 0", color: "var(--text-1)", fontSize: 16, lineHeight: 1.55 }}>
            One quiet place for Finca del Dragón and PureSol Imports: shipments, harvests, expenses, pricing, and the people keeping it moving.
          </p>

          <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {ROUTES.map((r) => (
              <div key={r.label} style={{ padding: "12px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "var(--bg-2)", boxShadow: "var(--shadow-card)" }}>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: r.tone }}>{r.label}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
            {LINKS.map((b) => (
              <Link
                key={b.href}
                href={b.href}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 14,
                  background: "var(--bg-2)",
                  color: "var(--text-0)",
                  textDecoration: "none",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-3)", color: "var(--green)" }}>
                  <Icon name={b.icon} size={15} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 650 }}>{b.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{b.hint}</span>
                </span>
                <Icon name="chev" size={12} color="var(--text-3)" />
              </Link>
            ))}
          </div>
        </section>

        <section style={{ position: "relative", minHeight: 620, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: "8% 0 auto", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <Globe size={650} opacity={0.76} tilt={-0.3} />
          </div>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 350,
              padding: "18px 22px 16px",
              borderRadius: 24,
              border: "1px solid var(--line-soft)",
              background: "oklch(from var(--bg-2) l c h / 0.82)",
              backdropFilter: "blur(16px)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            <BlockyCrew />
          </div>
        </section>
      </div>
    </div>
  );
}

function currentDateStamp(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const [wd, md, yr] = fmt.format(new Date()).replace(/,/g, "").split(" ").reduce<string[]>((acc, part, i) => {
    if (i === 0) acc[0] = part;
    else if (i === 1 || i === 2) acc[1] = (acc[1] ? acc[1] + " " : "") + part;
    else acc[2] = part;
    return acc;
  }, []);
  return `${wd} · ${md} · ${yr}`.toUpperCase();
}
