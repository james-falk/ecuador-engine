import { Fragment, type ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({ crumbs = [], right = null }: { crumbs?: string[]; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 22px",
        borderBottom: "1px solid var(--line-soft)",
        background: "var(--bg-0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={{ color: "var(--text-3)" }}>/</span>}
            <span style={{ color: i === crumbs.length - 1 ? "var(--text-0)" : "var(--text-2)" }}>{c}</span>
          </Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {right}
        <ThemeToggle />
      </div>
    </div>
  );
}
