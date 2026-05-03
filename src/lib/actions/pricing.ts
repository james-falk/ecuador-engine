"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pricingInputs } from "@/db/schema";

export type UpdatePricingInputsInput = {
  fruitCostPerKgUsd?: number;
  kgPerCarton?: number;
  labelCostPerCartonUsd?: number;
  packingCostPerCartonUsd?: number;
  materialCostPerCartonUsd?: number;
  ecuadorTransportUsd?: number;
  oceanFreightUsd?: number;
  importCustomsUsd?: number;
  cartonsPer20ft?: number;
  cartonsPer40ft?: number;
};

export async function updatePricingInputs(
  input: UpdatePricingInputsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const [existing] = await db.select({ id: pricingInputs.id }).from(pricingInputs).limit(1);
    const patch: Partial<typeof pricingInputs.$inferInsert> = { updatedAt: new Date() };
    if (input.fruitCostPerKgUsd !== undefined) patch.fruitCostPerKgUsd = input.fruitCostPerKgUsd.toFixed(4);
    if (input.kgPerCarton !== undefined) patch.kgPerCarton = input.kgPerCarton.toFixed(4);
    if (input.labelCostPerCartonUsd !== undefined) patch.labelCostPerCartonUsd = input.labelCostPerCartonUsd.toFixed(4);
    if (input.packingCostPerCartonUsd !== undefined) patch.packingCostPerCartonUsd = input.packingCostPerCartonUsd.toFixed(4);
    if (input.materialCostPerCartonUsd !== undefined) patch.materialCostPerCartonUsd = input.materialCostPerCartonUsd.toFixed(4);
    if (input.ecuadorTransportUsd !== undefined) patch.ecuadorTransportUsd = input.ecuadorTransportUsd.toFixed(2);
    if (input.oceanFreightUsd !== undefined) patch.oceanFreightUsd = input.oceanFreightUsd.toFixed(2);
    if (input.importCustomsUsd !== undefined) patch.importCustomsUsd = input.importCustomsUsd.toFixed(2);
    if (input.cartonsPer20ft !== undefined) patch.cartonsPer20ft = Math.trunc(input.cartonsPer20ft);
    if (input.cartonsPer40ft !== undefined) patch.cartonsPer40ft = Math.trunc(input.cartonsPer40ft);

    if (existing) {
      await db.update(pricingInputs).set(patch).where(eq(pricingInputs.id, existing.id));
    } else {
      await db.insert(pricingInputs).values({ ...patch, updatedAt: sql`now()` });
    }
    revalidatePath("/selling");
    return { ok: true };
  } catch (e) {
    console.error("updatePricingInputs failed:", e);
    return { ok: false, error: (e as Error).message ?? "Update failed" };
  }
}
