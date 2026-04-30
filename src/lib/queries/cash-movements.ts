// Cash movements pillar — read paths.

import { desc, and, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cashMovements, accounts } from "@/db/schema";

export type CashMovementDirection = "in_to_ec" | "out_to_us";

export const DIRECTION_LABEL: Record<CashMovementDirection, string> = {
  in_to_ec: "US → EC",
  out_to_us: "EC → US",
};

export type CashMovementRow = {
  id: string;
  transferDate: string;
  weekStartDate: string;
  direction: CashMovementDirection;
  amountUsd: string;
  counterparty: string | null;
  notes: string | null;
  source: string | null;
  accountId: string;
};

function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

export async function getCashMovementFeed(filters: { from?: string; to?: string } = {}): Promise<CashMovementRow[]> {
  const where = [
    filters.from ? gte(cashMovements.transferDate, filters.from) : undefined,
    filters.to ? lte(cashMovements.transferDate, filters.to) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(cashMovements)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(cashMovements.transferDate), desc(cashMovements.createdAt));

  return rows.map((r) => ({
    id: r.id,
    transferDate: dateStr(r.transferDate),
    weekStartDate: dateStr(r.weekStartDate),
    direction: r.direction as CashMovementDirection,
    amountUsd: r.amountUsd,
    counterparty: r.counterparty,
    notes: r.notes,
    source: r.source,
    accountId: r.accountId,
  }));
}

export async function getCashMovementById(id: string): Promise<CashMovementRow | null> {
  const [row] = await db.select().from(cashMovements).where(eq(cashMovements.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    transferDate: dateStr(row.transferDate),
    weekStartDate: dateStr(row.weekStartDate),
    direction: row.direction as CashMovementDirection,
    amountUsd: row.amountUsd,
    counterparty: row.counterparty,
    notes: row.notes,
    source: row.source,
    accountId: row.accountId,
  };
}

// Weekly aggregates of capital in/out, keyed by Sunday of the week. Used by
// the expenses grid to render the "US in" / "US out" columns alongside the
// operational categories.
export type WeeklyCashAgg = {
  weekStartDate: string;
  inUsd: string;
  outUsd: string;
};

export async function getWeeklyCashAgg(opts: { from?: string; to?: string; accountSlug?: string } = {}): Promise<WeeklyCashAgg[]> {
  const slug = opts.accountSlug ?? "finca-ec";
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.slug, slug)).limit(1);
  if (!account) return [];

  const where = [
    eq(cashMovements.accountId, account.id),
    opts.from ? gte(cashMovements.transferDate, opts.from) : undefined,
    opts.to ? lte(cashMovements.transferDate, opts.to) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      weekStartDate: cashMovements.weekStartDate,
      inUsd: sql<string>`sum(case when ${cashMovements.direction} = 'in_to_ec' then ${cashMovements.amountUsd} else 0 end)::numeric(12,2)`,
      outUsd: sql<string>`sum(case when ${cashMovements.direction} = 'out_to_us' then ${cashMovements.amountUsd} else 0 end)::numeric(12,2)`,
    })
    .from(cashMovements)
    .where(and(...where))
    .groupBy(cashMovements.weekStartDate);

  return rows.map((r) => ({
    weekStartDate: dateStr(r.weekStartDate),
    inUsd: r.inUsd ?? "0.00",
    outUsd: r.outUsd ?? "0.00",
  }));
}
