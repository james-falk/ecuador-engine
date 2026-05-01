"use server";

// Pin / unpin Drive files to a company so they appear on the Companies →
// Documents tab.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { entityDriveFiles, companies } from "@/db/schema";

export type PinDriveFileInput = {
  companyId: string;
  driveFileId: string;
  driveFileName: string;
  driveViewLink: string;
  driveMimeType?: string | null;
  driveModifiedTime?: string | null; // ISO timestamp
  notes?: string | null;
};

export async function pinDriveFile(
  input: PinDriveFileInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (!input.companyId) return { ok: false, error: "companyId required" };
    if (!input.driveFileId) return { ok: false, error: "driveFileId required" };

    // Sanity: company must exist.
    const [co] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
    if (!co) return { ok: false, error: "Company not found" };

    const [row] = await db
      .insert(entityDriveFiles)
      .values({
        companyId: input.companyId,
        driveFileId: input.driveFileId,
        driveFileName: input.driveFileName,
        driveViewLink: input.driveViewLink,
        driveMimeType: input.driveMimeType ?? null,
        driveModifiedTime: input.driveModifiedTime ? new Date(input.driveModifiedTime) : null,
        notes: input.notes?.trim() || null,
      })
      .returning({ id: entityDriveFiles.id });

    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("pinDriveFile failed:", e);
    return { ok: false, error: (e as Error).message ?? "Pin failed" };
  }
}

export async function unpinDriveFile(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "id required" };
  await db.delete(entityDriveFiles).where(eq(entityDriveFiles.id, id));
  revalidatePath("/companies");
  return { ok: true };
}
