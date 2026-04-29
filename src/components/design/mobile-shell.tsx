"use client";

// Mobile sidebar shell + hamburger toggle. On desktop (≥768px) the sidebar
// just sits in its grid column as before — this component is invisible.
// On mobile, the sidebar becomes a slide-in overlay; the hamburger button
// (top-left, fixed) toggles it. Tapping the scrim closes it.
//
// CSS-driven: the open state is just a `data-open` attribute on two
// elements (the sidebar shell and the scrim); media queries in globals.css
// handle the actual show/hide/translate.

import * as React from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export function MobileShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close on route change so navigating from the sidebar hides it.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="ee-mobile-hamburger"
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "x" : "drag"} size={16} />
      </button>
      <div
        className="ee-sidebar-scrim"
        data-open={open ? "true" : "false"}
        onClick={() => setOpen(false)}
      />
      <div className="ee-sidebar-shell" data-open={open ? "true" : "false"}>
        {children}
      </div>
    </>
  );
}
