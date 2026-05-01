import { sql } from "drizzle-orm";
import {
  date,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { accounts } from "./accounts";

// Settlement stages. A harvest can have multiple rows: an advance up-front,
// then a balance when the final lands. Historical lump-sum entries (the
// "Harvest payments received" master-sheet column) carry kind='lump_sum'.
export const settlementKindEnum = pgEnum("settlement_kind", ["advance", "balance", "lump_sum"]);

// One row per delivery to a processor. v1 collapses "picked" and "delivered"
// into a single event — if pre-delivery tracking becomes a need, add a
// `picked_date date` column without changing the row's identity. The row's
// state is implicit: a LEFT JOIN against `harvest_settlements` tells you
// whether the processor report has come back (settlement row exists) or is
// still pending (no settlement row yet). A "rejected" lot is a settlement row
// with kg_processed = 0 — there's no separate status enum.
export const harvests = pgTable("harvests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  // Date the batch left the farm for the processor.
  harvestDate: date("harvest_date").notNull(),
  // Monday of the ISO week containing harvest_date — denormalized so the
  // weekly grid doesn't recompute on every read and so we don't have to deal
  // with year-boundary ISO-week wraparound.
  weekStartDate: date("week_start_date").notNull(),
  // Where the batch went. Nullable so historical lump-sum entries (where the
  // processor was an assumption) can sit unattributed. New rows entered going
  // forward should always carry a processor.
  processorCompanyId: uuid("processor_company_id").references(() => companies.id),
  lotNumber: text("lot_number"),
  kgDelivered: numeric("kg_delivered", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  // Optional Drive link to the delivery slip / photo from Isaac.
  evidenceUrl: text("evidence_url"),
  // Optional link to a farm_harvest (picking event). v1 is 1:1; if a
  // delivery aggregates buckets from multiple farm_harvest events, we
  // add a junction table later. NULL = unlinked or pre-feature data.
  farmHarvestId: uuid("farm_harvest_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

// One or more rows per harvest. Captures the processor's report PDF +
// payment(s). Multiple rows allow advance/balance partial payments.
// Every numeric is a real Postgres `numeric` (not float) so accounting math
// is exact; in TS these round-trip as strings.
export const harvestSettlements = pgTable("harvest_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  // No `unique()` — a harvest can have multiple settlement rows (advance +
  // balance + future stages). Operational status = sum(payments) vs expected.
  harvestId: uuid("harvest_id")
    .notNull()
    .references(() => harvests.id, { onDelete: "cascade" }),
  kind: settlementKindEnum("kind").notNull().default("lump_sum"),
  // What we expect to be paid in total, set at delivery time (kg × rate).
  // Lets the pending tracker compute "remaining = expected − sum(received)".
  expectedTotalUsd: numeric("expected_total_usd", { precision: 12, scale: 2 }),
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
  // INCALPACK report format is stable on these three tiers. `gradeBreakdown` is
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
  // Drive link to the processor report PDF.
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
