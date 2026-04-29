"use client";

import * as React from "react";

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const cur = (document.documentElement.dataset.theme as "dark" | "light") || "dark";
    setTheme(cur);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ee-theme", next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 7,
        border: "1px solid var(--line-soft)",
        background: "var(--bg-1)",
        color: "var(--text-2)",
        cursor: "pointer",
      }}
    >
      {theme === "dark" ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a.5.5 0 0 0-.7-.46A6 6 0 1 0 13.46 10.2a.5.5 0 0 0-.46-.7Z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
          <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4 11.2 4.8M4.8 11.2 3.4 12.6M12.6 12.6 11.2 11.2M4.8 4.8 3.4 3.4" />
        </svg>
      )}
    </button>
  );
}
