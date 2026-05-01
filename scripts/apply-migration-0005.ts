// Migration 0005: oauth_tokens — encrypted Google refresh tokens for
// the deployed engine's own Drive/Gmail OAuth (separate from local MCP).
//
// Idempotent: tolerates "already exists" errors so re-running is safe.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TABLE oauth_tokens",
    sql: `CREATE TABLE "oauth_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "account_email" text NOT NULL UNIQUE,
      "refresh_token_encrypted" text NOT NULL,
      "access_token_encrypted" text,
      "access_token_expires_at" timestamp with time zone,
      "scopes" text[] NOT NULL,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      "last_used_at" timestamp with time zone
    )`,
  },
  {
    label: "INDEX oauth_tokens(account_email)",
    sql: `CREATE INDEX IF NOT EXISTS "oauth_tokens_account_email_idx" ON "oauth_tokens"("account_email")`,
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
  console.log("=== Migration 0005: oauth_tokens ===");
  await run(STATEMENTS);
  console.log("\nMigration 0005 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0005 FAILED:", e);
    process.exit(1);
  });
