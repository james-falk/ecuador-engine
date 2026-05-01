// Migration 0008: entity_drive_files — pin Drive files to a company so
// the Companies → Documents tab shows them alongside the auto-pulled ones
// (settlement PDFs, harvest evidence, compliance evidence).
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TABLE entity_drive_files",
    sql: `CREATE TABLE "entity_drive_files" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
      "drive_file_id" text NOT NULL,
      "drive_file_name" text NOT NULL,
      "drive_view_link" text NOT NULL,
      "drive_mime_type" text,
      "drive_modified_time" timestamp with time zone,
      "pinned_by_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
      "pinned_at" timestamp with time zone NOT NULL DEFAULT now(),
      "notes" text
    )`,
  },
  {
    label: "INDEX entity_drive_files(company_id)",
    sql: `CREATE INDEX IF NOT EXISTS "entity_drive_files_company_idx" ON "entity_drive_files"("company_id")`,
  },
  {
    label: "INDEX entity_drive_files(drive_file_id)",
    sql: `CREATE INDEX IF NOT EXISTS "entity_drive_files_file_idx" ON "entity_drive_files"("drive_file_id")`,
  },
];

async function run(stmts: Array<{ label: string; sql: string }>) {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    console.log(`[${i + 1}/${stmts.length}] ${s.label}`);
    try {
      await db.execute(sql.raw(s.sql));
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (/already exists/i.test(msg)) {
        console.log(`     SKIPPED: ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0008: entity_drive_files ===");
  await run(STATEMENTS);
  console.log("\nMigration 0008 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0008 FAILED:", e);
    process.exit(1);
  });
