"use server";

// Server actions for the harvests pillar. The drawer's Save button calls
// updateHarvest + (when present) updateSettlement; the "Add settlement" CTA
// in the drawer calls recordSettlement.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { startOfWeek, parseISO, format } from "date-fns";
import { db } from "@/db";
import { harvests, harvestSettlements } from "@/db/schema";

// Sunday of the week containing the date. Master sheet uses Sun→Sat weeks.
function sundayOfWeek(ymd: string): string {
  return format(startOfWeek(parseISO(ymd), { weekStartsOn: 0 }), "yyyy-MM-dd");
}

export type CreateHarvestInput = {
  harvestDate: string;
  processorCompanyId: string;
  lotNumber: string | null;
  kgDelivered: string;
  notes: string | null;
  evidenceUrl: string | null;
};

export type UpdateHarvestInput = Partial<CreateHarvestInput> & { id: string };

export async function createHarvest(input: CreateHarvestInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (Number(input.kgDelivered) <= 0) return { ok: false, error: "kg delivered must be positive." };

  const [row] = await db
    .insert(harvests)
    .values({
      harvestDate: input.harvestDate,
      weekStartDate: sundayOfWeek(input.harvestDate),
      processorCompanyId: input.processorCompanyId,
      lotNumber: input.lotNumber,
      kgDelivered: input.kgDelivered,
      notes: input.notes,
      evidenceUrl: input.evidenceUrl,
      lastTouchedAt: new Date(),
    })
    .returning({ id: harvests.id });

  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function updateHarvest(input: UpdateHarvestInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id." };
  if (input.kgDelivered !== undefined && Number(input.kgDelivered) <= 0) {
    return { ok: false, error: "kg delivered must be positive." };
  }

  const patch: Partial<typeof harvests.$inferInsert> = {
    lastTouchedAt: new Date(),
    updatedAt: new Date(),
  };
  if (input.harvestDate !== undefined) {
    patch.harvestDate = input.harvestDate;
    patch.weekStartDate = sundayOfWeek(input.harvestDate);
  }
  if (input.processorCompanyId !== undefined) patch.processorCompanyId = input.processorCompanyId;
  if (input.lotNumber !== undefined) patch.lotNumber = input.lotNumber;
  if (input.kgDelivered !== undefined) patch.kgDelivered = input.kgDelivered;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.evidenceUrl !== undefined) patch.evidenceUrl = input.evidenceUrl;

  await db.update(harvests).set(patch).where(eq(harvests.id, input.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteHarvest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  // Cascade deletes the settlement (FK on delete cascade).
  await db.delete(harvests).where(eq(harvests.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export type RecordSettlementInput = {
  harvestId: string;
  settlementDate: string;
  kgManifested: string;
  kgProcessed: string;
  kgWaste: string;
  wastePct?: string | null;
  grade1_5Kg?: string | null;
  grade2Kg?: string | null;
  gradeSmallKg?: string | null;
  grade1_5RateUsd?: string | null;
  grade2RateUsd?: string | null;
  gradeSmallRateUsd?: string | null;
  subtotalUsd: string;
  retentionUsd: string;
  netPayUsd: string;
  paidToAccountId: string;
  paidDate?: string | null;
  pdfUrl?: string | null;
  wasteObservations?: string | null;
};

export async function recordSettlement(
  input: RecordSettlementInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.harvestId) return { ok: false, error: "Missing harvestId." };
  const [row] = await db
    .insert(harvestSettlements)
    .values({
      harvestId: input.harvestId,
      settlementDate: input.settlementDate,
      kgManifested: input.kgManifested,
      kgProcessed: input.kgProcessed,
      kgWaste: input.kgWaste,
      wastePct: input.wastePct ?? null,
      grade1_5Kg: input.grade1_5Kg ?? null,
      grade2Kg: input.grade2Kg ?? null,
      gradeSmallKg: input.gradeSmallKg ?? null,
      grade1_5RateUsd: input.grade1_5RateUsd ?? null,
      grade2RateUsd: input.grade2RateUsd ?? null,
      gradeSmallRateUsd: input.gradeSmallRateUsd ?? null,
      subtotalUsd: input.subtotalUsd,
      retentionUsd: input.retentionUsd,
      netPayUsd: input.netPayUsd,
      paidToAccountId: input.paidToAccountId,
      paidDate: input.paidDate ?? null,
      pdfUrl: input.pdfUrl ?? null,
      wasteObservations: input.wasteObservations ?? null,
      lastTouchedAt: new Date(),
    })
    .returning({ id: harvestSettlements.id });

  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export type UpdateSettlementInput = Partial<Omit<RecordSettlementInput, "harvestId">> & { id: string };

export async function updateSettlement(
  input: UpdateSettlementInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id." };
  const patch: Partial<typeof harvestSettlements.$inferInsert> = {
    lastTouchedAt: new Date(),
    updatedAt: new Date(),
  };
  for (const key of [
    "settlementDate",
    "kgManifested",
    "kgProcessed",
    "kgWaste",
    "wastePct",
    "grade1_5Kg",
    "grade2Kg",
    "gradeSmallKg",
    "grade1_5RateUsd",
    "grade2RateUsd",
    "gradeSmallRateUsd",
    "subtotalUsd",
    "retentionUsd",
    "netPayUsd",
    "paidToAccountId",
    "paidDate",
    "pdfUrl",
    "wasteObservations",
  ] as const) {
    if (input[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (patch as any)[key] = input[key];
    }
  }
  await db.update(harvestSettlements).set(patch).where(eq(harvestSettlements.id, input.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
