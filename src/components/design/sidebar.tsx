"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { weather, type Entity, type WeatherCond } from "@/lib/data";
import { PitayaGlyph, Icon, EntityChip, type IconName } from "./icons";

type Pillar = { id: string; label: string; icon: IconName; href: string };

const PILLARS: Pillar[] = [
  { id: "home",      label: "Home",      icon: "home",   href: "/" },
  { id: "todos",     label: "TODOs",     icon: "check",  href: "/todos" },
  { id: "network",   label: "Network",   icon: "globe",  href: "/network" },
  { id: "catalog",   label: "Catalog",   icon: "box",    href: "/catalog" },
  { id: "harvests",  label: "Harvests",  icon: "leaf",   href: "/harvests" },
  { id: "expenses",  label: "Expenses",  icon: "coin",   href: "/expenses" },
  { id: "pricing",   label: "Pricing",   icon: "tag",    href: "/pricing" },
  { id: "buyers",    label: "Buyers",    icon: "people", href: "/buyers" },
  { id: "shipments", label: "Shipments", icon: "ship",   href: "/shipments" },
];

export function Sidebar({ dense = false, entities }: { dense?: boolean; entities: Entity[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [companiesOpen, setCompaniesOpen] = React.useState(true);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const activeCompanySlug = pathname.startsWith("/companies/") ? pathname.split("/")[2] : null;

  return (
    <aside
      style={{
        width: dense ? 240 : 256,
        flex: "none",
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line-soft)",
        display: "flex",
        flexDirection: "column",
        padding: "14px 10px 10px",
        gap: 14,
        overflow: "hidden",
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 0" }}>
        <PitayaGlyph size={22} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-0.01em" }}>Ecuador Engine</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>v0.5 · internal</span>
        </div>
      </div>

      <div style={{ padding: "0 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 30,
            padding: "0 10px",
            background: "var(--bg-0)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            color: "var(--text-3)",
            fontSize: 12,
          }}
        >
          <Icon name="search" size={12} />
          <span style={{ flex: 1 }}>Jump to…</span>
          <span className="mono" style={{ fontSize: 10, padding: "1px 5px", background: "var(--bg-2)", borderRadius: 4 }}>⌘K</span>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {PILLARS.slice(0, 2).map((p) => (
            <NavRow key={p.id} active={isActive(p.href)} icon={p.icon} label={p.label} onClick={() => router.push(p.href)} />
          ))}

          <button
            onClick={() => setCompaniesOpen((v) => !v)}
            style={{
              display: "grid",
              gridTemplateColumns: "14px 1fr 12px",
              alignItems: "center",
              gap: 10,
              padding: "6px 12px",
              borderRadius: 6,
              border: 0,
              background: "transparent",
              color: "var(--text-1)",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 12.5,
              fontWeight: 400,
            }}
          >
            <Icon name="box" size={13} color="var(--text-2)" />
            <span>Companies</span>
            <span style={{ transform: companiesOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 160ms", display: "inline-flex" }}>
              <Icon name="chev" size={10} color="var(--text-3)" />
            </span>
          </button>
          {companiesOpen && (
            <div style={{ display: "flex", flexDirection: "column", paddingLeft: 22, gap: 1, marginBottom: 4 }}>
              {entities.map((e) => {
                const isCurrent = activeCompanySlug === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/companies/${e.id}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "20px 1fr auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: 0,
                      background: isCurrent ? "var(--bg-3)" : "transparent",
                      color: isCurrent ? "var(--text-0)" : "var(--text-1)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 12,
                    }}
                  >
                    <EntityChip entity={e} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--text-3)" }}>{e.country}</span>
                  </button>
                );
              })}
            </div>
          )}

          {PILLARS.slice(2).map((p) => (
            <NavRow key={p.id} active={isActive(p.href)} icon={p.icon} label={p.label} onClick={() => router.push(p.href)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <WeatherPanel />
    </aside>
  );
}

function NavRow({ active, icon, label, onClick }: { active: boolean; icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "14px 1fr",
        alignItems: "center",
        gap: 10,
        padding: "6px 12px",
        borderRadius: 6,
        border: 0,
        background: active ? "var(--bg-3)" : "transparent",
        color: active ? "var(--text-0)" : "var(--text-1)",
        cursor: "pointer",
        textAlign: "left",
        fontSize: 12.5,
        fontWeight: active ? 500 : 400,
        position: "relative",
      }}
    >
      {active && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, background: "var(--green)", borderRadius: 2 }} />}
      <Icon name={icon} size={13} color={active ? "var(--green)" : "var(--text-2)"} />
      <span>{label}</span>
    </button>
  );
}

function WeatherPanel() {
  return (
    <div style={{ padding: "10px 10px 6px", borderTop: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", gap: 2 }}>
      {weather.map((w) => (
        <div
          key={w.city}
          style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 8, alignItems: "center", padding: "6px 4px" }}
        >
          <WeatherGlyph cond={w.cond} />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
            <span style={{ fontSize: 11.5, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.city}</span>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--text-3)" }}>{w.region}</span>
          </span>
          <span className="mono num" style={{ fontSize: 12, color: "var(--text-0)", fontWeight: 500 }}>{w.tempF}°</span>
        </div>
      ))}
    </div>
  );
}

function WeatherGlyph({ cond }: { cond: WeatherCond }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (cond === "sun") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "var(--amber)" }}>
        <circle cx="8" cy="8" r="3" {...stroke} />
        <path d="M8 1 V3 M8 13 V15 M1 8 H3 M13 8 H15 M3 3 L4.5 4.5 M11.5 11.5 L13 13 M13 3 L11.5 4.5 M3 13 L4.5 11.5" {...stroke} />
      </svg>
    );
  }
  if (cond === "cloud") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "var(--text-2)" }}>
        <path d="M5 11 C3 11 2 9.5 2 8 C2 6.5 3.5 5 5 5 C5.5 3.5 7 2.5 8.5 2.5 C10.5 2.5 12 4 12 6 C13.5 6 14.5 7 14.5 8.5 C14.5 10 13.5 11 12 11 Z" {...stroke} />
      </svg>
    );
  }
  if (cond === "humid") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ color: "var(--sky)" }}>
        <path d="M5 9 C3 9 2 7.5 2 6 C2 4.5 3.5 3 5 3 C5.5 1.5 7 0.5 8.5 0.5 C10.5 0.5 12 2 12 4 C13.5 4 14.5 5 14.5 6.5 C14.5 8 13.5 9 12 9 Z" {...stroke} />
        <path d="M5 12 L4 14 M8 12 L7 14 M11 12 L10 14" {...stroke} />
      </svg>
    );
  }
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--text-3)" }} />;
}
