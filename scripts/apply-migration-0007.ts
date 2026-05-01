// Migration 0007: harvest pipeline rebuild.
//   • Make harvests.processor_company_id nullable (so historical lump-sum
//     entries can sit unattributed instead of being falsely tagged INCALPACK).
//   • Drop the harvest_id-unique constraint on harvest_settlements so a
//     single harvest can have multiple settlement rows (advance + balance +
//     future stages).
//   • Add a `kind` enum on harvest_settlements (advance / balance / lump_sum).
//   • Add flowers-picked stage on farm_harvests (optional pre-step).
//   • Strip the assumed INCALPACK processor from master-sheet-sourced rows
//     (set processor_company_id to NULL where lot_number begins
//     "master_sheet:").
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "DROP NOT NULL on harvests.processor_company_id",
    sql: `ALTER TABLE "harvests" ALTER COLUMN "processor_company_id" DROP NOT NULL`,
  },
  {
    label: "DROP unique constraint on harvest_settlements.harvest_id",
    sql: `ALTER TABLE "harvest_settlements" DROP CONSTRAINT IF EXISTS "harvest_settlements_harvest_id_unique"`,
  },
  {
    label: "CREATE TYPE settlement_kind",
    sql: `CREATE TYPE "settlement_kind" AS ENUM ('advance', 'balance', 'lump_sum')`,
  },
  {
    label: "ADD COLUMN harvest_settlements.kind",
    sql: `ALTER TABLE "harvest_settlements" ADD COLUMN IF NOT EXISTS "kind" "settlement_kind" NOT NULL DEFAULT 'lump_sum'`,
  },
  {
    label: "ADD COLUMN harvest_settlements.expected_total_usd",
    sql: `ALTER TABLE "harvest_settlements" ADD COLUMN IF NOT EXISTS "expected_total_usd" numeric(12,2)`,
  },
  {
    label: "ADD COLUMN farm_harvests.flowers_picked_date",
    sql: `ALTER TABLE "farm_harvests" ADD COLUMN IF NOT EXISTS "flowers_picked_date" date`,
  },
  {
    label: "ADD COLUMN farm_harvests.flowers_picked_count",
    sql: `ALTER TABLE "farm_harvests" ADD COLUMN IF NOT EXISTS "flowers_picked_count" integer`,
  },
  {
    label: "STRIP INCALPACK from master-sheet-sourced harvests",
    sql: `UPDATE "harvests" SET "processor_company_id" = NULL WHERE "lot_number" LIKE 'master_sheet:%'`,
  },
];

async function run(stmts: Array<{ label: string; sql: string }>) {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    console.log(`[${i + 1}/${stmts.length}] ${s.label}`);
    try {
      const result = await db.execute(sql.raw(s.sql));
      // For UPDATEs Postgres reports rowCount; surface it.
      const rc = (result as { rowCount?: number }).rowCount;
      if (typeof rc === "number") console.log(`     ${rc} rows affected`);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (
        /already exists/i.test(msg) ||
        /duplicate column/i.test(msg) ||
        /does not exist/i.test(msg)
      ) {
        console.log(`     SKIPPED: ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0007: harvest pipeline rebuild ===");
  await run(STATEMENTS);
  console.log("\nMigration 0007 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0007 FAILED:", e);
    process.exit(1);
  });
