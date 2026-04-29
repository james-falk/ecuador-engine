"use server";

// Server actions for the expenses pillar. UI calls these from drawer Save +
// future "create expense" flows. Mirrors the compliance action shape.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfWeek, parseISO, format } from "date-fns";
import { db } from "@/db";
import { expenseEntries } from "@/db/schema";
import type { ExpenseCategoryType } from "@/lib/queries/expenses";

// Validation: every value the schema enum accepts (including the legacy
// `labor_water` so historical rows can still update without errors).
const CATEGORY_TYPES: ExpenseCategoryType[] = [
  "labor_harvest",
  "labor_overhead",
  "operating_bills",
  "equipment",
  "services",
  "taxes",
  "transfer_out",
  "other",
  "labor_water",
];

export type CreateExpenseInput = {
  entryDate: string; // YYYY-MM-DD
  categoryType: ExpenseCategoryType;
  categoryLabel: string | null;
  amountUsd: string; // numeric string, e.g. "180.00"
  accountId: string;
  payee: string | null;
  payeePersonId: string | null;
  payeeCompanyId: string | null;
  notes: string | null;
  source?: string | null;
};

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "accountId">> & { id: string };

// Sunday of the week containing a YYYY-MM-DD date. James's master sheet
// runs Sun→Sat with payments on Saturday, so Sunday is the canonical
// `week_start_date`. weekStartsOn: 0 = Sunday in date-fns.
function sundayOfWeek(ymd: string): string {
  return format(startOfWeek(parseISO(ymd), { weekStartsOn: 0 }), "yyyy-MM-dd");
}

function validateAmount(amount: string): string | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "Amount must be a positive number.";
  return null;
}

export async function createExpenseEntry(
  input: CreateExpenseInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!CATEGORY_TYPES.includes(input.categoryType)) return { ok: false, error: "Unknown category." };
  const amountErr = validateAmount(input.amountUsd);
  if (amountErr) return { ok: false, error: amountErr };

  const [row] = await db
    .insert(expenseEntries)
    .values({
      entryDate: input.entryDate,
      weekStartDate: sundayOfWeek(input.entryDate),
      categoryType: input.categoryType,
      categoryLabel: input.categoryLabel,
      amountUsd: input.amountUsd,
      accountId: input.accountId,
      payee: input.payee,
      payeePersonId: input.payeePersonId,
      payeeCompanyId: input.payeeCompanyId,
      notes: input.notes,
      source: input.source ?? "manual",
      lastTouchedAt: new Date(),
    })
    .returning({ id: expenseEntries.id });

  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function updateExpenseEntry(
  input: UpdateExpenseInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id." };
  if (input.categoryType && !CATEGORY_TYPES.includes(input.categoryType)) {
    return { ok: false, error: "Unknown category." };
  }
  if (input.amountUsd) {
    const err = validateAmount(input.amountUsd);
    if (err) return { ok: false, error: err };
  }

  const patch: Partial<typeof expenseEntries.$inferInsert> = {
    lastTouchedAt: new Date(),
    updatedAt: new Date(),
  };
  if (input.entryDate !== undefined) {
    patch.entryDate = input.entryDate;
    patch.weekStartDate = sundayOfWeek(input.entryDate);
  }
  if (input.categoryType !== undefined) patch.categoryType = input.categoryType;
  if (input.categoryLabel !== undefined) patch.categoryLabel = input.categoryLabel;
  if (input.amountUsd !== undefined) patch.amountUsd = input.amountUsd;
  if (input.payee !== undefined) patch.payee = input.payee;
  if (input.payeePersonId !== undefined) patch.payeePersonId = input.payeePersonId;
  if (input.payeeCompanyId !== undefined) patch.payeeCompanyId = input.payeeCompanyId;
  if (input.notes !== undefined) patch.notes = input.notes;

  await db.update(expenseEntries).set(patch).where(eq(expenseEntries.id, input.id));

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteExpenseEntry(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
