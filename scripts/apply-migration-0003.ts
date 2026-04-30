// Migration 0003: tasks table for the Pending Items pillar.
//   - Create task_status enum
//   - Create tasks table with assignee + company + tags + due_date + priority
//   - Indexes: status (partial), assignee, company, due_date (partial)
//
// Idempotent: tolerates "already exists" on re-runs.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TYPE task_status",
    sql: `CREATE TYPE "public"."task_status" AS ENUM(
      'open', 'in_progress', 'blocked', 'done', 'archived'
    )`,
  },
  {
    label: "CREATE TABLE tasks",
    sql: `CREATE TABLE "tasks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid,
      "title" text NOT NULL,
      "description" text,
      "status" "task_status" NOT NULL DEFAULT 'open',
      "assignee_person_id" uuid,
      "related_company_id" uuid,
      "tags" text[] NOT NULL DEFAULT '{}'::text[],
      "due_date" date,
      "priority" smallint NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      "completed_at" timestamp with time zone,
      "source" text
    )`,
  },
  {
    label: "FK tasks.assignee_person_id → people.id",
    sql: `ALTER TABLE "tasks"
            ADD CONSTRAINT "tasks_assignee_person_id_people_id_fk"
            FOREIGN KEY ("assignee_person_id")
            REFERENCES "public"."people"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION`,
  },
  {
    label: "FK tasks.related_company_id → companies.id",
    sql: `ALTER TABLE "tasks"
            ADD CONSTRAINT "tasks_related_company_id_companies_id_fk"
            FOREIGN KEY ("related_company_id")
            REFERENCES "public"."companies"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION`,
  },
  {
    label: "INDEX tasks(status)",
    sql: `CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status")`,
  },
  {
    label: "INDEX tasks(assignee_person_id)",
    sql: `CREATE INDEX IF NOT EXISTS "tasks_assignee_idx" ON "tasks"("assignee_person_id")`,
  },
  {
    label: "INDEX tasks(related_company_id)",
    sql: `CREATE INDEX IF NOT EXISTS "tasks_company_idx" ON "tasks"("related_company_id")`,
  },
  {
    label: "INDEX tasks(due_date)",
    sql: `CREATE INDEX IF NOT EXISTS "tasks_due_idx" ON "tasks"("due_date")`,
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
        console.log(`     SKIPPED (already exists): ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0003: tasks ===");
  await run(STATEMENTS);
  console.log("\nMigration 0003 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0003 FAILED:", e);
    process.exit(1);
  });
