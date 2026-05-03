"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Entity } from "@/lib/data";
import { PitayaGlyph, Icon, EntityChip, type IconName } from "./icons";

type Pillar = { id: string; label: string; icon: IconName; href: string };

// Pillar order: items above Companies render first via slice(0, COMPANIES_INSERT),
// Companies expandable group renders next, items below render last via slice(COMPANIES_INSERT).
// Final shape (top → bottom): Home / Pending Items / Globe / Companies / Selling / Harvests / Expenses / Income.
const COMPANIES_INSERT = 3;
const PILLARS: Pillar[] = [
  { id: "home",     label: "Home",          icon: "home",  href: "/" },
  { id: "pending",  label: "Pending Items", icon: "check", href: "/pending" },
  { id: "globe",    label: "Globe",         icon: "globe", href: "/globe" },
  // — Companies group inserted here —
  { id: "selling",  label: "Selling",       icon: "tag",   href: "/selling" },
  { id: "harvests", label: "Harvests",      icon: "leaf",  href: "/harvests" },
  { id: "expenses", label: "Expenses",      icon: "coin",  href: "/expenses" },
  { id: "income",   label: "Income sheet",  icon: "spark", href: "/income" },
];

export function Sidebar({
  dense = false,
  entities,
  currentUser = null,
}: {
  dense?: boolean;
  entities: Entity[];
  currentUser?: { name: string; email: string | null } | null;
}) {
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
          {PILLARS.slice(0, COMPANIES_INSERT).map((p) => (
            <NavRow key={p.id} active={isActive(p.href)} icon={p.icon} label={p.label} onClick={() => router.push(p.href)} />
          ))}

          {/* Label clicks navigate to /companies index; chevron toggles the expanded list. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "14px 1fr 22px",
              alignItems: "center",
              gap: 10,
              padding: "6px 12px",
              borderRadius: 6,
              background: isActive("/companies") && !activeCompanySlug ? "var(--bg-3)" : "transparent",
              color: "var(--text-1)",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <Icon name="box" size={13} color="var(--text-2)" />
            <button
              type="button"
              onClick={() => router.push("/companies")}
              style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit", textAlign: "left", fontSize: "inherit" }}
            >
              Companies
            </button>
            <button
              type="button"
              onClick={() => setCompaniesOpen((v) => !v)}
              aria-label={companiesOpen ? "Collapse" : "Expand"}
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                justifyContent: "flex-end",
                transform: companiesOpen ? "rotate(90deg)" : "rotate(0)",
                transition: "transform 160ms",
              }}
            >
              <Icon name="chev" size={10} color="var(--text-3)" />
            </button>
          </div>
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

          {PILLARS.slice(COMPANIES_INSERT).map((p) => (
            <NavRow key={p.id} active={isActive(p.href)} icon={p.icon} label={p.label} onClick={() => router.push(p.href)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8, marginTop: 8 }}>
        <NavRow
          active={isActive("/activity")}
          icon="clock"
          label="Activity"
          onClick={() => router.push("/activity")}
        />
        <NavRow
          active={isActive("/drive")}
          icon="file"
          label="Drive"
          onClick={() => router.push("/drive")}
        />
        <NavRow
          active={isActive("/admin/google-auth")}
          icon="shield"
          label="Google auth"
          onClick={() => router.push("/admin/google-auth")}
        />
        {currentUser && (
          <form action="/api/auth/logout" method="post" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser.name}
            </span>
            <button
              type="submit"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--text-3)",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Sign out
            </button>
          </form>
        )}
      </div>
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

