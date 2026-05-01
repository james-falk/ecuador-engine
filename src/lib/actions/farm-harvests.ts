"use server";

// Farm-harvest write paths + processor-company helper.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { farmHarvests, harvests, harvestSettlements, companies, accounts } from "@/db/schema";

export type CreateFarmHarvestInput = {
  harvestDate: string; // YYYY-MM-DD
  flowerCount?: number | null;
  bucketCount?: number | null;
  notes?: string | null;
  recordedBy?: string | null;
};

export async function createFarmHarvest(
  input: CreateFarmHarvestInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.harvestDate)) {
    return { ok: false, error: "harvestDate must be YYYY-MM-DD." };
  }
  // At least one count must be given — otherwise the row carries no data.
  if (
    (input.flowerCount === null || input.flowerCount === undefined) &&
    (input.bucketCount === null || input.bucketCount === undefined)
  ) {
    return { ok: false, error: "Enter at least flower count or bucket count." };
  }
  const [row] = await db
    .insert(farmHarvests)
    .values({
      harvestDate: input.harvestDate,
      flowerCount: input.flowerCount ?? null,
      bucketCount: input.bucketCount ?? null,
      notes: input.notes?.trim() || null,
      recordedBy: input.recordedBy?.trim() || null,
      lastTouchedAt: new Date(),
    })
    .returning({ id: farmHarvests.id });
  revalidatePath("/harvests");
  return { ok: true, id: row.id };
}

export type UpdateFarmHarvestInput = {
  id: string;
  harvestDate?: string;
  flowerCount?: number | null;
  bucketCount?: number | null;
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

// ── Processor delivery + report ───────────────────────────────────────
//
// Records a single delivery to a processor PLUS the report back. Optionally
// links to a farm_harvest. Settlement details (kg accepted/declined, price)
// land in the same call so the operator enters the report end-to-end.

export type RecordDeliveryInput = {
  deliveryDate: string; // YYYY-MM-DD; aligns with harvest_date in schema
  processorCompanyId: string;
  farmHarvestId?: string | null;
  kgAccepted: number; // -> kg_processed
  kgDeclined: number; // -> kg_waste
  // Total payment received (after retentions) — stored as net_pay_usd.
  netPayUsd: number;
  paidDate?: string | null;
  notes?: string | null;
  pdfUrl?: string | null;
};

export async function recordDelivery(
  input: RecordDeliveryInput
): Promise<{ ok: true; harvestId: string } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) {
    return { ok: false, error: "deliveryDate must be YYYY-MM-DD." };
  }
  if (!input.processorCompanyId) return { ok: false, error: "Processor required." };
  if (input.kgAccepted < 0 || input.kgDeclined < 0) {
    return { ok: false, error: "kg values must be non-negative." };
  }
  if (input.netPayUsd < 0) return { ok: false, error: "Net pay cannot be negative." };

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.slug, "finca-ec"))
    .limit(1);
  if (!account) return { ok: false, error: 'Default account "finca-ec" not found.' };

  // Sunday of the week containing the delivery date.
  const week = (() => {
    const d = new Date(input.deliveryDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  })();

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

  await db.insert(harvestSettlements).values({
    harvestId: harvestRow.id,
    settlementDate: input.deliveryDate,
    kgManifested: kgManifested.toFixed(2),
    kgProcessed: input.kgAccepted.toFixed(2),
    kgWaste: input.kgDeclined.toFixed(2),
    wastePct: kgManifested > 0
      ? ((input.kgDeclined / kgManifested) * 100).toFixed(2)
      : "0.00",
    subtotalUsd: input.netPayUsd.toFixed(2),
    retentionUsd: "0",
    netPayUsd: input.netPayUsd.toFixed(2),
    paidToAccountId: account.id,
    paidDate: input.paidDate ?? input.deliveryDate,
    pdfUrl: input.pdfUrl?.trim() || null,
  });

  revalidatePath("/harvests");
  revalidatePath("/income");
  return { ok: true, harvestId: harvestRow.id };
}

// Add-new processor company. Default kind = packing_facility (most common
// for harvests). Returns the new company id so the picker can switch to it
// immediately.
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
