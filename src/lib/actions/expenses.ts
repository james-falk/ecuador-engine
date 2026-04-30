"use server";

// Server actions for the expenses pillar. UI calls these from drawer Save +
// future "create expense" flows. Mirrors the compliance action shape.

import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfWeek, parseISO, format, addDays } from "date-fns";
import { db } from "@/db";
import { expenseEntries, cashMovements, harvests, harvestSettlements, accounts, companies } from "@/db/schema";
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

// ── Data Entry tab: upsertWeek ────────────────────────────────────────
//
// One transaction-shaped action that writes a week's worth of farm payment
// data. Maps the form fields to canonical (category_type, category_label)
// slots and either inserts/updates manual rows or refuses if a master_sheet
// row occupies the slot. The master-sheet ingest is treated as immutable
// audit history; new edits land alongside it as `source = "manual:..."`.

export const WEEKLY_SLOTS = {
  water:    { categoryType: "operating_bills" as const, categoryLabel: "Water deliveries" },
  jornales: { categoryType: "labor_harvest"   as const, categoryLabel: "Jornales"          },
  chavito:  { categoryType: "labor_overhead"  as const, categoryLabel: "Chavito"           },
  engineer: { categoryType: "labor_overhead"  as const, categoryLabel: "Engineer"          },
  isaac:    { categoryType: "labor_overhead"  as const, categoryLabel: "Isaac"             },
};

export type WeeklySlotKey = keyof typeof WEEKLY_SLOTS;
const SLOT_KEYS: WeeklySlotKey[] = ["water", "jornales", "chavito", "engineer", "isaac"];

export type UpsertWeekInput = {
  weekStartDate: string; // Sunday, YYYY-MM-DD
  // The 5 canonical categories. Use empty string ("") or "0" to clear.
  water?: string;
  jornales?: string;
  chavito?: string;
  engineer?: string;
  isaac?: string;
  // Optional free-text notes for the categories where they're useful
  // (Water — vendor / delivery details; Jornales — crew breakdown like
  // "3 workers × $12 × 5 days"). Stored in expense_entries.notes.
  waterNote?: string;
  jornalesNote?: string;
  // Free-form Other entries — each is an arbitrary label + amount.
  others?: Array<{ note: string; amountUsd: string }>;
  // Capital flows. Counterparty is optional context. Currently NOT entered
  // from the /expenses Data Entry tab (capital movements live on a separate
  // surface coming later) but the action still accepts them so other
  // surfaces can call it without a separate code path.
  capitalIn?: string;
  capitalOut?: string;
  counterparty?: string | null;
  // Harvest payment received this week (lump-sum). Same caveat as capital
  // flows — entered from the Harvests page, not /expenses.
  harvestPayment?: string;
};

type UpsertWeekResult =
  | { ok: true; counts: { expenseUpserts: number; expenseDeletes: number; cashMovementsUpserted: number; cashMovementsDeleted: number; harvestPayment: boolean } }
  | { ok: false; error: string; conflicts?: string[] };

// Saturday entry date for a Sunday-start week. Master-sheet payments
// happened on Saturday by convention; manual rows mirror that.
function saturdayOf(weekStartDate: string): string {
  return format(addDays(parseISO(weekStartDate), 6), "yyyy-MM-dd");
}

function isMasterSheetSource(s: string | null): boolean {
  return !!s && s.startsWith("master_sheet:");
}

