import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { people } from "./people";

// Global audit log of who-did-what across the engine. Append-only; rows
// here outlive the underlying entities they describe.
export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Who. NULL for system actions (cron jobs, agents) or pre-auth changes.
  actorPersonId: uuid("actor_person_id").references(() => people.id, { onDelete: "set null" }),
  // Verb. Convention: present-tense lowercase. "create" / "update" /
  // "delete" / "complete" / custom verbs ("pin_drive_file", "advance_stage").
  action: text("action").notNull(),
  // Lowercase singular noun. "task", "harvest", "expense", "settlement",
  // "cash_movement", "compliance", "buyer", "drive_pin".
  entityKind: text("entity_kind").notNull(),
  // The row touched. Nullable for actions that don't refer to a single row
  // (e.g. a bulk import, a settings change).
  entityId: uuid("entity_id"),
  // Short human-readable string for the activity feed.
  summary: text("summary").notNull(),
  // Optional structured context. Whatever the action wants to remember
  // for later debugging / display.
  metadata: jsonb("metadata"),
  happenedAt: timestamp("happened_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
