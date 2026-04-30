// Expenses pillar — read paths. Types live here (NOT in lib/data.ts) so the
// design's mock module stays a clean copy of the original handoff.

import { desc, and, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseEntries, harvestSettlements, accounts, people, companies, cashMovements } from "@/db/schema";

export type ExpenseCategoryType =
  | "labor_harvest"
  | "labor_overhead"
  | "operating_bills"
  | "equipment"
  | "services"
  | "taxes"
  | "transfer_out"
  | "other"
  | "labor_water"; // legacy DB enum value, no rows reference it post-migration-0002

// Categories shown in the weekly grid, left to right. `labor_water` is
// deliberately excluded — operating_bills replaces it.
export const CATEGORY_TYPES: ExpenseCategoryType[] = [
  "labor_harvest",
  "labor_overhead",
  "operating_bills",
  "equipment",
  "services",
  "taxes",
  "transfer_out",
  "other",
];

// UI labels for category types. The DB enum stays canonical; this is presentation.
export const CATEGORY_LABEL: Record<ExpenseCategoryType, string> = {
  labor_harvest: "Jornales",
  labor_overhead: "Overhead",
  operating_bills: "Bills",
  equipment: "Equipment",
  services: "Services",
  taxes: "Taxes",
  transfer_out: "Transfer",
  other: "Other",
  labor_water: "Water (legacy)", // shouldn't render; defensive
};

export type ExpenseRow = {
  id: string;
  entryDate: string;
  weekStartDate: string;
  categoryType: ExpenseCategoryType;
  categoryLabel: string | null;
  amountUsd: string;
  payee: string | null;
  payeePersonName: string | null;
  payeeCompanyName: string | null;
  notes: string | null;
  source: string | null;
  accountId: string;
};

export type WeekRow = {
  weekStartDate: string;
  byCategory: Record<ExpenseCategoryType, string>; // numeric strings ("180.00")
  gross: string; // total operating outflows this week (sum of categories)
  settlementsIn: string; // Liquidación net pay landed this week (paid_date)
  capitalIn: string; // wires from US into FincaEC (cash_movements direction='in_to_ec')
  capitalOut: string; // wires from FincaEC back to US (direction='out_to_us')
  net: string; // settlementsIn − gross (operational only — capital flows shown separately)
};

export type WeeklyGrid = {
  categories: ExpenseCategoryType[];
  weeks: WeekRow[];
};

// Convert a `date` column value coming back from the driver. Postgres `date`
// arrives either as a Date object or an ISO string depending on driver config.
// Normalize to "YYYY-MM-DD".
function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

// ── Feed ──────────────────────────────────────────────────────────────
export type FeedFilters = {
  from?: string;
  to?: string;
  category?: ExpenseCategoryType;
};

export async function getExpenseFeed(filters: FeedFilters = {}): Promise<ExpenseRow[]> {
  const where = [
    filters.from ? gte(expenseEntries.entryDate, filters.from) : undefined,
    filters.to ? lte(expenseEntries.entryDate, filters.to) : undefined,
    filters.category ? eq(expenseEntries.categoryType, filters.category) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id: expenseEntries.id,
      entryDate: expenseEntries.entryDate,
      weekStartDate: expenseEntries.weekStartDate,
      categoryType: expenseEntries.categoryType,
      categoryLabel: expenseEntries.categoryLabel,
      amountUsd: expenseEntries.amountUsd,
      payee: expenseEntries.payee,
      payeePersonName: people.name,
      payeeCompanyName: companies.name,
      notes: expenseEntries.notes,
      source: expenseEntries.source,
      accountId: expenseEntries.accountId,
    })
    .from(expenseEntries)
    .leftJoin(people, eq(people.id, expenseEntries.payeePersonId))
    .leftJoin(companies, eq(companies.id, expenseEntries.payeeCompanyId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(expenseEntries.entryDate), desc(expenseEntries.createdAt));

  return rows.map((r) => ({
    ...r,
    entryDate: dateStr(r.entryDate),
    weekStartDate: dateStr(r.weekStartDate),
    categoryType: r.categoryType as ExpenseCategoryType,
  }));
}

