// One-shot ingest of the master "Finca Del Dragon" Drive sheet.
// The sheet has a non-trivial layout: the "Weekly Payments" tab carries
// MULTIPLE side-by-side sub-tables per year (the left side is the weekly
// expense ledger; the right side has independent dated sub-tables for
// capital wires in, capital wires out, harvest payments received, and ad-hoc
// "other farm purchases"). The yearly section blocks repeat down the page,
// and the column structure of the weekly table evolves over time (e.g. the
// Isaac column appears in 2023 and the Pocho column becomes Pocho/Joe in
// 2024). A single fixed-header parse cannot handle this — so this script is
// section-aware: it scans for known section title cells anywhere on the
// sheet, and for each one parses downward with section-specific logic.
//
// USAGE:
//   1. Drop a .xlsx export OR .csv export at scripts/data/master_sheet.{xlsx,csv}
//      (or set MASTER_SHEET_PATH). The Drive MCP `get_drive_file_content` tool
//      returns CSV directly, which is the easiest path.
//   2. pnpm tsx scripts/ingest_master_sheet.ts [--dry-run] [--year=2025]
//        --dry-run     parse + report but do not write
//        --year=YYYY   filter to a single calendar year (per ROW date, across
//                      all sub-tables — so a 2024 wire that lives inside the
//                      2025 section's right-hand table is correctly excluded)
//
// IDEMPOTENCY:
//   Every inserted row carries a `source` like "master_sheet:<sub>:row_N".
//   The script DELETEs all `source LIKE 'master_sheet:%'` rows before
//   inserting. When a year filter is active, the deletion is scoped by
//   weekStartDate to that year, so re-running 2025 doesn't wipe other years.

import "./_env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import * as XLSX from "xlsx";
import { startOfWeek, parseISO, format, isValid, parse as parseDate } from "date-fns";
import { eq, like, and, gte, lte } from "drizzle-orm";
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

const SHEET_PATH = (() => {
  if (process.env.MASTER_SHEET_PATH) return resolve(process.env.MASTER_SHEET_PATH);
  const csv = resolve("scripts/data/master_sheet.csv");
  if (existsSync(csv)) return csv;
  return resolve("scripts/data/master_sheet.xlsx");
})();
const SHEET_TAB_NAME = "Weekly Payments"; // when reading xlsx; CSV is single-tab
const SOURCE_PREFIX = "master_sheet:";
const ACCOUNT_SLUG = "finca-ec";
const DRY_RUN = process.argv.includes("--dry-run");

const YEAR_FILTER: number | null = (() => {
  const arg = process.argv.find((a) => a.startsWith("--year="));
  if (!arg) return null;
  const y = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(y) ? y : null;
})();

// ── Section detection ─────────────────────────────────────────────────

// Title strings that mark the start of a sub-table. Matched against trimmed,
// lower-cased cell text (so trailing spaces and case are forgiven).
const SECTION_TITLES = {
  weekly_expenses: ["amounts paid by isaac to workers"],
  capital_in: ["amounts paid to isaac to pay workers"],
  capital_out: ["payments sent back to us"],
  harvest_income: ["harvest payments recieved", "harvest payments received"], // both spellings
  other_purchases: ["other farm purchases"],
} as const;

type SectionKind = keyof typeof SECTION_TITLES;

type SectionStart = { kind: SectionKind; titleRow: number; titleCol: number };

function detectSections(rows: unknown[][]): SectionStart[] {
  const sections: SectionStart[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim().toLowerCase();
      if (!cell) continue;
      for (const [kind, titles] of Object.entries(SECTION_TITLES)) {
        if (titles.some((t) => cell === t)) {
          sections.push({ kind: kind as SectionKind, titleRow: r, titleCol: c });
        }
      }
    }
  }
  return sections;
}

