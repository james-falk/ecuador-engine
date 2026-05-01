// Income pillar — cross-pillar money rollup. Pulls expense_entries (out),
// harvest_settlements (in), cash_movements (capital), and farm_harvests
// (operational signal: buckets/month) into a single year/month view.
//
// All amounts returned as numeric strings ("1234.56") so the UI doesn't
// have to recover the precision the DB provides.

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  expenseEntries,
  harvestSettlements,
  cashMovements,
  farmHarvests,
} from "@/db/schema";

export type MonthRow = {
  month: string; // YYYY-MM
  expensesUsd: string;
  settlementsUsd: string;
  capitalInUsd: string;
  capitalOutUsd: string;
  netUsd: string; // settlements - expenses (operational; capital flows tracked separately)
  // Seasonal signals from the farm side (when available).
  buckets: number;
  flowers: number;
  // Settlements averages (when there's processed kg data).
  kgProcessed: string;
  pricePerKg: string | null;
};

export type IncomeYearSummary = {
  year: number;
  expensesUsd: string;
  settlementsUsd: string;
  capitalInUsd: string;
  capitalOutUsd: string;
  netUsd: string;
  buckets: number;
  kgProcessed: string;
};

function rangeFor(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function getIncomeMonthly(year: number): Promise<MonthRow[]> {
  const { from, to } = rangeFor(year);

  // Expenses by month.
  const expRows = await db
    .select({
      month: sql<string>`to_char(${expenseEntries.entryDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${expenseEntries.amountUsd}), 0)::numeric(12,2)`,
    })
    .from(expenseEntries)
    .where(and(gte(expenseEntries.entryDate, from), lte(expenseEntries.entryDate, to)))
    .groupBy(sql`to_char(${expenseEntries.entryDate}, 'YYYY-MM')`);

  // Settlements (harvest revenue) by month using paid_date when present.
  const setRows = await db
    .select({
      month: sql<string>`to_char(${harvestSettlements.paidDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${harvestSettlements.netPayUsd}), 0)::numeric(12,2)`,
      kgProcessed: sql<string>`coalesce(sum(${harvestSettlements.kgProcessed}), 0)::numeric(12,2)`,
    })
    .from(harvestSettlements)
    .where(
      and(
        sql`${harvestSettlements.paidDate} IS NOT NULL`,
        sql`${harvestSettlements.paidDate} >= ${from}`,
        sql`${harvestSettlements.paidDate} <= ${to}`
      )
    )
    .groupBy(sql`to_char(${harvestSettlements.paidDate}, 'YYYY-MM')`);

  // Cash movements by month + direction.
  const cmRows = await db
    .select({
      month: sql<string>`to_char(${cashMovements.transferDate}, 'YYYY-MM')`,
      direction: cashMovements.direction,
      total: sql<string>`coalesce(sum(${cashMovements.amountUsd}), 0)::numeric(12,2)`,
    })
    .from(cashMovements)
    .where(
      and(
        gte(cashMovements.transferDate, from),
        lte(cashMovements.transferDate, to)
      )
    )
    .groupBy(sql`to_char(${cashMovements.transferDate}, 'YYYY-MM')`, cashMovements.direction);

  // Farm harvests by month — buckets + flowers.
  const farmRows = await db
    .select({
      month: sql<string>`to_char(${farmHarvests.harvestDate}, 'YYYY-MM')`,
      buckets: sql<number>`coalesce(sum(${farmHarvests.bucketCount}), 0)::int`,
      flowers: sql<number>`coalesce(sum(${farmHarvests.flowerCount}), 0)::int`,
    })
    .from(farmHarvests)
    .where(
      and(
        gte(farmHarvests.harvestDate, from),
        lte(farmHarvests.harvestDate, to)
      )
    )
    .groupBy(sql`to_char(${farmHarvests.harvestDate}, 'YYYY-MM')`);

  // Stitch — render every month in the year for chart consistency.
  const months: MonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    const exp = expRows.find((r) => r.month === ym);
    const set = setRows.find((r) => r.month === ym);
    const farm = farmRows.find((r) => r.month === ym);
    const cmIn = cmRows.find((r) => r.month === ym && r.direction === "in_to_ec");
    const cmOut = cmRows.find((r) => r.month === ym && r.direction === "out_to_us");

    const expensesUsd = exp?.total ?? "0.00";
    const settlementsUsd = set?.total ?? "0.00";
    const kgProcessed = set?.kgProcessed ?? "0.00";
    const pricePerKg =
      Number(kgProcessed) > 0 ? (Number(settlementsUsd) / Number(kgProcessed)).toFixed(2) : null;
    const netUsd = (Number(settlementsUsd) - Number(expensesUsd)).toFixed(2);

    months.push({
      month: ym,
      expensesUsd,
      settlementsUsd,
      capitalInUsd: cmIn?.total ?? "0.00",
      capitalOutUsd: cmOut?.total ?? "0.00",
      netUsd,
      buckets: farm?.buckets ?? 0,
      flowers: farm?.flowers ?? 0,
      kgProcessed,
      pricePerKg,
    });
  }
  return months;
}

export async function getIncomeYearSummary(year: number): Promise<IncomeYearSummary> {
  const months = await getIncomeMonthly(year);
  const sum = (k: keyof MonthRow) =>
    months.reduce((acc, r) => acc + Number(r[k]), 0);
  const expensesUsd = sum("expensesUsd").toFixed(2);
  const settlementsUsd = sum("settlementsUsd").toFixed(2);
  const capitalInUsd = sum("capitalInUsd").toFixed(2);
  const capitalOutUsd = sum("capitalOutUsd").toFixed(2);
  const netUsd = (Number(settlementsUsd) - Number(expensesUsd)).toFixed(2);
  const buckets = months.reduce((acc, r) => acc + r.buckets, 0);
  const kgProcessed = sum("kgProcessed").toFixed(2);
  return {
    year,
    expensesUsd,
    settlementsUsd,
    capitalInUsd,
    capitalOutUsd,
    netUsd,
    buckets,
    kgProcessed,
  };
}

// YoY rollup — one row per year. Cheaper than calling getIncomeYearSummary
// in a loop because it does a single GROUP BY year instead of 12-month splits.
export async function getYearsAvailable(): Promise<number[]> {
  const r = await db.execute<{ y: string }>(
    sql`
      SELECT DISTINCT y FROM (
        SELECT to_char(entry_date, 'YYYY') AS y FROM expense_entries
        UNION
        SELECT to_char(harvest_date, 'YYYY') AS y FROM harvests
        UNION
        SELECT to_char(transfer_date, 'YYYY') AS y FROM cash_movements
        UNION
        SELECT to_char(harvest_date, 'YYYY') AS y FROM farm_harvests
      ) t
      WHERE y IS NOT NULL
      ORDER BY y
    `
  );
  return r.rows.map((row) => parseInt(row.y, 10)).filter((n) => Number.isFinite(n));
}

export async function getYoYSummary(years: number[]): Promise<IncomeYearSummary[]> {
  return Promise.all(years.map((y) => getIncomeYearSummary(y)));
}
