import { sql } from "drizzle-orm";
import {
  date,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { accounts } from "./accounts";

// One row per delivery to a processor. v1 collapses "picked" and "delivered"
// into a single event — if pre-delivery tracking becomes a need, add a
// `picked_date date` column without changing the row's identity. The row's
// state is implicit: a LEFT JOIN against `harvest_settlements` tells you
// whether the Liquidación has come back (settlement row exists) or is still
// pending (no settlement row yet). A "rejected" lot is a settlement row with
// kg_processed = 0 — there's no separate status enum.
export const harvests = pgTable("harvests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  // Date the batch left the farm for the processor.
  harvestDate: date("harvest_date").notNull(),
  // Monday of the ISO week containing harvest_date — denormalized so the
  // weekly grid doesn't recompute on every read and so we don't have to deal
  // with year-boundary ISO-week wraparound.
  weekStartDate: date("week_start_date").notNull(),
  // Where the batch went. Required because we always know the processor at
  // delivery time (it's literally the truck destination).
  processorCompanyId: uuid("processor_company_id")
    .notNull()
    .references(() => companies.id),
  lotNumber: text("lot_number"),
  kgDelivered: numeric("kg_delivered", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  // Optional Drive link to the delivery slip / photo from Isaac.
  evidenceUrl: text("evidence_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

// 1:1 with harvests. Captures the Liquidación PDF the processor returns.
// Every numeric is a real Postgres `numeric` (not float) so accounting math
// is exact; in TS these round-trip as strings.
export const harvestSettlements = pgTable("harvest_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  harvestId: uuid("harvest_id")
    .notNull()
    .unique()
    .references(() => harvests.id, { onDelete: "cascade" }),
  settlementDate: date("settlement_date").notNull(),
  // Weights from the PDF.
  kgManifested: numeric("kg_manifested", { precision: 10, scale: 2 }).notNull(),
  kgProcessed: numeric("kg_processed", { precision: 10, scale: 2 }).notNull(),
  kgWaste: numeric("kg_waste", { precision: 10, scale: 2 }).notNull(),
  // Convenience: kgWaste / kgManifested * 100. Stored to avoid recomputing
  // and to faithfully reflect the value the PDF prints (which sometimes
  // rounds differently than our division would).
  wastePct: numeric("waste_pct", { precision: 5, scale: 2 }),
  // Per-grade kilos. Three columns is denormalization with intent: INCALPACK's
  // Liquidación format is stable on these three tiers. `gradeBreakdown` is
  // the escape hatch — populate it when a future processor reports more or
  // different grades; that's the trigger to migrate to a child line-item table.
  grade1_5Kg: numeric("grade_1_5_kg", { precision: 10, scale: 2 }),
  grade2Kg: numeric("grade_2_kg", { precision: 10, scale: 2 }),
  gradeSmallKg: numeric("grade_small_kg", { precision: 10, scale: 2 }),
  // Per-grade rates. Denormalized so we capture the rate the processor
  // actually used at settlement time — rates change, history shouldn't.
  grade1_5RateUsd: numeric("grade_1_5_rate_usd", { precision: 8, scale: 4 }),
  grade2RateUsd: numeric("grade_2_rate_usd", { precision: 8, scale: 4 }),
  gradeSmallRateUsd: numeric("grade_small_rate_usd", { precision: 8, scale: 4 }),
  // Future-proofing overflow. Empty until a processor diverges.
  gradeBreakdown: jsonb("grade_breakdown"),
  // Money. subtotal = sum(grade_kg * grade_rate). retention = packer hold-back.
  // net_pay = subtotal - retention. All match the PDF line-by-line.
  subtotalUsd: numeric("subtotal_usd", { precision: 12, scale: 2 }).notNull(),
  retentionUsd: numeric("retention_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  netPayUsd: numeric("net_pay_usd", { precision: 12, scale: 2 }).notNull(),
  // Where the cash actually settled. v1: always Finca EC. Required so the
  // weekly grid can join settlements-in to the same account that's paying
  // expenses out, computing net cash position per week without a
  // cash_movements table.
  paidToAccountId: uuid("paid_to_account_id")
    .notNull()
    .references(() => accounts.id),
  paidDate: date("paid_date"),
  // Drive link to the Liquidación PDF artifact.
  pdfUrl: text("pdf_url"),
  // Free-text waste reasons: "daños en la corteza, manchas amarillas, …"
  wasteObservations: text("waste_observations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

export type Harvest = typeof harvests.$inferSelect;
export type NewHarvest = typeof harvests.$inferInsert;
export type HarvestSettlement = typeof harvestSettlements.$inferSelect;
export type NewHarvestSettlement = typeof harvestSettlements.$inferInsert;
