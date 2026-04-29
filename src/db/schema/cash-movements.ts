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

// Direction of a cash movement RELATIVE TO the FincaEC account, which is the
// engine's home base for v1. "in_to_ec" = wire arrived in FincaEC (e.g. James
// sent USD from a US account to keep the farm running). "out_to_us" = wire
// left FincaEC heading back stateside (e.g. Isaac sending surplus back).
//
// Cash movements are NOT operational revenue or expenses — they're transfers
// between accounts the same operator owns. The weekly grid keeps them in their
// own column so the operating P&L stays clean.
export const cashMovementDirectionEnum = pgEnum("cash_movement_direction", [
  "in_to_ec",
  "out_to_us",
]);

export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  transferDate: date("transfer_date").notNull(),
  // Sunday of the week containing transfer_date (denormalized for grid queries).
  weekStartDate: date("week_start_date").notNull(),
  direction: cashMovementDirectionEnum("direction").notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  // Free text — "James US", "Enigma US bank", "PureSol", whatever names the
  // counterparty James thinks of. Not a hard FK because the US-side account
  // isn't modeled yet.
  counterparty: text("counterparty"),
  notes: text("notes"),
  // The Finca-side account this hit/left. Defaults to FincaEC for v1.
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
});

export type CashMovement = typeof cashMovements.$inferSelect;
export type NewCashMovement = typeof cashMovements.$inferInsert;
