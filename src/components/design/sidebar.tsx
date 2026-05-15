"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Entity } from "@/lib/data";
import { PitayaGlyph, Icon, type IconName } from "./icons";

type Pillar = { id: string; label: string; icon: IconName; href: string };

// MVP nav: daily operations only. Future/admin routes remain available by URL,
// but the sidebar should not make the app feel bigger than today's work.
const PILLARS: Pillar[] = [
  { id: "home",     label: "Home",     icon: "home",  href: "/" },
  { id: "pending",  label: "Pending",  icon: "check", href: "/pending" },
  { id: "globe",    label: "Globe",    icon: "globe", href: "/globe" },
  { id: "expenses", label: "Expenses", icon: "coin",  href: "/expenses" },
  { id: "harvests", label: "Harvests", icon: "leaf",  href: "/harvests" },
  { id: "pricing",  label: "Pricing",  icon: "tag",   href: "/selling" },
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

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

      <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {PILLARS.map((p) => (
          <NavRow key={p.id} active={isActive(p.href)} icon={p.icon} label={p.label} onClick={() => router.push(p.href)} />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8, marginTop: 8 }}>
        <NavRow
          active={isActive("/companies")}
          icon="box"
          label="Companies"
          onClick={() => router.push("/companies")}
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

