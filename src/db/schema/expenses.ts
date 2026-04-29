import { sql } from "drizzle-orm";
import {
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { people } from "./people";
import { companies } from "./companies";

// Category TYPE — role-based, not person-based. Worker turnover does not
// require an enum migration. The grid columns key off this.
//   labor_harvest:    day laborers (Jornales) — payment per crew per week
//                     with rate × headcount × days reflected in the per-row
//                     amount + label.
//   labor_overhead:   recurring per-person weekly payments — Isaac (wage),
//                     Chavito (farm manager), the engineer (Pocho/Joe).
//                     Bonuses to the same person live here too as separate
//                     rows on the weeks they happen.
//   operating_bills:  recurring farm operating costs — water deliveries,
//                     electric, internet, fuel, fertilizer, lease, etc.
//                     Per-bill detail comes from the row's category_label.
//   equipment:        capex one-offs (lights install, tools).
//   services:         accountant, lawyer, agronomist, third-party services.
//   taxes:            SRI / Ecuador taxes / fees.
//   transfer_out:     legacy — kept so historical rows still validate.
//                     Going forward, US-bound wires live in cash_movements.
//   other:            uncategorized — paired with category_label to disambiguate.
//
// `labor_water` is retained in the enum for legacy compatibility with the
// initial schema; no row should reference it post-migration-0002.
export const expenseCategoryTypeEnum = pgEnum("expense_category_type", [
  "labor_water",
  "labor_harvest",
  "labor_overhead",
  "equipment",
  "services",
  "taxes",
  "transfer_out",
  "other",
  "operating_bills",
]);

// One row per outflow. Weekly grid view derives by GROUP BY week_start_date.
export const expenseEntries = pgTable("expense_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  entryDate: date("entry_date").notNull(),
  // Monday of ISO week — denormalized for grid queries.
  weekStartDate: date("week_start_date").notNull(),
  categoryType: expenseCategoryTypeEnum("category_type").notNull(),
  // Human-facing tag for THIS row: "Chavito", "Jornales week 14", "Lights install".
  // Drives the feed display; can be null (we'll fall back to category_type label).
  categoryLabel: text("category_label"),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  // Free text — worker name, vendor name, etc. Not a hard reference because
  // most payees in the historical sheet are workers without their own row.
  payee: text("payee"),
  // When the payee IS a known person (e.g. Isaac), populate this as well so
  // the engine can group by person across pillars.
  payeePersonId: uuid("payee_person_id").references(() => people.id),
  // When the payee IS a known company (vendor with a row in companies),
  // populate this. Both payeePersonId and payeeCompanyId nullable; at most one
  // will typically be set; payee text is the always-present human label.
  payeeCompanyId: uuid("payee_company_id").references(() => companies.id),
  notes: text("notes"),
  // Provenance + dedup natural-key. Examples:
  //   "master_sheet:row_43"     — ingested from the Drive sheet, row 43
  //   "manual"                  — typed in the engine UI
  //   "whatsapp:2026-04-23"     — captured from an Isaac WhatsApp message
  // The ingest UPSERTs on `source` so re-running is safe.
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

export type ExpenseEntry = typeof expenseEntries.$inferSelect;
export type NewExpenseEntry = typeof expenseEntries.$inferInsert;