export async function getExpenseById(id: string): Promise<ExpenseRow | null> {
  const [row] = await db
    .select({
      id: expenseEntries.id,
      entryDate: expenseEntries.entryDate,
      weekStartDate: expenseEntries.weekStartDate,
      categoryType: expenseEntries.categoryType,
      categoryLabel: expenseEntries.categoryLabel,
      amountUsd: expenseEntries.amountUsd,
      payee: expenseEntries.payee,
      payeePersonName: people.name,
      payeeCompanyName: companies.name,
      notes: expenseEntries.notes,
      source: expenseEntries.source,
      accountId: expenseEntries.accountId,
    })
    .from(expenseEntries)
    .leftJoin(people, eq(people.id, expenseEntries.payeePersonId))
    .leftJoin(companies, eq(companies.id, expenseEntries.payeeCompanyId))
    .where(eq(expenseEntries.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    entryDate: dateStr(row.entryDate),
    weekStartDate: dateStr(row.weekStartDate),
    categoryType: row.categoryType as ExpenseCategoryType,
  };
}

// ── Weekly grid ───────────────────────────────────────────────────────
// Aggregates done in SQL to keep TS-side memory low; the result is at most
// (weeks × categories) rows.
export async function getWeeklyGrid(opts: { from?: string; to?: string; accountSlug?: string } = {}): Promise<WeeklyGrid> {
  const slug = opts.accountSlug ?? "finca-ec";
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.slug, slug)).limit(1);
  if (!account) {
    return { categories: CATEGORY_TYPES, weeks: [] };
  }

  // Per-week, per-category sums of expenses. Filter on entry_date (the
  // natural event date) — week_start_date filters would drop boundary
  // entries whose Sunday-week happens to land in the prior calendar year.
  const expWhere = [
    eq(expenseEntries.accountId, account.id),
    opts.from ? gte(expenseEntries.entryDate, opts.from) : undefined,
    opts.to ? lte(expenseEntries.entryDate, opts.to) : undefined,
  ].filter(Boolean);

  const expRows = await db
    .select({
      weekStartDate: expenseEntries.weekStartDate,
      categoryType: expenseEntries.categoryType,
      total: sql<string>`sum(${expenseEntries.amountUsd})::numeric(12,2)`,
    })
    .from(expenseEntries)
    .where(expWhere.length ? and(...expWhere) : undefined)
    .groupBy(expenseEntries.weekStartDate, expenseEntries.categoryType);

  // Per-week sums of settlement net pay landing in this account (by paid_date,
  // which is when the cash actually hit — settlement_date is when the doc was
  // issued, which can lag).
  const setWhere = [
    eq(harvestSettlements.paidToAccountId, account.id),
    sql`${harvestSettlements.paidDate} is not null`,
    opts.from ? sql`${harvestSettlements.paidDate} >= ${opts.from}` : undefined,
    opts.to ? sql`${harvestSettlements.paidDate} <= ${opts.to}` : undefined,
  ].filter(Boolean);

  // Sunday of the week containing paid_date. Postgres `date_trunc('week', d)`
  // hardcodes ISO Monday as the week start, so we compute Sunday explicitly:
  // subtract `dow` days (dow returns 0 for Sunday, 6 for Saturday) from the
  // date to land on that week's Sunday.
  const sundayExpr = sql`(${harvestSettlements.paidDate} - (extract(dow from ${harvestSettlements.paidDate})::int) * interval '1 day')::date`;
  const setRows = await db
    .select({
      weekStartDate: sql<string>`to_char(${sundayExpr}, 'YYYY-MM-DD')`,
      total: sql<string>`sum(${harvestSettlements.netPayUsd})::numeric(12,2)`,
    })
    .from(harvestSettlements)
    .where(and(...setWhere))
    .groupBy(sundayExpr);

  // Per-week capital flow aggregates from cash_movements. Filter on the
  // transfer date (the actual wire date), same year-boundary reasoning as
  // expenses above.
  const cmWhere = [
    eq(cashMovements.accountId, account.id),
    opts.from ? gte(cashMovements.transferDate, opts.from) : undefined,
    opts.to ? lte(cashMovements.transferDate, opts.to) : undefined,
  ].filter(Boolean);

  const cmRows = await db
    .select({
      weekStartDate: cashMovements.weekStartDate,
      inUsd: sql<string>`sum(case when ${cashMovements.direction} = 'in_to_ec' then ${cashMovements.amountUsd} else 0 end)::numeric(12,2)`,
      outUsd: sql<string>`sum(case when ${cashMovements.direction} = 'out_to_us' then ${cashMovements.amountUsd} else 0 end)::numeric(12,2)`,
    })
    .from(cashMovements)
    .where(and(...cmWhere))
    .groupBy(cashMovements.weekStartDate);

  // Stitch into weeks.
  const byWeek = new Map<string, WeekRow>();
  function ensure(w: string): WeekRow {
    let row = byWeek.get(w);
    if (!row) {
      row = {
        weekStartDate: w,
        byCategory: Object.fromEntries(CATEGORY_TYPES.map((c) => [c, "0.00"])) as Record<
          ExpenseCategoryType,
          string
        >,
        gross: "0.00",
        settlementsIn: "0.00",
        capitalIn: "0.00",
        capitalOut: "0.00",
        net: "0.00",
      };
      byWeek.set(w, row);
    }
    return row;
  }

  for (const r of expRows) {
    const w = dateStr(r.weekStartDate);
    const row = ensure(w);
    // Defensive: a legacy `labor_water` row would still sit in the DB; map it
    // into operating_bills for display so the column it lives in matches its
    // semantics.
    const ct =
      r.categoryType === "labor_water"
        ? "operating_bills"
        : (r.categoryType as ExpenseCategoryType);
    row.byCategory[ct] = (Number(row.byCategory[ct] ?? "0") + Number(r.total ?? "0")).toFixed(2);
  }
  for (const r of setRows) {
    const w = dateStr(r.weekStartDate);
    const row = ensure(w);
    row.settlementsIn = r.total ?? "0.00";
  }
  for (const r of cmRows) {
    const w = dateStr(r.weekStartDate);
    const row = ensure(w);
    row.capitalIn = r.inUsd ?? "0.00";
    row.capitalOut = r.outUsd ?? "0.00";
  }

  // Compute gross (sum of categories) and operational net.
  for (const row of byWeek.values()) {
    let gross = 0;
    for (const c of CATEGORY_TYPES) gross += Number(row.byCategory[c] ?? "0");
    row.gross = gross.toFixed(2);
    row.net = (Number(row.settlementsIn) - gross).toFixed(2);
  }

  // Sort newest first.
  const weeks = [...byWeek.values()].sort((a, b) => (a.weekStartDate < b.weekStartDate ? 1 : -1));

  return { categories: CATEGORY_TYPES, weeks };
}
