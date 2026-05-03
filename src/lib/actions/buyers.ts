"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { buyers } from "@/db/schema";
import type { BuyerStage } from "@/lib/queries/buyers";

const STAGES: BuyerStage[] = ["lead", "in_conversation", "negotiating", "active", "lost"];

export type CreateBuyerInput = {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  country?: string | null;
  stage?: BuyerStage | null;
  notes?: string | null;
  pricingNotes?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
};

export async function createBuyer(
  input: CreateBuyerInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const name = (input.name ?? "").trim();
    if (!name) return { ok: false, error: "Name is required." };
    const stage = input.stage && STAGES.includes(input.stage) ? input.stage : "lead";
    const [row] = await db
      .insert(buyers)
      .values({
        name,
        contactName: input.contactName?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        country: input.country?.trim() || null,
        stage,
        notes: input.notes?.trim() || null,
        pricingNotes: input.pricingNotes?.trim() || null,
        nextAction: input.nextAction?.trim() || null,
        nextActionDate: input.nextActionDate || null,
        lastTouchedAt: new Date(),
      })
      .returning({ id: buyers.id });
    revalidatePath("/selling");
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("createBuyer failed:", e);
    return { ok: false, error: (e as Error).message ?? "Insert failed" };
  }
}

export type UpdateBuyerInput = Partial<CreateBuyerInput> & { id: string };

export async function updateBuyer(
  input: UpdateBuyerInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!input.id) return { ok: false, error: "Missing id." };
    const patch: Partial<typeof buyers.$inferInsert> = {
      updatedAt: new Date(),
      lastTouchedAt: new Date(),
    };
    if (input.name !== undefined) {
      const t = (input.name ?? "").trim();
      if (!t) return { ok: false, error: "Name cannot be blank." };
      patch.name = t;
    }
    if (input.contactName !== undefined) patch.contactName = input.contactName?.trim() || null;
    if (input.contactEmail !== undefined) patch.contactEmail = input.contactEmail?.trim() || null;
    if (input.contactPhone !== undefined) patch.contactPhone = input.contactPhone?.trim() || null;
    if (input.country !== undefined) patch.country = input.country?.trim() || null;
    if (input.stage !== undefined && input.stage) {
      if (!STAGES.includes(input.stage)) return { ok: false, error: "Unknown stage." };
      patch.stage = input.stage;
    }
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
    if (input.pricingNotes !== undefined) patch.pricingNotes = input.pricingNotes?.trim() || null;
    if (input.nextAction !== undefined) patch.nextAction = input.nextAction?.trim() || null;
    if (input.nextActionDate !== undefined) patch.nextActionDate = input.nextActionDate || null;
    await db.update(buyers).set(patch).where(eq(buyers.id, input.id));
    revalidatePath("/selling");
    return { ok: true };
  } catch (e) {
    console.error("updateBuyer failed:", e);
    return { ok: false, error: (e as Error).message ?? "Update failed" };
  }
}

export async function deleteBuyer(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  await db.delete(buyers).where(eq(buyers.id, id));
  revalidatePath("/selling");
  return { ok: true };
}
