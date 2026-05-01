// Migration 0006: tasks priority enum + blocked_reason.
//   • Replace `priority smallint` with a 3-value enum (low/medium/high).
//   • Add `blocked_reason text` for when status='blocked'.
//
// Old smallint values map: >=1 → high, 0 → medium, others → low.
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TYPE task_priority",
    sql: `CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high')`,
  },
  {
    label: "ADD COLUMN tasks.priority_v2",
    sql: `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority_v2" "task_priority" NOT NULL DEFAULT 'medium'`,
  },
  {
    label: "BACKFILL priority_v2 from old smallint",
    sql: `UPDATE "tasks" SET "priority_v2" = CASE
            WHEN "priority" >= 1 THEN 'high'::task_priority
            WHEN "priority" = 0 THEN 'medium'::task_priority
            ELSE 'low'::task_priority
          END`,
  },
  {
    label: "DROP old priority column",
    sql: `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "priority"`,
  },
  {
    label: "RENAME priority_v2 -> priority",
    sql: `ALTER TABLE "tasks" RENAME COLUMN "priority_v2" TO "priority"`,
  },
  {
    label: "ADD COLUMN tasks.blocked_reason",
    sql: `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocked_reason" text`,
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
      if (
        /already exists/i.test(msg) ||
        /duplicate column/i.test(msg) ||
        /does not exist/i.test(msg) // for the rename if priority_v2 was already renamed
      ) {
        console.log(`     SKIPPED: ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0006: tasks priority enum + blocked_reason ===");
  await run(STATEMENTS);
  console.log("\nMigration 0006 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0006 FAILED:", e);
    process.exit(1);
  });
