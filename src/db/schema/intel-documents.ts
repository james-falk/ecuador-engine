import { sql } from "drizzle-orm";
import { date, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Generic document store for agent ingest. Any external system can POST
// daily snapshots without us pre-defining the schema. Engine code reads
// the jsonb later to derive whatever's needed (market dashboards,
// price comparisons, alerts).
export const intelDocuments = pgTable("intel_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  // What this document is about. Free text. Examples:
  //   "market_data" / "customs_manifest" / "competitor_pricing"
  topic: text("topic").notNull(),
  // Where it came from. Free text. Examples:
  //   "usda-ams" / "importyeti" / "manual" / "scraper-X"
  source: text("source").notNull(),
  // The day the data is "about" — queryable. NOT inserted_at.
  forDate: date("for_date").notNull(),
  // The actual document. Whatever shape the source produced.
  payload: jsonb("payload").notNull(),
  // Optional dedupe key supplied by the caller. Unique-when-not-null index
  // means a retry with the same key is a no-op.
  idempotencyKey: text("idempotency_key"),
  insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().default(sql`now()`),
  // Free-text attribution: agent name, person, etc. Useful for triage.
  insertedBy: text("inserted_by"),
});

export type IntelDocument = typeof intelDocuments.$inferSelect;
export type NewIntelDocument = typeof intelDocuments.$inferInsert;