// ── Helpers ───────────────────────────────────────────────────────────

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (!isValid(value)) return null;
    return format(value, "yyyy-MM-dd");
  }
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const iso = parseISO(trimmed);
    if (isValid(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return format(iso, "yyyy-MM-dd");
    // Sheet uses "MM-DD-YYYY" hyphenated; XLSX auto-formats CSV cells to
    // "M/d/yy" on read (so "01-04-2025" becomes "1/4/25"). Pre-expand 2-digit
    // years to 4-digit since date-fns parses "yy" literally as years 0-99.
    // The farm's data starts in 2022, so any 2-digit year maps to 20YY.
    const expanded = trimmed.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, "$1/$2/20$3");
    for (const fmt of [
      "MM-dd-yyyy", "M-d-yyyy",
      "MM/dd/yyyy", "M/d/yyyy",
      "dd-MMM-yyyy",
    ]) {
      try {
        const d = parseDate(expanded, fmt, new Date());
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
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Strip $, commas, spaces; allow negatives in parens "($150)"
    const cleaned = trimmed.replace(/[$,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
    if (cleaned === "" || cleaned === "-") return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n === 0) return null;
    return n.toFixed(2);
  }
  return null;
}

function sundayOf(isoDate: string): string {
  return format(startOfWeek(parseISO(isoDate), { weekStartsOn: 0 }), "yyyy-MM-dd");
}

function inYearFilter(isoDate: string): boolean {
  if (YEAR_FILTER === null) return true;
  return parseInt(isoDate.slice(0, 4), 10) === YEAR_FILTER;
}

// ── Section parsers ───────────────────────────────────────────────────

// Each parser returns one or more parsed records. Records are kind-tagged
// and converted to DB rows in the writer step.

type ExpenseRecord = {
  kind: "expense";
  rowIndex: number; // 1-based sheet row for source string
  subSection: "weekly" | "other";
  entryDate: string; // ISO
  weekStartDate: string;
  categoryType: ExpenseCategoryType;
  categoryLabel: string;
  amountUsd: string;
  payee: string | null;
  notes: string | null;
};

type HarvestIncomeRecord = {
  kind: "harvest_income";
  rowIndex: number;
  date: string;
  weekStartDate: string;
  amountUsd: string;
};

type CashMovementRecord = {
  kind: "cash_movement";
  rowIndex: number;
  direction: CashMovementDirection;
  date: string;
  weekStartDate: string;
  amountUsd: string;
  notes: string | null;
};

type ParsedRecord = ExpenseRecord | HarvestIncomeRecord | CashMovementRecord;

// Weekly expense column → category metadata. Headers are case-insensitive.
const WEEKLY_COLUMN_MAP: Record<
  string,
  { category: ExpenseCategoryType; label: string }
> = {
  water: { category: "operating_bills", label: "Water deliveries" },
  jornales: { category: "labor_harvest", label: "Jornales" },
  chavito: { category: "labor_overhead", label: "Chavito" },
  pocho: { category: "labor_overhead", label: "Engineer" },
  joe: { category: "labor_overhead", label: "Engineer" },
  "pocho/joe": { category: "labor_overhead", label: "Engineer" },
  engineer: { category: "labor_overhead", label: "Engineer" },
  isaac: { category: "labor_overhead", label: "Isaac" },
};

// Weekly headers we explicitly skip (totals + structural).
const WEEKLY_IGNORED_HEADERS = new Set([
  "date",
  "weekly total",
  "total",
  "totals",
  "",
]);

// Returns `true` for any col-B value that should NOT be treated as a weekly
// data row (totals, year labels, blank).
function isWeeklyTerminator(value: unknown): boolean {
  const v = normalize(value);
  if (!v) return true;
  if (v === "totals") return true;
  if (v === "total") return true;
  if (/total/i.test(String(value))) return true; // "January Totals", "2025 Total", "Gross", "Net"
  if (/^\d{4}$/.test(v)) return true; // year label like "2024"
  // Any of the section title strings appearing in col B → bail
  for (const titles of Object.values(SECTION_TITLES)) {
    if (titles.includes(v as never)) return true;
  }
  return false;
}

function parseWeeklySection(
  rows: unknown[][],
  start: SectionStart,
  sections: SectionStart[]
): { records: ParsedRecord[]; errors: Array<{ row: number; reason: string }>; unknownHeaders: string[] } {
  const errors: Array<{ row: number; reason: string }> = [];
  const records: ParsedRecord[] = [];
  const unknownHeaders: string[] = [];

  // Header row is the row immediately after the title.
  const headerRowIdx = start.titleRow + 1;
  const headerRow = rows[headerRowIdx] ?? [];

  // Locate "Date" column at-or-after start.titleCol — this is where the
  // weekly table's date column lives. The category columns extend from
  // there until the next section's title column, or until the row ends.
  const dateCol = (() => {
    for (let c = start.titleCol; c < headerRow.length; c++) {
      if (normalize(headerRow[c]) === "date") return c;
    }
    return -1;
  })();
  if (dateCol === -1) {
    errors.push({ row: headerRowIdx + 1, reason: "Weekly section: no Date column found in header row" });
    return { records, errors, unknownHeaders };
  }

  // Build header → column map for THIS section. The category columns sit
  // between dateCol+1 and the next non-data marker. Ignore columns past
  // the section's right edge (where another sub-table starts).
  const rightEdgeCol = (() => {
    // Earliest title col of any OTHER section that's on the same row band
    // and to the right of this title. Use a conservative window: all
    // sections within +/- 50 rows of this section's title.
    const others = sections.filter(
      (s) => s !== start && Math.abs(s.titleRow - start.titleRow) < 50 && s.titleCol > start.titleCol
    );
    if (others.length === 0) return headerRow.length;
    return Math.min(...others.map((s) => s.titleCol));
  })();

  // Assemble category columns. Track the "Other" note column position so we
  // can pair it with the adjacent unlabeled amount column.
  type CatCol =
    | { kind: "category"; col: number; category: ExpenseCategoryType; label: string }
    | { kind: "other_note"; noteCol: number; amountCol: number };
  const catCols: CatCol[] = [];
  let c = dateCol + 1;
  while (c < rightEdgeCol) {
    const h = normalize(headerRow[c]);
    if (WEEKLY_IGNORED_HEADERS.has(h)) {
      c++;
      continue;
    }
    if (h === "other") {
      // The amount cell is in the very next column (unlabeled in the header).
      catCols.push({ kind: "other_note", noteCol: c, amountCol: c + 1 });
      c += 2;
      continue;
    }
    const def = WEEKLY_COLUMN_MAP[h];
    if (def) {
      catCols.push({ kind: "category", col: c, category: def.category, label: def.label });
      c++;
      continue;
    }
    unknownHeaders.push(h);
    c++;
  }

  // Walk data rows from headerRow+1 downward. Stop when we hit another
  // weekly_expenses section (same kind, different titleRow) or pass the
  // last row of the sheet.
  const nextWeeklyTitleRow =
    sections
      .filter((s) => s.kind === "weekly_expenses" && s.titleRow > start.titleRow)
      .map((s) => s.titleRow)
      .sort((a, b) => a - b)[0] ?? rows.length;

  for (let r = headerRowIdx + 1; r < nextWeeklyTitleRow; r++) {
    const row = rows[r] ?? [];
    const dateCell = row[dateCol];
    if (isWeeklyTerminator(dateCell)) continue;
    const iso = parseDateCell(dateCell);
    if (!iso) {
      if (typeof dateCell === "string" && /\d/.test(dateCell)) {
        errors.push({ row: r + 1, reason: `Weekly: could not parse date '${dateCell}'` });
      }
      continue;
    }
    if (!inYearFilter(iso)) continue;
    const week = sundayOf(iso);

    for (const cc of catCols) {
      if (cc.kind === "category") {
        const amt = parseAmount(row[cc.col]);
        if (!amt) continue;
        records.push({
          kind: "expense",
          rowIndex: r + 1,
          subSection: "weekly",
          entryDate: iso,
          weekStartDate: week,
          categoryType: cc.category,
          categoryLabel: cc.label,
          amountUsd: amt,
          payee: cc.label,
          notes: null,
        });
      } else {
        // other_note pair
        const note = String(row[cc.noteCol] ?? "").trim();
        const amt = parseAmount(row[cc.amountCol]);
        if (!amt) continue;
        records.push({
          kind: "expense",
          rowIndex: r + 1,
          subSection: "weekly",
          entryDate: iso,
          weekStartDate: week,
          categoryType: "other",
          categoryLabel: note || "Other",
          amountUsd: amt,
          payee: null,
          notes: note || null,
        });
      }
    }
  }

  return { records, errors, unknownHeaders };
}

// Two-column sub-tables: capital_in / capital_out / harvest_income / other_purchases.
// Title row is at start.titleRow, col=titleCol.
// Header row is at titleRow+1 with "Date" / "Amount" (and sometimes a third
// description column to the right).
function parseTwoColSection(
  rows: unknown[][],
  start: SectionStart
): { records: ParsedRecord[]; errors: Array<{ row: number; reason: string }> } {
  const errors: Array<{ row: number; reason: string }> = [];
  const records: ParsedRecord[] = [];

  const headerRowIdx = start.titleRow + 1;
  const headerRow = rows[headerRowIdx] ?? [];
  const dateCol = (() => {
    for (let c = start.titleCol; c < Math.min(start.titleCol + 6, headerRow.length); c++) {
      if (normalize(headerRow[c]) === "date") return c;
    }
    return -1;
  })();
  if (dateCol === -1) {
    errors.push({
      row: headerRowIdx + 1,
      reason: `${start.kind}: no Date column found in header row at col ${start.titleCol}`,
    });
    return { records, errors };
  }
  const amountCol = (() => {
    for (let c = dateCol + 1; c < Math.min(dateCol + 4, headerRow.length); c++) {
      if (normalize(headerRow[c]) === "amount") return c;
    }
    return -1;
  })();
  if (amountCol === -1) {
    errors.push({
      row: headerRowIdx + 1,
      reason: `${start.kind}: no Amount column found after date col ${dateCol}`,
    });
    return { records, errors };
  }
  // Optional description: the column right after Amount when there's a free-text
  // note column (e.g., the 2025 capital_in section has a description col).
  const descCol = amountCol + 1 < headerRow.length ? amountCol + 1 : -1;

  // Walk down. Stop when we hit "Total"/"Totals" in dateCol (table footer)
  // OR encounter a row that's empty in BOTH dateCol and amountCol AND has
  // an empty next-row-too (i.e., truly past the table).
  let consecutiveEmpty = 0;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const dCell = row[dateCol];
    const aCell = row[amountCol];
    const dNorm = normalize(dCell);
    if (dNorm === "total" || dNorm === "totals") break;

    // Some sub-tables put their data on rows that ALSO carry weekly-section
    // data on the left. We just look at our own columns.
    if ((dCell === null || dCell === undefined || dCell === "") && (aCell === null || aCell === undefined || aCell === "")) {
      consecutiveEmpty++;
      // Bail after a few empties — we've left the table.
      if (consecutiveEmpty >= 6) break;
      continue;
    }
    consecutiveEmpty = 0;

    const iso = parseDateCell(dCell);
    if (!iso) {
      // Description-only rows (e.g. "Lights and Buckets" with no date) are
      // skipped silently — they're cosmetic in the source sheet.
      continue;
    }
    const amt = parseAmount(aCell);
    if (!amt) continue;
    if (!inYearFilter(iso)) continue;

    const week = sundayOf(iso);
    const note = descCol >= 0 ? String(row[descCol] ?? "").trim() : "";

    if (start.kind === "harvest_income") {
      records.push({ kind: "harvest_income", rowIndex: r + 1, date: iso, weekStartDate: week, amountUsd: amt });
    } else if (start.kind === "capital_in" || start.kind === "capital_out") {
      records.push({
        kind: "cash_movement",
        rowIndex: r + 1,
        direction: start.kind === "capital_in" ? "in_to_ec" : "out_to_us",
        date: iso,
        weekStartDate: week,
        amountUsd: amt,
        notes: note || null,
      });
    } else if (start.kind === "other_purchases") {
      // The "Other Farm Purchases" sub-table puts the purchase description
      // on the ROW BELOW the date+amount, in the same column as Amount
      // (not on the same row in a descCol). Peek forward and use that text
      // as the label when present.
      let belowNote = "";
      const next = rows[r + 1] ?? [];
      const nextDate = next[dateCol];
      const nextAmount = next[amountCol];
      const nextDateEmpty = nextDate === null || nextDate === undefined || nextDate === "";
      if (nextDateEmpty && typeof nextAmount === "string" && parseAmount(nextAmount) === null) {
        belowNote = nextAmount.trim();
      }
      const label = belowNote || note || "Other farm purchase";
      records.push({
        kind: "expense",
        rowIndex: r + 1,
        subSection: "other",
        entryDate: iso,
        weekStartDate: week,
        categoryType: "other",
        categoryLabel: label,
        amountUsd: amt,
        payee: null,
        notes: label,
      });
    }
  }

  return { records, errors };
}

// ── Main ──────────────────────────────────────────────────────────────

function loadRows(): unknown[][] {
  if (!existsSync(SHEET_PATH)) {
    console.error(`Master sheet not found at: ${SHEET_PATH}`);
    console.error(`Set MASTER_SHEET_PATH or drop the export at scripts/data/master_sheet.{xlsx,csv}`);
    process.exit(1);
  }
  console.log(`Reading: ${SHEET_PATH}`);
  const ext = extname(SHEET_PATH).toLowerCase();
  const buf = readFileSync(SHEET_PATH);
  let wb: XLSX.WorkBook;
  if (ext === ".csv") {
    wb = XLSX.read(buf.toString("utf8"), { type: "string", cellDates: true });
  } else {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  }
  const sheet = wb.Sheets[SHEET_TAB_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    console.error(`No sheet found. Available: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
}

async function main() {
  const rows = loadRows();
  if (rows.length === 0) {
    console.error("Sheet is empty.");
    process.exit(1);
  }
  if (YEAR_FILTER !== null) console.log(`Year filter: ${YEAR_FILTER}`);
  if (DRY_RUN) console.log(`Mode: DRY RUN (no DB writes)`);

  const sections = detectSections(rows);
  console.log(`Detected ${sections.length} sub-table sections:`);
  for (const s of sections) {
    console.log(`  - ${s.kind} @ row ${s.titleRow + 1}, col ${s.titleCol}`);
  }

  const allRecords: ParsedRecord[] = [];
  const allErrors: Array<{ row: number; reason: string }> = [];
  const allUnknownHeaders = new Set<string>();
  const sectionsTouched: Record<SectionKind, number> = {
    weekly_expenses: 0,
    capital_in: 0,
    capital_out: 0,
    harvest_income: 0,
    other_purchases: 0,
  };

  for (const s of sections) {
    if (s.kind === "weekly_expenses") {
      const { records, errors, unknownHeaders } = parseWeeklySection(rows, s, sections);
      allRecords.push(...records);
      allErrors.push(...errors);
      unknownHeaders.forEach((h) => allUnknownHeaders.add(h));
      sectionsTouched.weekly_expenses += records.length > 0 ? 1 : 0;
    } else {
      const { records, errors } = parseTwoColSection(rows, s);
      allRecords.push(...records);
      allErrors.push(...errors);
      sectionsTouched[s.kind] += records.length > 0 ? 1 : 0;
    }
  }

  // Tally records by kind for the report.
  const tallies = {
    weeklyExpense: 0,
    otherExpense: 0,
    harvestIncome: 0,
    capitalIn: 0,
    capitalOut: 0,
  };
  for (const rec of allRecords) {
    if (rec.kind === "expense") {
      if (rec.subSection === "weekly") tallies.weeklyExpense++;
      else tallies.otherExpense++;
    } else if (rec.kind === "harvest_income") tallies.harvestIncome++;
    else if (rec.kind === "cash_movement") {
      if (rec.direction === "in_to_ec") tallies.capitalIn++;
      else tallies.capitalOut++;
    }
  }

  console.log(`\nParsed records:`);
  console.log(`  weekly expense rows:    ${tallies.weeklyExpense}`);
  console.log(`  other-purchase expenses:${tallies.otherExpense}`);
  console.log(`  harvest income rows:    ${tallies.harvestIncome}`);
  console.log(`  capital_in cash movs:   ${tallies.capitalIn}`);
  console.log(`  capital_out cash movs:  ${tallies.capitalOut}`);

  // Sums for cross-reference against the sheet's printed totals.
  const sum = (rs: ParsedRecord[], pred: (r: ParsedRecord) => boolean) =>
    rs.filter(pred).reduce((acc, r) => acc + parseFloat((r as { amountUsd: string }).amountUsd), 0);
  const totals = {
    weeklyExpenseUsd: sum(allRecords, (r) => r.kind === "expense" && r.subSection === "weekly"),
    otherExpenseUsd: sum(allRecords, (r) => r.kind === "expense" && r.subSection === "other"),
    harvestIncomeUsd: sum(allRecords, (r) => r.kind === "harvest_income"),
    capitalInUsd: sum(allRecords, (r) => r.kind === "cash_movement" && r.direction === "in_to_ec"),
    capitalOutUsd: sum(allRecords, (r) => r.kind === "cash_movement" && r.direction === "out_to_us"),
  };
  console.log(`\nTotals (USD):`);
  console.log(`  weekly expenses:        $${totals.weeklyExpenseUsd.toFixed(2)}`);
  console.log(`  other-purchase expenses:$${totals.otherExpenseUsd.toFixed(2)}`);
  console.log(`  harvest income:         $${totals.harvestIncomeUsd.toFixed(2)}`);
  console.log(`  capital_in (US→EC):     $${totals.capitalInUsd.toFixed(2)}`);
  console.log(`  capital_out (EC→US):    $${totals.capitalOutUsd.toFixed(2)}`);

  // Per-category breakdown of weekly expenses, for cross-checking against
  // the sheet's "X Totals" column sums.
  const byCategory = new Map<string, number>();
  for (const rec of allRecords) {
    if (rec.kind !== "expense" || rec.subSection !== "weekly") continue;
    const k = rec.categoryType === "other" ? "Other (notes)" : rec.categoryLabel;
    byCategory.set(k, (byCategory.get(k) ?? 0) + parseFloat(rec.amountUsd));
  }
  console.log(`\nWeekly expenses by category:`);
  for (const [k, v] of [...byCategory.entries()].sort()) {
    console.log(`  ${k.padEnd(20)} $${v.toFixed(2)}`);
  }

  if (allUnknownHeaders.size > 0) {
    console.log(`\nUnknown weekly headers (extend WEEKLY_COLUMN_MAP):`);
    for (const h of allUnknownHeaders) console.log(`  - "${h}"`);
  }
  if (allErrors.length > 0) {
    console.log(`\nErrors (${allErrors.length}):`);
    for (const e of allErrors.slice(0, 30)) console.log(`  row ${e.row}: ${e.reason}`);
    if (allErrors.length > 30) console.log(`  ... ${allErrors.length - 30} more`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — no DB writes. Sample records:`);
    const samples: ParsedRecord[] = [];
    for (const wantKind of ["expense", "harvest_income", "cash_movement"] as const) {
      const found = allRecords.filter((r) => r.kind === wantKind).slice(0, 2);
      samples.push(...found);
    }
    console.log(JSON.stringify(samples, null, 2));
    return;
  }

  // ── DB writes ───────────────────────────────────────────────────────

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.slug, ACCOUNT_SLUG))
    .limit(1);
  if (!account) {
    console.error(`Account "${ACCOUNT_SLUG}" not found. Run pnpm db:seed first.`);
    process.exit(1);
  }
  // No processor lookup. The master sheet's "Harvest payments received"
  // column doesn't say which processor sent the money, so we leave it null
  // for the historical entries. Going forward, manual entries via the UI
  // capture the processor explicitly.

  const yearFrom = YEAR_FILTER !== null ? `${YEAR_FILTER}-01-01` : null;
  const yearTo = YEAR_FILTER !== null ? `${YEAR_FILTER}-12-31` : null;

  // Idempotency: clear prior ingests scoped by year. Filter on the natural
  // event date (entry/transfer/harvest) NOT week_start_date — Sunday-start
  // weeks mean an early-January entry's weekStartDate can fall in the
  // previous calendar year, which would dodge a weekStartDate-based filter
  // and produce duplicates on re-run.
  const expDelWhere = yearFrom
    ? and(
        like(expenseEntries.source, `${SOURCE_PREFIX}%`),
        gte(expenseEntries.entryDate, yearFrom),
        lte(expenseEntries.entryDate, yearTo!)
      )
    : like(expenseEntries.source, `${SOURCE_PREFIX}%`);
  const expDel = await db.delete(expenseEntries).where(expDelWhere).returning({ id: expenseEntries.id });
  console.log(`Cleared ${expDel.length} prior expense entries${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  const cmDelWhere = yearFrom
    ? and(
        like(cashMovements.source, `${SOURCE_PREFIX}%`),
        gte(cashMovements.transferDate, yearFrom),
        lte(cashMovements.transferDate, yearTo!)
      )
    : like(cashMovements.source, `${SOURCE_PREFIX}%`);
  const cmDel = await db.delete(cashMovements).where(cmDelWhere).returning({ id: cashMovements.id });
  console.log(`Cleared ${cmDel.length} prior cash movements${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  const harvDelWhere = yearFrom
    ? and(
        like(harvests.lotNumber, `${SOURCE_PREFIX}%`),
        gte(harvests.harvestDate, yearFrom),
        lte(harvests.harvestDate, yearTo!)
      )
    : like(harvests.lotNumber, `${SOURCE_PREFIX}%`);
  const harvDel = await db.delete(harvests).where(harvDelWhere).returning({ id: harvests.id });
  console.log(`Cleared ${harvDel.length} prior ingested harvests${YEAR_FILTER ? ` (year ${YEAR_FILTER})` : ""}.`);

  // Insert.
  const counts = { expenses: 0, harvests: 0, cashMovements: 0 };
  for (const rec of allRecords) {
    if (rec.kind === "expense") {
      const sub = rec.subSection === "weekly" ? "weekly" : "other";
      const source = `${SOURCE_PREFIX}${sub}:row_${rec.rowIndex}`;
      await db.insert(expenseEntries).values({
        entryDate: rec.entryDate,
        weekStartDate: rec.weekStartDate,
        categoryType: rec.categoryType,
        categoryLabel: rec.categoryLabel,
        amountUsd: rec.amountUsd,
        accountId: account.id,
        payee: rec.payee,
        notes: rec.notes,
        source,
      });
      counts.expenses++;
    } else if (rec.kind === "harvest_income") {
      const source = `${SOURCE_PREFIX}harvest:row_${rec.rowIndex}`;
      const [{ id: harvestId }] = await db
        .insert(harvests)
        .values({
          harvestDate: rec.date,
          weekStartDate: rec.weekStartDate,
          processorCompanyId: null, // unattributed; master-sheet doesn't name the processor
          lotNumber: source,
          kgDelivered: "0",
          notes: "Backfilled from master sheet — processor unattributed; kg + grade detail TBD.",
        })
        .returning({ id: harvests.id });
      await db.insert(harvestSettlements).values({
        harvestId,
        settlementDate: rec.date,
        kgManifested: "0",
        kgProcessed: "0",
        kgWaste: "0",
        subtotalUsd: rec.amountUsd,
        retentionUsd: "0",
        netPayUsd: rec.amountUsd,
        paidToAccountId: account.id,
        paidDate: rec.date,
      });
      counts.harvests++;
    } else if (rec.kind === "cash_movement") {
      const sub = rec.direction === "in_to_ec" ? "cap_in" : "cap_out";
      const source = `${SOURCE_PREFIX}${sub}:row_${rec.rowIndex}`;
      await db.insert(cashMovements).values({
        transferDate: rec.date,
        weekStartDate: rec.weekStartDate,
        direction: rec.direction,
        amountUsd: rec.amountUsd,
        accountId: account.id,
        counterparty: rec.direction === "in_to_ec" ? "James US" : "US side",
        notes: rec.notes,
        source,
      });
      counts.cashMovements++;
    }
  }

  console.log(
    `\nInserted ${counts.expenses} expenses + ${counts.harvests} harvests + ${counts.cashMovements} cash movements.`
  );

  // Write the report.
  const reportPath = resolve("scripts/ingest_master_sheet.report.md");
  const lines = [
    `# Master sheet ingest report`,
    `Run: ${new Date().toISOString()}`,
    `Source: ${SHEET_PATH}`,
    `Year filter: ${YEAR_FILTER ?? "(none)"}`,
    ``,
    `## Records`,
    `- Weekly expense rows: ${tallies.weeklyExpense}`,
    `- Other-purchase expenses: ${tallies.otherExpense}`,
    `- Harvest income rows: ${tallies.harvestIncome}`,
    `- Capital_in cash movements: ${tallies.capitalIn}`,
    `- Capital_out cash movements: ${tallies.capitalOut}`,
    ``,
    `## Totals (USD)`,
    `- Weekly expenses: $${totals.weeklyExpenseUsd.toFixed(2)}`,
    `- Other-purchase expenses: $${totals.otherExpenseUsd.toFixed(2)}`,
    `- Harvest income: $${totals.harvestIncomeUsd.toFixed(2)}`,
    `- Capital_in (US→EC): $${totals.capitalInUsd.toFixed(2)}`,
    `- Capital_out (EC→US): $${totals.capitalOutUsd.toFixed(2)}`,
    ``,
    `## Unknown weekly headers`,
    [...allUnknownHeaders].map((h) => `- \`${h}\``).join("\n") || "(none)",
    ``,
    `## Errors`,
    allErrors.map((e) => `- Row ${e.row}: ${e.reason}`).join("\n") || "(none)",
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
