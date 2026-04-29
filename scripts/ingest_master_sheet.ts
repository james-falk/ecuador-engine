// One-shot ingest of the master "Finca Del Dragon" Drive sheet.
// Reads a fixture .xlsx (export the Sheet via File → Download → Microsoft
// Excel), parses each weekly row, and fans it out into:
//   - expense_entries (one per non-zero category cell)
//   - harvests + harvest_settlements (one per Harvest Payment Received cell)
//
// Idempotent: every row gets a unique `source = "master_sheet:row_N"` and
// the script DELETEs everything with that source prefix at the start of each
// run, then re-inserts. Safe to run repeatedly as the sheet evolves.
//
// USAGE:
//   1. Export the Drive sheet to scripts/data/master_sheet.xlsx
//      (or set MASTER_SHEET_PATH env var)
//   2. pnpm tsx scripts/ingest_master_sheet.ts [--dry-run] [--year=2025]
//        --dry-run     parse + report but do not write
//        --year=YYYY   filter to a single calendar year
//
// Column mapping is configurable below; if the sheet's column names change,
// update COLUMN_MAP and re-run. The script fails LOUDLY if expected columns
// are missing from the header row.

import "./_env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { startOfWeek, parseISO, format, isValid, parse as parseDate } from "date-fns";
import { eq, like, and, gte, lte, sql as drizzleSql } from "drizzle-orm";
import { db } from "../src/db";
import {
  accounts,
  companies,
  expenseEntries,
  harvests,
  harvestSettlements,
  cashMovements,
} from "../src/db/schema";
import type { ExpenseCategoryType } from "../src/lib/queries/expenses";
import type { CashMovementDirection } from "../src/lib/queries/cash-movements";

// ── Config ────────────────────────────────────────────────────────────

const SHEET_PATH = process.env.MASTER_SHEET_PATH ?? resolve("scripts/data/master_sheet.xlsx");
const SHEET_NAME = "Weekly Payments"; // only tab in the master sheet
const SOURCE_PREFIX = "master_sheet:";
const ACCOUNT_SLUG = "finca-ec";
const PROCESSOR_NAME = "INCALPACK"; // default processor for backfill harvests
const DRY_RUN = process.argv.includes("--dry-run");

// `--year=2025` filters to rows whose entry_date falls in that year.
// Used to ingest one year at a time so you can cross-reference totals
// against known annual figures before doing the full historical pull.
const YEAR_FILTER: number | null = (() => {
  const arg = process.argv.find((a) => a.startsWith("--year="));
  if (!arg) return null;
  const y = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(y) ? y : null;
})();

// Header column → DB category/flow mapping. KEYS are how the columns appear in
// the spreadsheet (case-insensitive, trimmed). When a column doesn't appear in
// this map, it's logged as "skipped" and ignored. Extend as new columns
// are discovered in the master sheet.
//
// Kinds:
//   expense     — emit as expense_entries row (category_type + label)
//   income      — emit as harvests + harvest_settlements (lump-sum net pay)
//   capital_in  — emit as cash_movements direction='in_to_ec' (US → EC wire)
//   capital_out — emit as cash_movements direction='out_to_us' (EC → US wire)
//   other_note  — sentinel for the "Other" column-pair (note + cost). Handled
//                 specially below: the note text becomes category_label.
type ColumnDef =
  | { kind: "expense"; category: ExpenseCategoryType; label: string }
  | { kind: "income" }
  | { kind: "capital_in" }
  | { kind: "capital_out" }
  | { kind: "other_note" };

const COLUMN_MAP: Record<string, ColumnDef> = {
  // Operating bills
  "water": { kind: "expense", category: "operating_bills", label: "Water deliveries" },

  // Labor (recurring fixed)
  "chavito": { kind: "expense", category: "labor_overhead", label: "Chavito" },
  "pocho": { kind: "expense", category: "labor_overhead", label: "Engineer" },
  "joe": { kind: "expense", category: "labor_overhead", label: "Engineer" },
  "pocho/joe": { kind: "expense", category: "labor_overhead", label: "Engineer" },
  "engineer": { kind: "expense", category: "labor_overhead", label: "Engineer" },
  "isaac": { kind: "expense", category: "labor_overhead", label: "Isaac" },

  // Day labor
  "jornales": { kind: "expense", category: "labor_harvest", label: "Jornales" },

  // Income
  "harvest payment received": { kind: "income" },

  // Capital flows (the "Amounts Paid to Isaac to Pay Workers" + "Payments Sent
  // Back to US" columns from James's sheet — different sheets may name these
  // slightly differently; common variants below).
  "amounts paid to isaac to pay workers": { kind: "capital_in" },
  "amounts paid to isaac": { kind: "capital_in" },
  "wires to isaac": { kind: "capital_in" },
  "payments sent back to us": { kind: "capital_out" },
  "wires from isaac": { kind: "capital_out" },

  // Other column header — the cost cell. The matching note column is detected
  // adjacent to this and merged in `parseRow` below.
  "other": { kind: "other_note" },
};

