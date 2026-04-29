import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Bank / cash accounts the engine tracks money flowing into and out of.
// v1 ships with a single seeded account: the Finca del Dragón Ecuadorian bank
// account, which receives Liquidación net pay AND pays out worker payments.
// When a second account appears (Enigma US, Isaac float, James personal), that
// is the trigger for adding a `cash_movements` table to model transfers.
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  // URL-safe handle. Routes / cross-pillar refs use the slug, never the UUID.
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // ISO-4217 code. Defaults to USD because Ecuador is officially USD and
  // PureSol's US side is USD too — no FX in v1.
  currency: text("currency").notNull().default("USD"),
  country: text("country"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
