// Buyers — read paths.

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { buyers, type Buyer } from "@/db/schema";

export type BuyerStage = "lead" | "in_conversation" | "negotiating" | "active" | "lost";

export type BuyerRow = Buyer;

export const STAGE_ORDER: BuyerStage[] = ["lead", "in_conversation", "negotiating", "active", "lost"];

export const STAGE_META: Record<BuyerStage, { label: string; color: string }> = {
  lead:             { label: "Lead",            color: "var(--text-2)" },
  in_conversation:  { label: "In conversation", color: "var(--sky)" },
  negotiating:      { label: "Negotiating",     color: "var(--amber)" },
  active:           { label: "Active",          color: "var(--green)" },
  lost:             { label: "Lost",            color: "var(--text-3)" },
};

export async function getBuyers(): Promise<BuyerRow[]> {
  return db
    .select()
    .from(buyers)
    .orderBy(asc(buyers.stage), desc(buyers.updatedAt));
}

export async function getBuyerById(id: string): Promise<BuyerRow | null> {
  const [row] = await db.select().from(buyers).where(eq(buyers.id, id)).limit(1);
  return row ?? null;
}