// Columns that are known headers but NOT data (date, totals, comments, etc.).
// These are silently ignored — no warning logged.
const IGNORED_COLUMNS = new Set([
  "date", "week", "week #", "week of", "total", "gross", "net",
  "comments", "comment", "notes", "note",
]);

// ── Types ─────────────────────────────────────────────────────────────

type ParsedRow = {
  rowIndex: number; // 1-based row number in the sheet (for source string)
  weekStartDate: string; // ISO YYYY-MM-DD (Monday)
  cells: Array<{ column: string; amountUsd: string }>;
};

type IngestReport = {
  rowsRead: number;
  rowsParsed: number;
  rowsSkipped: number;
  expensesInserted: number;
  harvestsInserted: number;
  cashMovementsInserted: number;
  unknownColumns: Set<string>;
  errors: Array<{ row: number; reason: string }>;
};

// ── Helpers ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  // xlsx may parse dates as JS Date or as numeric serial. Handle both.
  if (value instanceof Date) {
    if (!isValid(value)) return null;
    return format(value, "yyyy-MM-dd");
  }
  if (typeof value === "number") {
    // Excel serial date (days since 1900-01-01 with Lotus 1-2-3 quirk)
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Try ISO first
    const iso = parseISO(trimmed);
    if (isValid(iso)) return format(iso, "yyyy-MM-dd");
    // Try common formats
    for (const fmt of ["MM/dd/yyyy", "M/d/yyyy", "yyyy-MM-dd", "dd-MMM-yyyy"]) {
      try {
        const d = parseDate(trimmed, fmt, new Date());
        if (isValid(d)) return format(d, "yyyy-MM-dd");
      } catch {
        // try next
      }
    }
  }
  return null;
}

