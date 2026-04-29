"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfWeek, parseISO, format } from "date-fns";
import { db } from "@/db";
import { cashMovements } from "@/db/schema";
import type { CashMovementDirection } from "@/lib/queries/cash-movements";

function sundayOfWeek(ymd: string): string {
  return format(startOfWeek(parseISO(ymd), { weekStartsOn: 0 }), "yyyy-MM-dd");
}

const DIRECTIONS: CashMovementDirection[] = ["in_to_ec", "out_to_us"];

export type CreateCashMovementInput = {
  transferDate: string;
  direction: CashMovementDirection;
  amountUsd: string;
  accountId: string;
  counterparty: string | null;
  notes: string | null;
  source?: string | null;
};

export type UpdateCashMovementInput = Partial<Omit<CreateCashMovementInput, "accountId">> & { id: string };

export async function createCashMovement(
  input: CreateCashMovementInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!DIRECTIONS.includes(input.direction)) return { ok: false, error: "Unknown direction." };
  if (Number(input.amountUsd) <= 0) return { ok: false, error: "Amount must be positive." };

  const [row] = await db
    .insert(cashMovements)
    .values({
      transferDate: input.transferDate,
      weekStartDate: sundayOfWeek(input.transferDate),
      direction: input.direction,
      amountUsd: input.amountUsd,
      accountId: input.accountId,
      counterparty: input.counterparty,
      notes: input.notes,
      source: input.source ?? "manual",
      lastTouchedAt: new Date(),
    })
    .returning({ id: cashMovements.id });

  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function updateCashMovement(
  input: UpdateCashMovementInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id." };
  if (input.direction && !DIRECTIONS.includes(input.direction)) {
    return { ok: false, error: "Unknown direction." };
  }
  if (input.amountUsd && Number(input.amountUsd) <= 0) {
    return { ok: false, error: "Amount must be positive." };
  }

  const patch: Partial<typeof cashMovements.$inferInsert> = {
    lastTouchedAt: new Date(),
    updatedAt: new Date(),
  };
  if (input.transferDate !== undefined) {
    patch.transferDate = input.transferDate;
    patch.weekStartDate = sundayOfWeek(input.transferDate);
  }
  if (input.direction !== undefined) patch.direction = input.direction;
  if (input.amountUsd !== undefined) patch.amountUsd = input.amountUsd;
  if (input.counterparty !== undefined) patch.counterparty = input.counterparty;
  if (input.notes !== undefined) patch.notes = input.notes;

  await db.update(cashMovements).set(patch).where(eq(cashMovements.id, input.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCashMovement(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  await db.delete(cashMovements).where(eq(cashMovements.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
