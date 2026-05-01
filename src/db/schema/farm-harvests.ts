import { sql } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Farm-harvest event = the picking. Counts flowers + buckets harvested
// off the farm on a given day. The delivery side (which processor got
// the buckets, what they reported back, the payment) lives in the
// existing `harvests` + `harvest_settlements` tables.
//
// Many-to-many between farm_harvests and harvests (deliveries) is
// supported by allowing the same farm_harvest to be referenced by
// multiple delivery records, and a single delivery to aggregate buckets
// from multiple farm_harvests via the link table — added later when the
// data demands it. v1: a farm_harvest stands alone; the operator can
// optionally tag a delivery with a `farm_harvest_id` (added on the
// `harvests` table in this migration) so 1:1 links work without the
// junction.
//
// Buckets are the operational unit (per James's brief). Approximate kg
// is calculated downstream when needed.
export const farmHarvests = pgTable("farm_harvests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  // Day the picking happened.
  harvestDate: date("harvest_date").notNull(),
  // Count of dragon-fruit flowers tracked that day. Pre-fruit signal —
  // helps James plan the upcoming harvest pulse.
  flowerCount: integer("flower_count"),
  // Buckets of fruit picked. The primary operational unit. Optional for
  // flower-only entries (counting flowers before fruit forms).
  bucketCount: integer("bucket_count"),
  // Free-form context (which lots, weather, anything noteworthy).
  notes: text("notes"),
  // Soft tag of who recorded it (Isaac, James, etc.). Free text for now;
  // can become an FK to people later.
  recordedBy: text("recorded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

export type FarmHarvest = typeof farmHarvests.$inferSelect;
export type NewFarmHarvest = typeof farmHarvests.$inferInsert;
