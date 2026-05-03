// One-shot: confirm whether the autonomous agent has actually written
// data into the agent-owned tables (pricing_snapshots, lead_proposals,
// lead_contact_history). Reports row counts + a few sample rows.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function summarize(table: string, sourceCol = "source") {
  try {
    const total = await db.execute<{ count: number }>(
      sql.raw(`SELECT count(*)::int AS count FROM "${table}"`)
    );
    const recent = await db.execute<{ inserted_at: string; source: string }>(
      sql.raw(`SELECT inserted_at::text, ${sourceCol} AS source FROM "${table}" ORDER BY inserted_at DESC LIMIT 5`)
    );
    const bySource = await db.execute<{ source: string; count: number }>(
      sql.raw(`SELECT ${sourceCol} AS source, count(*)::int AS count FROM "${table}" GROUP BY ${sourceCol} ORDER BY count DESC`)
    );
    console.log(`\n## ${table}`);
    console.log(`  rows: ${total.rows[0]?.count ?? 0}`);
    if (bySource.rows.length > 0) {
      console.log(`  by source:`);
      for (const r of bySource.rows) console.log(`    ${r.source}: ${r.count}`);
    }
    if (recent.rows.length > 0) {
      console.log(`  recent (newest first):`);
      for (const r of recent.rows) console.log(`    ${r.inserted_at}  ${r.source}`);
    }
  } catch (e) {
    console.log(`\n## ${table}`);
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

async function main() {
  await summarize("pricing_snapshots");
  await summarize("lead_proposals");

  // lead_contact_history doesn't have a source column — different shape.
  try {
    const total = await db.execute<{ count: number }>(
      sql.raw(`SELECT count(*)::int AS count FROM "lead_contact_history"`)
    );
    const recent = await db.execute<{ inserted_at: string; interaction_type: string }>(
      sql.raw(`SELECT inserted_at::text, interaction_type FROM "lead_contact_history" ORDER BY inserted_at DESC LIMIT 5`)
    );
    console.log(`\n## lead_contact_history`);
    console.log(`  rows: ${total.rows[0]?.count ?? 0}`);
    if (recent.rows.length > 0) {
      console.log(`  recent:`);
      for (const r of recent.rows) console.log(`    ${r.inserted_at}  ${r.interaction_type}`);
    }
  } catch (e) {
    console.log(`\n## lead_contact_history`);
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Also check intel_documents (mine, just created).
  await summarize("intel_documents");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Check failed:", e);
  process.exit(1);
});
