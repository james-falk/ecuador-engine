// Migration 0002: align with the master-sheet semantics James clarified.
//   - Add `operating_bills` value to expense_category_type
//   - Create `cash_movements` table + direction enum
//   - Move existing labor_water rows to operating_bills (Water = water deliveries,
//     not a person)
//
// Doesn't drop labor_water from the enum — Postgres makes that a multi-step
// dance and the value is harmless once unreferenced. Code stops emitting it.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "ADD VALUE operating_bills to expense_category_type",
    sql: `ALTER TYPE "public"."expense_category_type" ADD VALUE IF NOT EXISTS 'operating_bills'`,
  },
  {
    label: "CREATE TYPE cash_movement_direction",
    sql: `CREATE TYPE "public"."cash_movement_direction" AS ENUM('in_to_ec', 'out_to_us')`,
  },
  {
    label: "CREATE TABLE cash_movements",
    sql: `CREATE TABLE "cash_movements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid,
      "transfer_date" date NOT NULL,
      "week_start_date" date NOT NULL,
      "direction" "cash_movement_direction" NOT NULL,
      "amount_usd" numeric(12, 2) NOT NULL,
      "counterparty" text,
      "notes" text,
      "account_id" uuid NOT NULL,
      "source" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_touched_at" timestamp with time zone
    )`,
  },
  {
    label: "FK cash_movements.account_id → accounts.id",
    sql: `ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action`,
  },
];

const POST_STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    // Has to be in a separate transaction from the ADD VALUE above (Postgres
    // can't use a freshly-added enum value in the same tx).
    label: "Migrate existing labor_water rows → operating_bills",
    sql: `UPDATE expense_entries
            SET category_type = 'operating_bills',
                category_label = 'Water',
                last_touched_at = now()
          WHERE category_type = 'labor_water'`,
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
      // Tolerate "already exists" on idempotent re-runs.
      if (/already exists/i.test(msg)) {
        console.log(`     SKIPPED (already exists): ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Phase 1: schema additions ===");
  await run(STATEMENTS);
  console.log("\n=== Phase 2: data migration (separate run so the enum value is committed) ===");
  await run(POST_STATEMENTS);
  console.log("\nMigration 0002 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0002 FAILED:", e);
    process.exit(1);
  });