function parsePositiveAmount(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function upsertWeek(input: UpsertWeekInput): Promise<UpsertWeekResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStartDate)) {
    return { ok: false, error: "weekStartDate must be YYYY-MM-DD." };
  }
  const weekStart = input.weekStartDate;
  const entryDate = saturdayOf(weekStart);
  const source = `manual:${entryDate}`;

  // Resolve the default Finca EC account once — every row needs it.
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.slug, "finca-ec"))
    .limit(1);
  if (!account) return { ok: false, error: 'Default account "finca-ec" not found.' };

  // Fetch every existing row for this week so we can detect conflicts and
  // decide insert vs update without a second roundtrip per category.
  const existingExpenses = await db
    .select({
      id: expenseEntries.id,
      categoryType: expenseEntries.categoryType,
      categoryLabel: expenseEntries.categoryLabel,
      source: expenseEntries.source,
    })
    .from(expenseEntries)
    .where(eq(expenseEntries.weekStartDate, weekStart));

  // Slot lookup — find an existing row by (categoryType, categoryLabel).
  // category_label uses case-insensitive comparison since 'isaac' vs 'Isaac'
  // shouldn't fork rows.
  function findExisting(categoryType: string, categoryLabel: string) {
    return existingExpenses.find(
      (r) =>
        r.categoryType === categoryType &&
        ((r.categoryLabel ?? "").toLowerCase() === categoryLabel.toLowerCase())
    );
  }

  const conflicts: string[] = [];
  const upsertOps: Array<{ slot: string; existingId?: string; type: ExpenseCategoryType; label: string; amount: number }> = [];
  const deleteOps: Array<{ slot: string; existingId: string }> = [];

  // Canonical 5 categories.
  for (const key of SLOT_KEYS) {
    const slot = WEEKLY_SLOTS[key];
    const raw = input[key as keyof UpsertWeekInput] as string | undefined;
    const amount = parsePositiveAmount(raw);
    const existing = findExisting(slot.categoryType, slot.categoryLabel);

    if (amount !== null) {
      // Writing a value. If a master_sheet row holds this slot, refuse.
      if (existing && isMasterSheetSource(existing.source)) {
        conflicts.push(`${slot.categoryLabel} (locked by ${existing.source})`);
        continue;
      }
      upsertOps.push({
        slot: key,
        existingId: existing?.id,
        type: slot.categoryType,
        label: slot.categoryLabel,
        amount,
      });
    } else {
      // Cleared field (empty / 0). Delete the existing manual row if any.
      // Master-sheet rows are NOT deleted.
      if (existing && !isMasterSheetSource(existing.source)) {
        deleteOps.push({ slot: key, existingId: existing.id });
      }
    }
  }

  // Other entries. Each has a note (label) and amount. We do NOT collide-check
  // against master_sheet here because Other rows in the master sheet have
  // free-form labels and aren't a fixed slot — manual Others are independent.
  // To keep upsert idempotency on re-save, manual Others are matched by
  // (label, source=manual:...). On the second submit, the same note text
  // matches and updates in place; a different note creates a new row.
  const others = (input.others ?? []).filter((o) => parsePositiveAmount(o.amountUsd) !== null);

  if (conflicts.length > 0) {
    return {
      ok: false,
      error: "Some slots are locked by the master sheet ingest. Edit the cell in Drive and re-ingest.",
      conflicts,
    };
  }

  let expenseUpserts = 0;
  let expenseDeletes = 0;

  // Apply expense upserts. Water + Jornales also accept an optional free-text
  // note (e.g. "3 workers × $12 × 5 days" for Jornales); other canonical
  // slots ignore notes.
  function noteForSlot(slot: string): string | null {
    if (slot === "water") {
      const t = (input.waterNote ?? "").trim();
      return t || null;
    }
    if (slot === "jornales") {
      const t = (input.jornalesNote ?? "").trim();
      return t || null;
    }
    return null;
  }
  for (const op of upsertOps) {
    const amountStr = op.amount.toFixed(2);
    const slotNote = noteForSlot(op.slot);
    if (op.existingId) {
      await db
        .update(expenseEntries)
        .set({
          amountUsd: amountStr,
          entryDate,
          weekStartDate: weekStart,
          notes: slotNote,
          source,
          lastTouchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expenseEntries.id, op.existingId));
    } else {
      await db.insert(expenseEntries).values({
        entryDate,
        weekStartDate: weekStart,
        categoryType: op.type,
        categoryLabel: op.label,
        amountUsd: amountStr,
        accountId: account.id,
        payee: op.label,
        notes: slotNote,
        source,
        lastTouchedAt: new Date(),
      });
    }
    expenseUpserts++;
  }
  for (const op of deleteOps) {
    await db.delete(expenseEntries).where(eq(expenseEntries.id, op.existingId));
    expenseDeletes++;
  }

  // Other entries — UPSERT each by manual label match within the week.
  // Existing manual Others not in the new submission set are left alone
  // (the user can delete them individually from the View tab).
  for (const o of others) {
    const amount = parsePositiveAmount(o.amountUsd);
    if (amount === null) continue;
    const note = o.note.trim();
    if (!note) continue;

    const existingOther = existingExpenses.find(
      (r) =>
        r.categoryType === "other" &&
        ((r.categoryLabel ?? "").toLowerCase() === note.toLowerCase()) &&
        !isMasterSheetSource(r.source)
    );
    if (existingOther) {
      await db
        .update(expenseEntries)
        .set({
          amountUsd: amount.toFixed(2),
          entryDate,
          weekStartDate: weekStart,
          source,
          lastTouchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expenseEntries.id, existingOther.id));
    } else {
      await db.insert(expenseEntries).values({
        entryDate,
        weekStartDate: weekStart,
        categoryType: "other",
        categoryLabel: note,
        amountUsd: amount.toFixed(2),
        accountId: account.id,
        notes: note,
        source,
        lastTouchedAt: new Date(),
      });
    }
    expenseUpserts++;
  }

  // Capital flows. Cash movements are matched by (week, direction, manual
  // source) — there's typically 0 or 1 wire per week in each direction.
  const existingCm = await db
    .select({ id: cashMovements.id, direction: cashMovements.direction, source: cashMovements.source })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.weekStartDate, weekStart),
        like(cashMovements.source, "manual:%")
      )
    );

  let cmUpserted = 0;
  let cmDeleted = 0;

  async function applyCashMovement(direction: "in_to_ec" | "out_to_us", raw: string | undefined) {
    const amount = parsePositiveAmount(raw);
    const existing = existingCm.find((r) => r.direction === direction);
    if (amount !== null) {
      if (existing) {
        await db
          .update(cashMovements)
          .set({
            amountUsd: amount.toFixed(2),
            transferDate: entryDate,
            weekStartDate: weekStart,
            counterparty: input.counterparty?.trim() || null,
            source,
            lastTouchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cashMovements.id, existing.id));
      } else {
        await db.insert(cashMovements).values({
          transferDate: entryDate,
          weekStartDate: weekStart,
          direction,
          amountUsd: amount.toFixed(2),
          accountId: account.id,
          counterparty: input.counterparty?.trim() || null,
          source,
          lastTouchedAt: new Date(),
        });
      }
      cmUpserted++;
    } else if (existing) {
      await db.delete(cashMovements).where(eq(cashMovements.id, existing.id));
      cmDeleted++;
    }
  }

  await applyCashMovement("in_to_ec", input.capitalIn);
  await applyCashMovement("out_to_us", input.capitalOut);

  // Harvest payment received — create OR update a single stub harvest +
  // settlement keyed by lot_number = source. kg=0 because the actual
  // weights only land when the Liquidación PDF is parsed (Slice 8 follow-on).
  let harvestPayment = false;
  const harvestAmount = parsePositiveAmount(input.harvestPayment);
  const harvestSource = `${source}:harvest`;
  // Find INCALPACK as the default processor for stub harvests.
  const [processor] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.name, "INCALPACK"))
    .limit(1);

  if (harvestAmount !== null && processor) {
    // Look for an existing manual harvest for this week (lot_number prefixed
    // with "manual:<saturday>:harvest" → idempotent re-save).
    const [existingH] = await db
      .select({ id: harvests.id })
      .from(harvests)
      .where(eq(harvests.lotNumber, harvestSource))
      .limit(1);
    let harvestId: string;
    if (existingH) {
      harvestId = existingH.id;
      await db
        .update(harvests)
        .set({
          harvestDate: entryDate,
          weekStartDate: weekStart,
          processorCompanyId: processor.id,
          updatedAt: new Date(),
          lastTouchedAt: new Date(),
        })
        .where(eq(harvests.id, harvestId));
    } else {
      const [row] = await db
        .insert(harvests)
        .values({
          harvestDate: entryDate,
          weekStartDate: weekStart,
          processorCompanyId: processor.id,
          lotNumber: harvestSource,
          kgDelivered: "0",
          notes: "Manual entry — kg + grade detail TBD from Liquidación PDF.",
        })
        .returning({ id: harvests.id });
      harvestId = row.id;
    }
    // Upsert the settlement row.
    const [existingS] = await db
      .select({ id: harvestSettlements.id })
      .from(harvestSettlements)
      .where(eq(harvestSettlements.harvestId, harvestId))
      .limit(1);
    if (existingS) {
      await db
        .update(harvestSettlements)
        .set({
          settlementDate: entryDate,
          subtotalUsd: harvestAmount.toFixed(2),
          netPayUsd: harvestAmount.toFixed(2),
          paidDate: entryDate,
          updatedAt: new Date(),
          lastTouchedAt: new Date(),
        })
        .where(eq(harvestSettlements.id, existingS.id));
    } else {
      await db.insert(harvestSettlements).values({
        harvestId,
        settlementDate: entryDate,
        kgManifested: "0",
        kgProcessed: "0",
        kgWaste: "0",
        subtotalUsd: harvestAmount.toFixed(2),
        retentionUsd: "0",
        netPayUsd: harvestAmount.toFixed(2),
        paidToAccountId: account.id,
        paidDate: entryDate,
      });
    }
    harvestPayment = true;
  } else if (harvestAmount === null) {
    // Cleared — delete any existing manual stub for this week.
    const [existingH] = await db
      .select({ id: harvests.id })
      .from(harvests)
      .where(eq(harvests.lotNumber, harvestSource))
      .limit(1);
    if (existingH) {
      await db.delete(harvests).where(eq(harvests.id, existingH.id));
    }
  }

  revalidatePath("/expenses", "page");
  revalidatePath("/", "layout");
  return {
    ok: true,
    counts: {
      expenseUpserts,
      expenseDeletes,
      cashMovementsUpserted: cmUpserted,
      cashMovementsDeleted: cmDeleted,
      harvestPayment,
    },
  };
}
