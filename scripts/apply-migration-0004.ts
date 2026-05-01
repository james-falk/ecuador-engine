// Migration 0004: harvests rebuild — split farm-side from processor-side.
//
//   • Create `farm_harvests` table (the picking event) with flower_count,
//     bucket_count, notes, recorded_by, timestamps.
//   • Add `farm_harvest_id` (nullable uuid, FK -> farm_harvests.id) to the
//     existing `harvests` table so a delivery can be tagged with the
//     picking event it came from. v1 is 1:1; M:N support added later via
//     a separate junction table when the data calls for it.
//   • Indexes on harvest_date and farm_harvest_id for the per-day list +
//     join-back paths.
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TABLE farm_harvests",
    sql: `CREATE TABLE "farm_harvests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid,
      "harvest_date" date NOT NULL,
      "flower_count" integer,
      "bucket_count" integer,
      "notes" text,
      "recorded_by" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      "last_touched_at" timestamp with time zone
    )`,
  },
  {
    label: "INDEX farm_harvests(harvest_date)",
    sql: `CREATE INDEX IF NOT EXISTS "farm_harvests_harvest_date_idx" ON "farm_harvests"("harvest_date" DESC)`,
  },
  {
    label: "ADD COLUMN harvests.farm_harvest_id",
    sql: `ALTER TABLE "harvests" ADD COLUMN IF NOT EXISTS "farm_harvest_id" uuid`,
  },
  {
    label: "FK harvests.farm_harvest_id -> farm_harvests.id",
    sql: `ALTER TABLE "harvests"
            ADD CONSTRAINT "harvests_farm_harvest_id_farm_harvests_id_fk"
            FOREIGN KEY ("farm_harvest_id")
            REFERENCES "public"."farm_harvests"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION`,
  },
  {
    label: "INDEX harvests(farm_harvest_id)",
    sql: `CREATE INDEX IF NOT EXISTS "harvests_farm_harvest_id_idx" ON "harvests"("farm_harvest_id")`,
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
      if (/already exists/i.test(msg) || /duplicate column/i.test(msg)) {
        console.log(`     SKIPPED (already exists): ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0004: harvests rebuild ===");
  await run(STATEMENTS);
  console.log("\nMigration 0004 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0004 FAILED:", e);
    process.exit(1);
  });
