// Migration 0013: activity_events — global audit log of who did what.
//
// Pattern: every server action that creates / updates / deletes a row
// also drops a row here. Cheap to read ("show me everything that
// happened in the last 24h"), no schema changes per pillar.
//
//   actor_person_id — who. nullable for system / agent actions.
//   action          — "create" / "update" / "delete" / "complete" /
//                     custom verbs ("pin_drive_file", "advance_stage").
//   entity_kind     — "task" / "harvest" / "expense" / "settlement" /
//                     "cash_movement" / "compliance" / etc.
//   entity_id       — uuid of the row touched (nullable for actions
//                     that don't refer to a single row).
//   summary         — short human-readable string for the activity feed.
//   metadata        — jsonb. Whatever else might be useful later.
//
// No FK on entity_id — pillars come and go, but an activity row should
// stick around even if the underlying row is later deleted.
//
// Idempotent: tolerates "already exists" errors.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TABLE activity_events",
    sql: `CREATE TABLE "activity_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "actor_person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
      "action" text NOT NULL,
      "entity_kind" text NOT NULL,
      "entity_id" uuid,
      "summary" text NOT NULL,
      "metadata" jsonb,
      "happened_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "INDEX activity_events(happened_at)",
    sql: `CREATE INDEX IF NOT EXISTS "activity_events_happened_at_idx" ON "activity_events"("happened_at" DESC)`,
  },
  {
    label: "INDEX activity_events(actor_person_id)",
    sql: `CREATE INDEX IF NOT EXISTS "activity_events_actor_idx" ON "activity_events"("actor_person_id")`,
  },
  {
    label: "INDEX activity_events(entity_kind, entity_id)",
    sql: `CREATE INDEX IF NOT EXISTS "activity_events_entity_idx" ON "activity_events"("entity_kind", "entity_id")`,
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
  console.log("=== Migration 0013: activity_events ===");
  await run(STATEMENTS);
  console.log("\nMigration 0013 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0013 FAILED:", e);
    process.exit(1);
  });
