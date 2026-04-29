"use server";

// Server actions for the compliance pillar. These are the write paths the UI
// calls when the operator changes a status, fills in an identifier, or edits
// notes. The UI passes the design's status string; we map to the DB enum here.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { complianceItems } from "@/db/schema";
import type { ComplianceStatus } from "@/lib/data";

const STATUSES: ComplianceStatus[] = [
  "verified",
  "todo",
  "blocked",
  "na",
  "in_flight",
  "consultant_claims_done",
];

// Design uses `na`; DB uses `not_applicable`. Keep the mapping local so the
// design doesn't have to learn the DB enum name.
function toDbStatus(s: ComplianceStatus): typeof complianceItems.$inferSelect.status {
  if (s === "na") return "not_applicable";
  return s;
}

export type UpdateInput = {
  id: string;
  status: ComplianceStatus;
  identifier: string | null;
  notes: string;
};

export async function updateComplianceItem(input: UpdateInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: `Unknown status: ${input.status}` };

  await db
    .update(complianceItems)
    .set({
      status: toDbStatus(input.status),
      identifier: input.identifier?.trim() ? input.identifier.trim() : null,
      notes: input.notes,
      lastTouchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(complianceItems.id, input.id));

  // Refresh both the home (which shows the verified count) and any company
  // page where this item appears. Using "/" for home + the wildcard pattern
  // for /companies/[slug] would require knowing the slug; revalidating the
  // whole layout is cheap enough for an internal app.
  revalidatePath("/", "layout");
  return { ok: true };
}
