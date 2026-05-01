"use server";

// Harvest pipeline write paths. Four stages — flowers-picked (optional),
// farm harvest, processed report, payment. Each stage writes its own row
// (or appends one); pending-tracking computes status by joining across
// the stages.

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  farmHarvests,
  harvests,
  harvestSettlements,
  companies,
  accounts,
} from "@/db/schema";

// ── Farm-side picking event (stages 1 + 2) ────────────────────────────

export type CreateFarmHarvestInput = {
  harvestDate: string; // YYYY-MM-DD — when buckets were picked (stage 2). Optional if only stage-1 fields are given.
  flowerCount?: number | null;
  bucketCount?: number | null;
  flowersPickedDate?: string | null; // optional stage-1 pre-step
  flowersPickedCount?: number | null;
  notes?: string | null;
  recordedBy?: string | null;
};

export async function createFarmHarvest(
  input: CreateFarmHarvestInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.harvestDate)) {
      return { ok: false, error: "harvestDate must be YYYY-MM-DD." };
    }
    if (input.flowersPickedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.flowersPickedDate)) {
      return { ok: false, error: "flowersPickedDate must be YYYY-MM-DD." };
    }
    // At least one of: flowers-picked count, flower count today, or bucket count.
    const hasAny =
      (input.flowersPickedCount ?? null) !== null ||
      (input.flowerCount ?? null) !== null ||
      (input.bucketCount ?? null) !== null;
    if (!hasAny) {
      return { ok: false, error: "Enter at least flowers picked, flowers, or buckets." };
    }

    const [row] = await db
      .insert(farmHarvests)
      .values({
        harvestDate: input.harvestDate,
        flowerCount: input.flowerCount ?? null,
        bucketCount: input.bucketCount ?? null,
        flowersPickedDate: input.flowersPickedDate ?? null,
        flowersPickedCount: input.flowersPickedCount ?? null,
        notes: input.notes?.trim() || null,
        recordedBy: input.recordedBy?.trim() || null,
        lastTouchedAt: new Date(),
      })
      .returning({ id: farmHarvests.id });
    revalidatePath("/harvests");
    revalidatePath("/pending");
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("createFarmHarvest failed:", e);
    return { ok: false, error: (e as Error).message ?? "Insert failed" };
  }
}

export type UpdateFarmHarvestInput = {
  id: string;
  harvestDate?: string;
  flowerCount?: number | null;
  bucketCount?: number | null;
  flowersPickedDate?: string | null;
  flowersPickedCount?: number | null;
  notes?: string | null;
  recordedBy?: string | null;
};

export async function updateFarmHarvest(
  input: UpdateFarmHarvestInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id." };
  const patch: Partial<typeof farmHarvests.$inferInsert> = {
    updatedAt: new Date(),
    lastTouchedAt: new Date(),
  };
  if (input.harvestDate !== undefined) patch.harvestDate = input.harvestDate;
  if (input.flowerCount !== undefined) patch.flowerCount = input.flowerCount;
  if (input.bucketCount !== undefined) patch.bucketCount = input.bucketCount;
  if (input.flowersPickedDate !== undefined) patch.flowersPickedDate = input.flowersPickedDate ?? null;
  if (input.flowersPickedCount !== undefined) patch.flowersPickedCount = input.flowersPickedCount;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.recordedBy !== undefined) patch.recordedBy = input.recordedBy?.trim() || null;
  await db.update(farmHarvests).set(patch).where(eq(farmHarvests.id, input.id));
  revalidatePath("/harvests");
  return { ok: true };
}

export async function deleteFarmHarvest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  await db.delete(farmHarvests).where(eq(farmHarvests.id, id));
  revalidatePath("/harvests");
  return { ok: true };
}

// ── Stage 3: Processed report ─────────────────────────────────────────
//
// What the processor reported back: kg accepted, kg declined, expected
// payment. No payment recorded yet — that comes via recordPayment. Creates
// a harvests row (the delivery) plus a settlement row (kind='lump_sum',
// paid_date=null, net_pay_usd=0) so the kg figures are linked to the
// pipeline.

export type RecordProcessedReportInput = {
  deliveryDate: string; // YYYY-MM-DD
  processorCompanyId: string;
  farmHarvestId?: string | null;
  kgAccepted: number;
  kgDeclined: number;
  expectedTotalUsd?: number | null; // what we expect to be paid (kg × rate)
  pdfUrl?: string | null;
  notes?: string | null;
};

