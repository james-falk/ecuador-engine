"use client";

import { Drawer, useDrawer } from "./drawer";
import { ComplianceDetail } from "./compliance-detail";
import { EntityDetail } from "./entity-detail";
import { ExpenseDetail } from "./expense-detail";
import { HarvestDetail } from "./harvest-detail";
import { CashMovementDetail } from "./cash-movement-detail";
import { TaskDetail } from "./task-detail";
import type { Entity } from "@/lib/data";

// `defaultAccountId` is the Finca EC account UUID (resolved server-side in
// layout.tsx). The harvest drawer needs it when recording a brand-new
// settlement that doesn't yet have a paidToAccountId of its own.
//
// `taskAssignees` / `taskCompanies` populate the dropdowns in the task
// drawer (people + companies tables, fetched server-side once per layout
// render).
//
// `ownerEntities` lets the compliance drawer resolve the owner avatar
// from real DB data (no more reaching into mock src/lib/data.ts).
export function DrawerHost({
  defaultAccountId,
  taskAssignees,
  taskCompanies,
  ownerEntities,
}: {
  defaultAccountId: string | null;
  taskAssignees: Array<{ id: string; name: string }>;
  taskCompanies: Array<{ id: string; name: string }>;
  ownerEntities: Entity[];
}) {
  const { state, close } = useDrawer();

  const isCompliance = state.kind === "compliance";
  const isEntity = state.kind === "entity";
  const isExpense = state.kind === "expense";
  const isHarvest = state.kind === "harvest";
  const isCashMovement = state.kind === "cashMovement";
  const isTask = state.kind === "task";

  return (
    <>
      <Drawer open={isCompliance} onClose={close}>
        {isCompliance && <ComplianceDetail item={state.item} onClose={close} ownerEntities={ownerEntities} />}
      </Drawer>
      <Drawer open={isEntity} onClose={close} width={420}>
        {isEntity && <EntityDetail entityId={state.entityId} onClose={close} />}
      </Drawer>
      <Drawer open={isExpense} onClose={close}>
        {isExpense && <ExpenseDetail item={state.item} mode={state.mode} onClose={close} />}
      </Drawer>
      <Drawer open={isHarvest} onClose={close} width={520}>
        {isHarvest && defaultAccountId && (
          <HarvestDetail item={state.item} defaultAccountId={defaultAccountId} onClose={close} />
        )}
      </Drawer>
      <Drawer open={isCashMovement} onClose={close}>
        {isCashMovement && <CashMovementDetail item={state.item} onClose={close} />}
      </Drawer>
      <Drawer open={isTask} onClose={close}>
        {isTask && (
          <TaskDetail
            item={state.item}
            onClose={close}
            assigneeOptions={taskAssignees}
            companyOptions={taskCompanies}
          />
        )}
      </Drawer>
    </>
  );
}
