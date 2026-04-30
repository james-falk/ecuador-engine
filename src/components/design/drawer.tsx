"use client";

// Slide-in drawer system. A single host lives in the layout; pages and rows
// push fully-resolved payloads into it through context. Each kind has its own
// open-* method so call sites stay type-safe — we deliberately do NOT
// generalize to a single `open(kind, payload)` signature.

import * as React from "react";
import type { ComplianceItem } from "@/lib/data";
import type { ExpenseRow } from "@/lib/queries/expenses";
import type { HarvestRow } from "@/lib/queries/harvests";
import type { CashMovementRow } from "@/lib/queries/cash-movements";
import type { TaskRow } from "@/lib/queries/tasks";

// `task` is the only kind that supports a CREATE flow today (no item; the
// drawer renders an empty form). All other kinds show details for an existing
// row.
type DrawerState =
  | { kind: "none" }
  | { kind: "compliance"; item: ComplianceItem }
  | { kind: "entity"; entityId: string }
  | { kind: "expense"; item: ExpenseRow }
  | { kind: "harvest"; item: HarvestRow }
  | { kind: "cashMovement"; item: CashMovementRow }
  | { kind: "task"; item: TaskRow | null };

type DrawerContextValue = {
  state: DrawerState;
  openCompliance: (item: ComplianceItem) => void;
  openEntity: (entityId: string) => void;
  openExpense: (item: ExpenseRow) => void;
  openHarvest: (item: HarvestRow) => void;
  openCashMovement: (item: CashMovementRow) => void;
  openTask: (item: TaskRow) => void;
  openTaskCreate: () => void;
  close: () => void;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export function useDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be used inside <DrawerProvider>");
  return ctx;
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DrawerState>({ kind: "none" });
  const value = React.useMemo<DrawerContextValue>(
    () => ({
      state,
      openCompliance: (item) => setState({ kind: "compliance", item }),
      openEntity: (entityId) => setState({ kind: "entity", entityId }),
      openExpense: (item) => setState({ kind: "expense", item }),
      openHarvest: (item) => setState({ kind: "harvest", item }),
      openCashMovement: (item) => setState({ kind: "cashMovement", item }),
      openTask: (item) => setState({ kind: "task", item }),
      openTaskCreate: () => setState({ kind: "task", item: null }),
      close: () => setState({ kind: "none" }),
    }),
    [state]
  );
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function Drawer({ open, onClose, children, width = 460 }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: open ? "auto" : "none", zIndex: 50 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "oklch(0 0 0 / 0.55)",
          opacity: open ? 1 : 0,
          transition: "opacity 220ms",
        }}
      />
      <div
        className="ee-drawer-panel"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          background: "var(--bg-1)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "var(--shadow-pop)",
          transform: open ? "translateX(0)" : "translateX(105%)",
          transition: "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
