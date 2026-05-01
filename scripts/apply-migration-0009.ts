// Migration 0009: simple email auth + person-attribution columns.
//   • Add `email` + `email_verified_at` to people (so we can match magic-link
//     submissions to a known person).
//   • Create `auth_sessions` (one row per active login).
//   • Add `last_touched_by_person_id` to mutating tables so server actions
//     can record who did what (initial scope: tasks; expand later).
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "ADD COLUMN people.email",
    sql: `ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "email" text`,
  },
  {
    label: "INDEX people(email)",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "people_email_unique" ON "people"(LOWER("email")) WHERE "email" IS NOT NULL`,
  },
  {
    label: "ADD COLUMN people.email_verified_at",
    sql: `ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone`,
  },
  {
    label: "CREATE TABLE auth_sessions",
    sql: `CREATE TABLE "auth_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL UNIQUE,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "expires_at" timestamp with time zone NOT NULL,
      "last_used_at" timestamp with time zone
    )`,
  },
  {
    label: "INDEX auth_sessions(person_id)",
    sql: `CREATE INDEX IF NOT EXISTS "auth_sessions_person_idx" ON "auth_sessions"("person_id")`,
  },
  {
    label: "CREATE TABLE auth_magic_links",
    sql: `CREATE TABLE "auth_magic_links" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL UNIQUE,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "expires_at" timestamp with time zone NOT NULL,
      "consumed_at" timestamp with time zone
    )`,
  },
  {
    label: "INDEX auth_magic_links(person_id)",
    sql: `CREATE INDEX IF NOT EXISTS "auth_magic_links_person_idx" ON "auth_magic_links"("person_id")`,
  },
  {
    label: "ADD COLUMN tasks.last_touched_by_person_id",
    sql: `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "last_touched_by_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL`,
  },
  // Seed emails for James/Peter/Isaac so they can log in immediately.
  // Idempotent: only sets email if not already set.
  {
    label: "SEED email james@kerrybros.com -> James",
    sql: `UPDATE "people" SET "email" = 'james@kerrybros.com' WHERE "name" = 'James' AND "role" = 'owner' AND "email" IS NULL`,
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
        console.log(`     SKIPPED: ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0009: simple email auth + attribution ===");
  await run(STATEMENTS);
  console.log("\nMigration 0009 complete.");
  console.log("\nReminder: set Peter's + Isaac's emails before they can log in:");
  console.log(`  UPDATE people SET email = '...' WHERE name = 'Peter';`);
  console.log(`  UPDATE people SET email = '...' WHERE name = 'Isaac';`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0009 FAILED:", e);
    process.exit(1);
  });