export async function recordProcessedReport(
  input: RecordProcessedReportInput
): Promise<{ ok: true; harvestId: string; settlementId: string } | { ok: false; error: string }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) {
      return { ok: false, error: "deliveryDate must be YYYY-MM-DD." };
    }
    if (!input.processorCompanyId) return { ok: false, error: "Processor required." };
    if (input.kgAccepted < 0 || input.kgDeclined < 0) {
      return { ok: false, error: "kg values must be non-negative." };
    }

    const week = sundayOf(input.deliveryDate);
    const kgManifested = input.kgAccepted + input.kgDeclined;

    const [harvestRow] = await db
      .insert(harvests)
      .values({
        harvestDate: input.deliveryDate,
        weekStartDate: week,
        processorCompanyId: input.processorCompanyId,
        farmHarvestId: input.farmHarvestId ?? null,
        lotNumber: `manual:delivery:${input.deliveryDate}`,
        kgDelivered: kgManifested.toFixed(2),
        notes: input.notes?.trim() || null,
        evidenceUrl: input.pdfUrl?.trim() || null,
        lastTouchedAt: new Date(),
      })
      .returning({ id: harvests.id });

    const account = await getDefaultAccount();
    if (!account) return { ok: false, error: 'Default account "finca-ec" not found.' };

    const [settlementRow] = await db
      .insert(harvestSettlements)
      .values({
        harvestId: harvestRow.id,
        kind: "lump_sum",
        settlementDate: input.deliveryDate,
        kgManifested: kgManifested.toFixed(2),
        kgProcessed: input.kgAccepted.toFixed(2),
        kgWaste: input.kgDeclined.toFixed(2),
        wastePct:
          kgManifested > 0
            ? ((input.kgDeclined / kgManifested) * 100).toFixed(2)
            : "0.00",
        subtotalUsd: "0",
        retentionUsd: "0",
        netPayUsd: "0",
        expectedTotalUsd: input.expectedTotalUsd != null ? input.expectedTotalUsd.toFixed(2) : null,
        paidToAccountId: account.id,
        paidDate: null,
        pdfUrl: input.pdfUrl?.trim() || null,
      })
      .returning({ id: harvestSettlements.id });

    revalidatePath("/harvests");
    revalidatePath("/pending");
    revalidatePath("/income");
    return { ok: true, harvestId: harvestRow.id, settlementId: settlementRow.id };
  } catch (e) {
    console.error("recordProcessedReport failed:", e);
    return { ok: false, error: (e as Error).message ?? "Insert failed" };
  }
}

// ── Stage 4: Payment ──────────────────────────────────────────────────
//
// Records cash actually received. Adds a NEW settlement row (kg fields = 0,
// just the money side) tagged with the kind. Multiple payments per harvest
// stack up — pending-tracker compares sum(net_pay) to the expected total
// from the processed report.

export type RecordPaymentInput = {
  harvestId: string;
  kind: "advance" | "balance" | "lump_sum";
  amountUsd: number;
  paidDate: string; // YYYY-MM-DD
  pdfUrl?: string | null;
  notes?: string | null;
};

export async function recordPayment(
  input: RecordPaymentInput
): Promise<{ ok: true; settlementId: string } | { ok: false; error: string }> {
  try {
    if (!input.harvestId) return { ok: false, error: "harvestId required." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate)) {
      return { ok: false, error: "paidDate must be YYYY-MM-DD." };
    }
    if (input.amountUsd <= 0) return { ok: false, error: "Amount must be positive." };

    const account = await getDefaultAccount();
    if (!account) return { ok: false, error: 'Default account "finca-ec" not found.' };

    // If the harvest already has a "lump_sum" settlement with no payment
    // recorded yet (paid_date IS NULL, net_pay_usd = 0) AND the incoming
    // kind is also lump_sum, update that row in place rather than creating
    // a duplicate. Advances and balances always create new rows.
    if (input.kind === "lump_sum") {
      const pending = await db
        .select({ id: harvestSettlements.id })
        .from(harvestSettlements)
        .where(
          sql`${harvestSettlements.harvestId} = ${input.harvestId}
              AND ${harvestSettlements.kind} = 'lump_sum'
              AND ${harvestSettlements.paidDate} IS NULL
              AND ${harvestSettlements.netPayUsd}::numeric = 0`
        )
        .limit(1);
      if (pending.length > 0) {
        await db
          .update(harvestSettlements)
          .set({
            netPayUsd: input.amountUsd.toFixed(2),
            subtotalUsd: input.amountUsd.toFixed(2),
            paidDate: input.paidDate,
            pdfUrl: input.pdfUrl?.trim() || null,
            updatedAt: new Date(),
          })
          .where(eq(harvestSettlements.id, pending[0].id));
        revalidatePath("/harvests");
        revalidatePath("/pending");
        revalidatePath("/income");
        return { ok: true, settlementId: pending[0].id };
      }
    }

    // Otherwise append a new settlement row.
    const [row] = await db
      .insert(harvestSettlements)
      .values({
        harvestId: input.harvestId,
        kind: input.kind,
        settlementDate: input.paidDate,
        kgManifested: "0",
        kgProcessed: "0",
        kgWaste: "0",
        subtotalUsd: input.amountUsd.toFixed(2),
        retentionUsd: "0",
        netPayUsd: input.amountUsd.toFixed(2),
        paidToAccountId: account.id,
        paidDate: input.paidDate,
        pdfUrl: input.pdfUrl?.trim() || null,
        wasteObservations: input.notes?.trim() || null,
      })
      .returning({ id: harvestSettlements.id });

    revalidatePath("/harvests");
    revalidatePath("/pending");
    revalidatePath("/income");
    return { ok: true, settlementId: row.id };
  } catch (e) {
    console.error("recordPayment failed:", e);
    return { ok: false, error: (e as Error).message ?? "Insert failed" };
  }
}

// ── Add-new processor company ─────────────────────────────────────────

export async function createProcessorCompany(
  input: { name: string; country?: string }
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name required." };
  const [row] = await db
    .insert(companies)
    .values({
      name,
      kind: "packing_facility",
      country: input.country?.trim() || null,
      vettingStatus: "unvetted",
    })
    .returning({ id: companies.id, name: companies.name });
  revalidatePath("/harvests");
  return { ok: true, id: row.id, name: row.name };
}

// ── Helpers ──────────────────────────────────────────────────────────

async function getDefaultAccount(): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.slug, "finca-ec"))
    .limit(1);
  return row ?? null;
}

// Sunday of the week containing `date` (ISO YYYY-MM-DD).
function sundayOf(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
