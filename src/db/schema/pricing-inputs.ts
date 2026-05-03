import { sql } from "drizzle-orm";
import { integer, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// Single-row config table backing the editable cells of the Selling pricing
// model. Values mirror Ecuador/Selling in US/Documents/Pricing Sheet.xlsx.
// Keep the schema in lock-step with that sheet so a column-for-column
// rebuild stays accurate.
export const pricingInputs = pgTable("pricing_inputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  fruitCostPerKgUsd: numeric("fruit_cost_per_kg_usd", { precision: 10, scale: 4 }).notNull().default("2.0000"),
  kgPerCarton: numeric("kg_per_carton", { precision: 10, scale: 4 }).notNull().default("4.5000"),
  labelCostPerCartonUsd: numeric("label_cost_per_carton_usd", { precision: 10, scale: 4 }).notNull().default("0.1000"),
  packingCostPerCartonUsd: numeric("packing_cost_per_carton_usd", { precision: 10, scale: 4 }).notNull().default("1.6000"),
  materialCostPerCartonUsd: numeric("material_cost_per_carton_usd", { precision: 10, scale: 4 }).notNull().default("0.3000"),
  ecuadorTransportUsd: numeric("ecuador_transport_usd", { precision: 10, scale: 2 }).notNull().default("400.00"),
  oceanFreightUsd: numeric("ocean_freight_usd", { precision: 10, scale: 2 }).notNull().default("7000.00"),
  importCustomsUsd: numeric("import_customs_usd", { precision: 10, scale: 2 }).notNull().default("1200.00"),
  cartonsPer20ft: integer("cartons_per_20ft").notNull().default(1920),
  cartonsPer40ft: integer("cartons_per_40ft").notNull().default(3840),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type PricingInputs = typeof pricingInputs.$inferSelect;
export type NewPricingInputs = typeof pricingInputs.$inferInsert;
