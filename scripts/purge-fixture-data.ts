// One-shot: nuke any fixture/test data in agent-owned tables.
// James does not want mocked or incorrect data in the system.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function purge(table: string) {
  const before = await db.execute<{ count: number }>(
    sql.raw(`SELECT count(*)::int AS count FROM "${table}"`)
  );
  const beforeCount = before.rows[0]?.count ?? 0;
  if (beforeCount === 0) {
    console.log(`${table}: 0 rows — nothing to delete.`);
    return;
  }
  await db.execute(sql.raw(`DELETE FROM "${table}"`));
  const after = await db.execute<{ count: number }>(
    sql.raw(`SELECT count(*)::int AS count FROM "${table}"`)
  );
  const afterCount = after.rows[0]?.count ?? 0;
  console.log(`${table}: deleted ${beforeCount - afterCount} rows (${beforeCount} → ${afterCount}).`);
}

(async () => {
  await purge("pricing_snapshots");
  await purge("lead_proposals");
  await purge("lead_contact_history");
  await purge("intel_documents");
  console.log("\nDone. Agent tables are empty — ready for real data only.");
  process.exit(0);
})().catch((e) => {
  console.error("Purge failed:", e);
  process.exit(1);
});
