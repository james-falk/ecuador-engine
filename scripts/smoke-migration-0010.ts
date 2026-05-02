// Smoke test for migration 0010 (BUILD_LOG item #1).
//
// Schema-only — does NOT touch the database. Confirms:
//   • The three new schema modules export valid Drizzle table objects.
//   • Each table has the minimum required columns the migration SQL creates.
//   • lead_proposals carries a `dedupe_key` column (the dedupe contract).
//
// The full DB-side check (`scripts/check-tables.ts`) requires DATABASE_URL,
// which the nightly build environment does not have. Once James applies
// migration 0010 against Neon, that script confirms the tables actually
// exist in the running database.

import { getTableColumns, getTableName } from "drizzle-orm";
import {
  pricingSnapshots,
  leadProposals,
  leadContactHistory,
} from "../src/db/schema";

type Tbl = {
  label: string;
  // any-typed because the Drizzle table type is opaque and we only need
  // it to feed into the helpers below.
  table: any;
  expectedDbName: string;
  required: string[];
};

const TABLES: Tbl[] = [
  {
    label: "pricingSnapshots",
    table: pricingSnapshots,
    expectedDbName: "pricing_snapshots",
    required: ["id", "capturedAt", "source", "market", "insertedAt"],
  },
  {
    label: "leadProposals",
    table: leadProposals,
    expectedDbName: "lead_proposals",
    required: [
      "id",
      "capturedAt",
      "source",
      "companyName",
      "status",
      "dedupeKey",
      "insertedAt",
    ],
  },
  {
    label: "leadContactHistory",
    table: leadContactHistory,
    expectedDbName: "lead_contact_history",
    required: [
      "id",
      "interactionType",
      "interactionAt",
      "capturedAt",
      "insertedAt",
    ],
  },
];

let failed = false;
for (const { label, table, expectedDbName, required } of TABLES) {
  let dbName: string;
  let cols: string[];
  try {
    dbName = getTableName(table);
    cols = Object.keys(getTableColumns(table));
  } catch (e) {
    console.log(`FAIL: ${label} — not a Drizzle table (${(e as Error).message})`);
    failed = true;
    continue;
  }

  if (dbName !== expectedDbName) {
    console.log(
      `FAIL: ${label} — db name mismatch (got "${dbName}", expected "${expectedDbName}")`,
    );
    failed = true;
    continue;
  }

  const missing = required.filter((r) => !cols.includes(r));
  if (missing.length > 0) {
    console.log(
      `FAIL: ${label} (db: ${dbName}) missing columns: ${missing.join(", ")}`,
    );
    failed = true;
    continue;
  }

  console.log(
    `OK:   ${label} -> ${dbName} (${cols.length} columns; required present: ${required.join(", ")})`,
  );
}

if (failed) {
  console.log("\nSMOKE FAILED");
  process.exit(1);
}
console.log("\nSMOKE PASSED");
process.exit(0);
