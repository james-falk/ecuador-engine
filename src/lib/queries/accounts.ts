// Accounts pillar — minimal v1 surface. The single Finca EC account is the
// source/destination of all v1 cash flows; future expansion adds more rows.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

export async function getDefaultAccountId(slug = "finca-ec"): Promise<string | null> {
  const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.slug, slug)).limit(1);
  return row?.id ?? null;
}
