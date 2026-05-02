// Migration 0010: market-intel + buyer-scout schema (BUILD_LOG item #1).
//   • Create `pricing_snapshots` (market-intel agent output).
//   • Create `lead_proposals` (buyer-scout agent output, with unique
//     `dedupe_key`).
//   • Create `lead_contact_history` (per-touchpoint interaction log; FKs
//     into `companies` and `lead_proposals`, both ON DELETE SET NULL).
//
// Hand-rolled because the nightly build env has no DATABASE_URL — running
// drizzle-kit generate would throw at config load. Idempotent: every
// statement uses IF NOT EXISTS or a duplicate-object DO block, and the
// runner swallows "already exists" / "duplicate column" errors so re-runs
// are safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  // ── enums ──────────────────────────────────────────────────────────
  {
    label: "CREATE TYPE lead_proposal_status",
    sql: `DO $$ BEGIN
      CREATE TYPE "lead_proposal_status" AS ENUM ('proposed', 'approved', 'rejected', 'deferred');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: "CREATE TYPE lead_interaction_type",
    sql: `DO $$ BEGIN
      CREATE TYPE "lead_interaction_type" AS ENUM ('outreach_sent', 'reply_received', 'call', 'meeting', 'sample_sent', 'quote_sent', 'closed');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },

  // ── pricing_snapshots ──────────────────────────────────────────────
  {
    label: "CREATE TABLE pricing_snapshots",
    sql: `CREATE TABLE IF NOT EXISTS "pricing_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "captured_at" timestamp with time zone NOT NULL,
      "source" text NOT NULL,
      "market" text NOT NULL,
      "variety" text,
      "carton_size" text,
      "origin" text,
      "price_low_usd" numeric(10, 2),
      "price_high_usd" numeric(10, 2),
      "raw_blob" jsonb,
      "inserted_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "INDEX pricing_snapshots(market, captured_at)",
    sql: `CREATE INDEX IF NOT EXISTS "pricing_snapshots_market_captured_idx" ON "pricing_snapshots"("market", "captured_at")`,
  },
  {
    label: "INDEX pricing_snapshots(source)",
    sql: `CREATE INDEX IF NOT EXISTS "pricing_snapshots_source_idx" ON "pricing_snapshots"("source")`,
  },
  {
    label: "INDEX pricing_snapshots(origin)",
    sql: `CREATE INDEX IF NOT EXISTS "pricing_snapshots_origin_idx" ON "pricing_snapshots"("origin")`,
  },

  // ── lead_proposals ─────────────────────────────────────────────────
  {
    label: "CREATE TABLE lead_proposals",
    sql: `CREATE TABLE IF NOT EXISTS "lead_proposals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "captured_at" timestamp with time zone NOT NULL,
      "source" text NOT NULL,
      "source_url" text,
      "company_name" text NOT NULL,
      "website_canonical" text,
      "contact_email_canonical" text,
      "contact_phone_canonical" text,
      "volume_signal" text,
      "evidence_blob" jsonb,
      "score" integer,
      "status" "lead_proposal_status" NOT NULL DEFAULT 'proposed',
      "dedupe_key" text NOT NULL,
      "inserted_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "UNIQUE INDEX lead_proposals(dedupe_key)",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "lead_proposals_dedupe_key_unique" ON "lead_proposals"("dedupe_key")`,
  },
  {
    label: "INDEX lead_proposals(status)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_proposals_status_idx" ON "lead_proposals"("status")`,
  },
  {
    label: "INDEX lead_proposals(source)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_proposals_source_idx" ON "lead_proposals"("source")`,
  },
  {
    label: "INDEX lead_proposals(captured_at)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_proposals_captured_idx" ON "lead_proposals"("captured_at")`,
  },

  // ── lead_contact_history ───────────────────────────────────────────
  {
    label: "CREATE TABLE lead_contact_history",
    sql: `CREATE TABLE IF NOT EXISTS "lead_contact_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "buyer_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
      "lead_proposal_id" uuid REFERENCES "lead_proposals"("id") ON DELETE SET NULL,
      "interaction_type" "lead_interaction_type" NOT NULL,
      "interaction_at" timestamp with time zone NOT NULL,
      "note" text,
      "drafted_by" text,
      "captured_at" timestamp with time zone NOT NULL DEFAULT now(),
      "inserted_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "INDEX lead_contact_history(buyer_id)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_contact_history_buyer_idx" ON "lead_contact_history"("buyer_id")`,
  },
  {
    label: "INDEX lead_contact_history(lead_proposal_id)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_contact_history_lead_proposal_idx" ON "lead_contact_history"("lead_proposal_id")`,
  },
  {
    label: "INDEX lead_contact_history(interaction_at)",
    sql: `CREATE INDEX IF NOT EXISTS "lead_contact_history_interaction_at_idx" ON "lead_contact_history"("interaction_at")`,
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
  console.log("=== Migration 0010: market-intel + buyer-scout schema ===");
  await run(STATEMENTS);
  console.log("\nMigration 0010 complete.");
  console.log(
    "Smoke check (with DATABASE_URL): pnpm tsx scripts/check-tables.ts",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0010 FAILED:", e);
    process.exit(1);
  });