function parseAmount(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value === 0) return null;
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    // Strip $, commas, spaces; allow negatives in parens "($150)"
    const cleaned = value.replace(/[$,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n === 0) return null;
    return n.toFixed(2);
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(SHEET_PATH)) {
    console.error(`Master sheet not found at: ${SHEET_PATH}`);
    console.error(`Set MASTER_SHEET_PATH or drop the export at scripts/data/master_sheet.xlsx`);
    process.exit(1);
  }

  console.log(`Reading: ${SHEET_PATH}`);
  if (YEAR_FILTER !== null) console.log(`Year filter: ${YEAR_FILTER}`);
  if (DRY_RUN) console.log(`Mode: DRY RUN (no DB writes)`);
  const buf = readFileSync(SHEET_PATH);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const sheet = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    console.error(`No sheet named "${SHEET_NAME}" found. Available: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  console.log(`Using sheet: ${sheet["!ref"] ? wb.SheetNames[0] : "(unnamed)"}`);

  // Convert to array-of-arrays so we have full control over header detection.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  if (rows.length === 0) {
    console.error("Sheet is empty.");
    process.exit(1);
  }

  // Find the header row — the first row that has a "date" column.
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i];
    if (Array.isArray(r) && r.some((c) => typeof c === "string" && normalize(c) === "date")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    console.error("Could not locate header row (no 'Date' column found in first 20 rows).");
    process.exit(1);
  }
  const headers = (rows[headerRowIndex] as unknown[]).map((c) =>
    typeof c === "string" ? normalize(c) : ""
  );
  console.log(`Header row: ${headerRowIndex + 1}`);
  console.log(`Columns: ${headers.filter(Boolean).join(", ")}`);

  // Parse each data row.
  const report: IngestReport = {
    rowsRead: 0,
    rowsParsed: 0,
    rowsSkipped: 0,
    expensesInserted: 0,
    harvestsInserted: 0,
    cashMovementsInserted: 0,
    unknownColumns: new Set(),
    errors: [],
  };

  const parsed: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    report.rowsRead++;
    const r = rows[i] as unknown[];
    if (!r || r.every((c) => c === null || c === "" || c === undefined)) continue;

    const dateValue = r[headers.indexOf("date")];
    const isoDate = parseDateCell(dateValue);
    if (!isoDate) {
      report.rowsSkipped++;
      report.errors.push({ row: i + 1, reason: `Could not parse date: ${dateValue}` });
      continue;
    }
    // Year filter — when set, skip rows outside the requested year. Cheap
    // string check rather than reparsing.
    if (YEAR_FILTER !== null) {
      const rowYear = parseInt(isoDate.slice(0, 4), 10);
      if (rowYear !== YEAR_FILTER) {
        report.rowsSkipped++;
        continue;
      }
    }
    // Sunday of the week containing the date. Master sheet runs Sun→Sat with
    // payments on Saturday, so the canonical weekStartDate is Sunday.
    const weekStartDate = format(startOfWeek(parseISO(isoDate), { weekStartsOn: 0 }), "yyyy-MM-dd");

    const cells: ParsedRow["cells"] = [];
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h || h === "date" || IGNORED_COLUMNS.has(h)) continue;
      const amount = parseAmount(r[c]);
      if (!amount) continue;
      if (!COLUMN_MAP[h]) {
        report.unknownColumns.add(h);
        continue;
      }
      cells.push({ column: h, amountUsd: amount });
    }

    if (cells.length > 0) {
      parsed.push({ rowIndex: i + 1, weekStartDate, cells });
      report.rowsParsed++;
    } else {
      report.rowsSkipped++;
    }
  }

  console.log(`Parsed ${report.rowsParsed} rows (${report.rowsRead} read, ${report.rowsSkipped} skipped).`);
  if (report.unknownColumns.size > 0) {
    console.log(`Unknown columns (extend COLUMN_MAP): ${[...report.unknownColumns].join(", ")}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — no DB writes. Sample of first 3 parsed rows:");
    console.log(JSON.stringify(parsed.slice(0, 3), null, 2));
    return;
  }

  // ── DB writes ───────────────────────────────────────────────────────

  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.slug, ACCOUNT_SLUG)).limit(1);
  if (!account) {
    console.error(`Account "${ACCOUNT_SLUG}" not found. Run pnpm db:seed first.`);
    process.exit(1);
  }
  const [processor] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.name, PROCESSOR_NAME))
    .limit(1);
  if (!processor) {
    console.error(`Processor "${PROCESSOR_NAME}" not found. Run pnpm db:seed first.`);
    process.exit(1);
  }

  // Idempotency: delete previously-ingested rows from this source.
  // When a year filter is active, ONLY delete rows from that year so other
  // years' ingested data survives a partial re-run.
  const yearFrom = YEAR_FILTER !== null ? `${YEAR_FILTER}-01-01` : null;
  const yearTo = YEAR_FILTER !== null ? `${YEAR_FILTER}-12-31` : null;

  const expDelWhere = yearFrom
    ? and(
        like(expenseEntries.source, `${SOURCE_PREFIX}%`),
        gte(expenseEntries.weekStartDate, yearFrom),
        lte(expenseEntries.weekStartDate, yearTo!)
      )
    : like(expenseEntries.source, `${SOURCE_PREFIX}%`);
  const expDel = await db.delete(expenseEntries).where(expDelWhere).returning({ id: expenseEntries.id });
  console.log(`Cleared ${expDel.length} prior expense entries from this source${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  const cmDelWhere = yearFrom
    ? and(
        like(cashMovements.source, `${SOURCE_PREFIX}%`),
        gte(cashMovements.weekStartDate, yearFrom),
        lte(cashMovements.weekStartDate, yearTo!)
      )
    : like(cashMovements.source, `${SOURCE_PREFIX}%`);
  const cmDel = await db.delete(cashMovements).where(cmDelWhere).returning({ id: cashMovements.id });
  console.log(`Cleared ${cmDel.length} prior cash movements from this source${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  // For harvests we delete by lot_number prefix (the harvests table doesn't
  // carry a `source` column). Year-bound when filter active.
  const harvDelWhere = yearFrom
    ? and(
        like(harvests.lotNumber, `${SOURCE_PREFIX}%`),
        gte(harvests.weekStartDate, yearFrom),
        lte(harvests.weekStartDate, yearTo!)
      )
    : like(harvests.lotNumber, `${SOURCE_PREFIX}%`);
  const harvDel = await db.delete(harvests).where(harvDelWhere).returning({ id: harvests.id });
  console.log(`Cleared ${harvDel.length} prior ingested harvests${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  // Silence unused-import warning when the year filter isn't active.
  void drizzleSql;

  for (const row of parsed) {
    const source = `${SOURCE_PREFIX}row_${row.rowIndex}`;
    for (const cell of row.cells) {
      const def = COLUMN_MAP[cell.column];
      if (def.kind === "expense" || def.kind === "other_note") {
        // The "Other" column lives here too — for v1 we treat it as a single
        // amount with label "Other". When James adds a separate "Other note"
        // text column to COLUMN_MAP, the note text gets carried into
        // category_label per row by detecting paired columns.
        const isOther = def.kind === "other_note";
        await db.insert(expenseEntries).values({
          entryDate: row.weekStartDate,
          weekStartDate: row.weekStartDate,
          categoryType: isOther ? "other" : def.category,
          categoryLabel: isOther ? "Other" : def.label,
          amountUsd: cell.amountUsd,
          accountId: account.id,
          payee: isOther ? null : def.label,
          source,
        });
        report.expensesInserted++;
      } else if (def.kind === "income") {
        // Income — create a backfill harvest + settlement. Master sheet
        // carries the lump-sum net pay only; per-grade detail comes from
        // the Liquidación PDFs in a future phase.
        const [{ id: harvestId }] = await db
          .insert(harvests)
          .values({
            harvestDate: row.weekStartDate,
            weekStartDate: row.weekStartDate,
            processorCompanyId: processor.id,
            lotNumber: source, // embed source so we can find/delete on re-ingest
            kgDelivered: "0",
            notes: "Backfilled from master sheet — kg + grade detail TBD from Liquidación PDF.",
          })
          .returning({ id: harvests.id });
        await db.insert(harvestSettlements).values({
          harvestId,
          settlementDate: row.weekStartDate,
          kgManifested: "0",
          kgProcessed: "0",
          kgWaste: "0",
          subtotalUsd: cell.amountUsd,
          retentionUsd: "0",
          netPayUsd: cell.amountUsd,
          paidToAccountId: account.id,
          paidDate: row.weekStartDate,
        });
        report.harvestsInserted++;
      } else if (def.kind === "capital_in" || def.kind === "capital_out") {
        const direction: CashMovementDirection = def.kind === "capital_in" ? "in_to_ec" : "out_to_us";
        await db.insert(cashMovements).values({
          transferDate: row.weekStartDate,
          weekStartDate: row.weekStartDate,
          direction,
          amountUsd: cell.amountUsd,
          accountId: account.id,
          counterparty: direction === "in_to_ec" ? "James US" : "US side",
          notes: `Ingested from master sheet column "${cell.column}".`,
          source,
        });
        report.cashMovementsInserted++;
      }
    }
  }

  console.log(
    `\nIngested ${report.expensesInserted} expenses + ${report.harvestsInserted} harvest payments + ${report.cashMovementsInserted} cash movements.`
  );

  // Write the report.
  const reportPath = resolve("scripts/ingest_master_sheet.report.md");
  const lines = [
    `# Master sheet ingest report`,
    `Run: ${new Date().toISOString()}`,
    `Source: ${SHEET_PATH}`,
    ``,
    `- Rows read: ${report.rowsRead}`,
    `- Rows parsed: ${report.rowsParsed}`,
    `- Rows skipped: ${report.rowsSkipped}`,
    `- Expenses inserted: ${report.expensesInserted}`,
    `- Harvest payments inserted: ${report.harvestsInserted}`,
    `- Cash movements inserted: ${report.cashMovementsInserted}`,
    ``,
    `## Unknown columns (extend COLUMN_MAP)`,
    [...report.unknownColumns].map((c) => `- \`${c}\``).join("\n") || "(none)",
    ``,
    `## Errors`,
    report.errors.map((e) => `- Row ${e.row}: ${e.reason}`).join("\n") || "(none)",
  ];
  writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");
  console.log(`Report: ${reportPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Ingest failed:", e);
    process.exit(1);
  });
