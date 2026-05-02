import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Market-intel agent output. One row per (source, market, variety, carton)
// observation. Filled by the market-intel agent (Item #2) reading USDA AMS
// PDFs + customs manifests, then surfaced on /pricing (Item #4).
//
// `raw_blob` carries the full source row so a parser regression doesn't
// silently corrupt history — re-derivation from the blob is always possible.
export const pricingSnapshots = pgTable(
  "pricing_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // When the underlying source actually published the price (PDF date,
    // manifest filing date). Distinct from inserted_at, which is when we
    // wrote the row.
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    // Provenance string. Examples:
    //   "usda-ams-ny-terminal", "usda-ams-national-fob",
    //   "usda-ams-philly-terminal", "usda-ams-miami-terminal",
    //   "usda-ams-la-terminal", "importyeti".
    source: text("source").notNull(),
    // Coarser bucket than `source`. Examples: "NY-terminal", "national-fob",
    // "import-manifest". Drives the /pricing card filters.
    market: text("market").notNull(),
    // Free-text variety label, normalized lowercase-with-dashes upstream.
    // Examples: "red-skin-white-flesh", "red-skin-red-flesh",
    // "yellow-skin-white-flesh".
    variety: text("variety"),
    // Carton size as printed in the source. Examples: "4.5kg", "6lb", "10lb".
    cartonSize: text("carton_size"),
    // Origin country/region as printed in the source. Examples: "ecuador",
    // "vietnam", "nicaragua", "mexico".
    origin: text("origin"),
    priceLowUsd: numeric("price_low_usd", { precision: 10, scale: 2 }),
    priceHighUsd: numeric("price_high_usd", { precision: 10, scale: 2 }),
    // Full source row (parsed JSON). Audit trail; lets us re-derive the
    // typed columns above if the parser changes.
    rawBlob: jsonb("raw_blob"),
    insertedAt: timestamp("inserted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    // Primary access pattern: last-N snapshots by market for the trend card.
    marketCapturedIdx: index("pricing_snapshots_market_captured_idx").on(
      t.market,
      t.capturedAt,
    ),
    sourceIdx: index("pricing_snapshots_source_idx").on(t.source),
    originIdx: index("pricing_snapshots_origin_idx").on(t.origin),
  }),
);

export type PricingSnapshot = typeof pricingSnapshots.$inferSelect;
export type NewPricingSnapshot = typeof pricingSnapshots.$inferInsert;
