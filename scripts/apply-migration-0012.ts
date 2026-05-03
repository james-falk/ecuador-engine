// Migration 0012: intel_documents — generic document store for agent ingest.
//
// Pattern: any agent (running here or externally) POSTs daily snapshots
// to /api/intel/ingest with a topic, source, and date. Payload is jsonb
// so we don't have to pre-define schemas — the engine reads it later and
// derives whatever it needs.
//
//   topic    — what the document is about. Free text. Examples:
//              "market_data", "customs_manifest", "competitor_pricing".
//   source   — where it came from. Free text. Examples:
//              "usda-ams", "importyeti", "manual", "scraper-X".
//   for_date — the date the data is "about" (queryable). NOT inserted_at.
//   payload  — the actual document. Whatever shape the source produced.
//
// Idempotency: caller can supply an `idempotency_key` so retries don't
// double-insert. Paired with a unique index.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TABLE intel_documents",
    sql: `CREATE TABLE "intel_documents" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "topic" text NOT NULL,
      "source" text NOT NULL,
      "for_date" date NOT NULL,
      "payload" jsonb NOT NULL,
      "idempotency_key" text,
      "inserted_at" timestamp with time zone NOT NULL DEFAULT now(),
      "inserted_by" text
    )`,
  },
  {
    label: "INDEX intel_documents(topic, for_date)",
    sql: `CREATE INDEX IF NOT EXISTS "intel_documents_topic_date_idx" ON "intel_documents"("topic", "for_date")`,
  },
  {
    label: "INDEX intel_documents(source)",
    sql: `CREATE INDEX IF NOT EXISTS "intel_documents_source_idx" ON "intel_documents"("source")`,
  },
  {
    label: "UNIQUE INDEX intel_documents(idempotency_key) WHERE NOT NULL",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "intel_documents_idempotency_key_unique" ON "intel_documents"("idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
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
  console.log("=== Migration 0012: intel_documents ===");
  await run(STATEMENTS);
  console.log("\nMigration 0012 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0012 FAILED:", e);
    process.exit(1);
  });
