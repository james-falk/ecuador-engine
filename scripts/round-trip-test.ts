// End-to-end round-trip on the expense + harvest pillars: read a row,
// update it via the action's underlying logic, read back, revert.

import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { expenseEntries, harvests, harvestSettlements } from "../src/db/schema";

async function main() {
  console.log("─── EXPENSE ROUND-TRIP ───");
  const [exp] = await db.select().from(expenseEntries).where(eq(expenseEntries.categoryLabel, "Chavito")).limit(1);
  if (!exp) {
    console.error("No Chavito row found — re-seed first.");
    process.exit(1);
  }
  console.log("BEFORE:", { amount: exp.amountUsd, notes: exp.notes });

  await db
    .update(expenseEntries)
    .set({ amountUsd: "999.99", notes: "test note", lastTouchedAt: new Date() })
    .where(eq(expenseEntries.id, exp.id));
  const [after] = await db.select().from(expenseEntries).where(eq(expenseEntries.id, exp.id)).limit(1);
  console.log("AFTER: ", { amount: after.amountUsd, notes: after.notes, touched: after.lastTouchedAt });

  await db
    .update(expenseEntries)
    .set({ amountUsd: exp.amountUsd, notes: exp.notes, lastTouchedAt: null })
    .where(eq(expenseEntries.id, exp.id));
  console.log("REVERTED expense.");

  console.log("\n─── HARVEST + SETTLEMENT ROUND-TRIP ───");
  const [h] = await db.select().from(harvests).where(eq(harvests.lotNumber, "12462")).limit(1);
  if (!h) {
    console.error("No harvest 12462 found — re-seed first.");
    process.exit(1);
  }
  const [s] = await db.select().from(harvestSettlements).where(eq(harvestSettlements.harvestId, h.id)).limit(1);
  console.log("BEFORE:", { lot: h.lotNumber, kg: h.kgDelivered, settled: !!s, paid: s?.paidDate });

  await db
    .update(harvestSettlements)
    .set({ paidDate: "2026-04-30", lastTouchedAt: new Date() })
    .where(eq(harvestSettlements.id, s.id));
  const [after2] = await db.select().from(harvestSettlements).where(eq(harvestSettlements.id, s.id)).limit(1);
  console.log("AFTER: ", { paidDate: after2.paidDate, touched: after2.lastTouchedAt });

  await db
    .update(harvestSettlements)
    .set({ paidDate: s.paidDate, lastTouchedAt: null })
    .where(eq(harvestSettlements.id, s.id));
  console.log("REVERTED settlement.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
