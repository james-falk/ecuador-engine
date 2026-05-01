// Expenses pillar — read paths. Types live here (NOT in lib/data.ts) so the
// design's mock module stays a clean copy of the original handoff.
//
// Data Entry tab needs `getWeekRows({ weekStartDate })` — see the export at
// the bottom of this file.

import { desc, and, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseEntries, harvests, harvestSettlements, accounts, people, companies, cashMovements } from "@/db/schema";

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
  byColumn: Record<string, { amount: string; note: string | null }>; // keyed by label
  gross: string;
  settlementsIn: string;
  capitalIn: string;
  capitalOut: string;
  net: string;
};

export type WeeklyGrid = {
  columns: string[]; // master-sheet labels in display order
  weeks: WeekRow[];
};

// Preferred display order; anything else slots in alphabetically after these.
const PREFERRED_LABEL_ORDER = [
  "Water",
  "Jornales",
  "Chavito",
  "Engineer",
  "Isaac",
  "Other",
];

function orderLabels(found: Set<string>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const p of PREFERRED_LABEL_ORDER) {
    if (found.has(p)) {
      ordered.push(p);
      seen.add(p);
    }
  }
  const rest = [...found].filter((l) => !seen.has(l)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

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
// Per-week, per-label sums. Labels match what's actually in the data
// (master-sheet columns: Water, Jornales, Chavito, Engineer, Isaac,
// Other-with-note). No invented bucketing.
export async function getWeeklyGrid(opts: { from?: string; to?: string; accountSlug?: string } = {}): Promise<WeeklyGrid> {
  const slug = opts.accountSlug ?? "finca-ec";
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.slug, slug)).limit(1);
  if (!account) {
    return { columns: [], weeks: [] };
  }

  // Filter on entry_date (the natural event date) — week_start_date filters
  // would drop boundary entries whose Sunday-week happens to land in the
  // prior calendar year.
  const expWhere = [
    eq(expenseEntries.accountId, account.id),
    opts.from ? gte(expenseEntries.entryDate, opts.from) : undefined,
    opts.to ? lte(expenseEntries.entryDate, opts.to) : undefined,
  ].filter(Boolean);

  // Two passes: aggregate by (week, label) for the totals, AND collect notes
  // for the "Other" column. The Other column shows the note inline below the
  // amount because the same Other slot can carry different reasons week to
  // week (fertilizer one week, equipment repair the next).
  const expRows = await db
    .select({
      weekStartDate: expenseEntries.weekStartDate,
      categoryLabel: expenseEntries.categoryLabel,
      categoryType: expenseEntries.categoryType,
      notes: expenseEntries.notes,
      total: sql<string>`sum(${expenseEntries.amountUsd})::numeric(12,2)`,
    })
    .from(expenseEntries)
    .where(expWhere.length ? and(...expWhere) : undefined)
    .groupBy(expenseEntries.weekStartDate, expenseEntries.categoryLabel, expenseEntries.categoryType, expenseEntries.notes);

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

  // Discover the label set in the data and stitch into weeks.
  const allLabels = new Set<string>();
  const byWeek = new Map<string, WeekRow>();
  function ensure(w: string): WeekRow {
    let row = byWeek.get(w);
    if (!row) {
      row = {
        weekStartDate: w,
        byColumn: {},
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
    // Resolve the label to display. category_label is the master-sheet
    // column name (Water, Jornales, etc.); when empty (legacy rows) fall
    // back to a humanized category_type so the value is still visible.
    const label = (r.categoryLabel ?? "").trim() || titleCase(r.categoryType);
    allLabels.add(label);
    const cell = row.byColumn[label] ?? { amount: "0.00", note: null as string | null };
    const newAmount = (Number(cell.amount) + Number(r.total ?? 0)).toFixed(2);
    // Keep the note when one exists. If multiple rows share the same week
    // and label (rare), join the notes — operator can sort it out from
    // the Feed tab.
    const note = mergeNote(cell.note, r.notes);
    row.byColumn[label] = { amount: newAmount, note };
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

  // Compute gross (sum across labels) and operational net.
  for (const row of byWeek.values()) {
    let gross = 0;
    for (const cell of Object.values(row.byColumn)) gross += Number(cell.amount);
    row.gross = gross.toFixed(2);
    row.net = (Number(row.settlementsIn) - gross).toFixed(2);
  }

  const columns = orderLabels(allLabels);
  const weeks = [...byWeek.values()].sort((a, b) => (a.weekStartDate < b.weekStartDate ? 1 : -1));

  return { columns, weeks };
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mergeNote(a: string | null, b: string | null): string | null {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}; ${right}`;
}

// ── Data Entry — week-bounded fetch ────────────────────────────────────
// Used by the /expenses Data Entry tab to populate the form's "what's
// already saved this week" preview. Returns expenses, cash movements, and
// any harvest payment for the given Sunday-start week.

export type WeekRowsBundle = {
  weekStartDate: string;
  expenses: ExpenseRow[];
  cashMovements: Array<{
    id: string;
    direction: "in_to_ec" | "out_to_us";
    amountUsd: string;
    counterparty: string | null;
    source: string | null;
    transferDate: string;
  }>;
  harvestPayment: { id: string; netPayUsd: string; source: string | null } | null;
};

export async function getWeekRows(weekStartDate: string): Promise<WeekRowsBundle> {
  const [exp, cm, harv] = await Promise.all([
    db
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
      .where(eq(expenseEntries.weekStartDate, weekStartDate))
      .orderBy(expenseEntries.categoryType, expenseEntries.categoryLabel),
    db
      .select({
        id: cashMovements.id,
        direction: cashMovements.direction,
        amountUsd: cashMovements.amountUsd,
        counterparty: cashMovements.counterparty,
        source: cashMovements.source,
        transferDate: cashMovements.transferDate,
      })
      .from(cashMovements)
      .where(eq(cashMovements.weekStartDate, weekStartDate)),
    db
      .select({
        id: harvestSettlements.id,
        netPayUsd: harvestSettlements.netPayUsd,
        source: harvests.lotNumber,
      })
      .from(harvestSettlements)
      .innerJoin(harvests, eq(harvests.id, harvestSettlements.harvestId))
      .where(eq(harvests.weekStartDate, weekStartDate))
      .limit(1),
  ]);

  return {
    weekStartDate,
    expenses: exp.map((r) => ({
      ...r,
      entryDate: dateStr(r.entryDate),
      weekStartDate: dateStr(r.weekStartDate),
      categoryType: r.categoryType as ExpenseCategoryType,
    })),
    cashMovements: cm.map((r) => ({
      id: r.id,
      direction: r.direction as "in_to_ec" | "out_to_us",
      amountUsd: r.amountUsd,
      counterparty: r.counterparty,
      source: r.source,
      transferDate: dateStr(r.transferDate),
    })),
    harvestPayment: harv[0]
      ? { id: harv[0].id, netPayUsd: harv[0].netPayUsd, source: harv[0].source ?? null }
      : null,
  };
}
