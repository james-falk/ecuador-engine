import { sql } from "drizzle-orm";
import { date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Stage of a buyer relationship. The Selling pillar groups by these.
export const buyerStageEnum = pgEnum("buyer_stage", [
  "lead",
  "in_conversation",
  "negotiating",
  "active",
  "lost",
]);

export const buyers = pgTable("buyers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  country: text("country"),
  stage: buyerStageEnum("stage").notNull().default("lead"),
  notes: text("notes"),
  // Pricing-related context. Free-text so any unique-to-this-buyer terms
  // (volume commitments, NET-30, FOB vs. CIF, etc.) live somewhere.
  pricingNotes: text("pricing_notes"),
  // Lightweight follow-up tracking — what's the next thing to do for this
  // buyer + when. Used for "next-action overdue" sorting later.
  nextAction: text("next_action"),
  nextActionDate: date("next_action_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

export type Buyer = typeof buyers.$inferSelect;
export type NewBuyer = typeof buyers.$inferInsert;
