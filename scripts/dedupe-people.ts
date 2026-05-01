// One-shot: collapse duplicate people rows. The original `seed.ts` created
// "James Falk", "Peter (Pete)", "Isaac Garcia". A later one-off
// (`seed-internal-people.ts`) added shorter "James", "Peter", "Isaac".
// The pickers show both copies — fix by keeping the older row (which has
// FK references from compliance / expenses), renaming it to the first
// name only, and deleting the duplicate.

import "./_env";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { people, tasks, complianceItems, expenseEntries } from "../src/db/schema";

type Pair = { keepName: string; keepRole: typeof people.$inferInsert.role; dropName: string };

const PAIRS: Pair[] = [
  { keepName: "James Falk",    keepRole: "owner",    dropName: "James" },
  { keepName: "Peter (Pete)",  keepRole: "co_owner", dropName: "Peter" },
  { keepName: "Isaac Garcia",  keepRole: "operator", dropName: "Isaac" },
];

async function main() {
  for (const p of PAIRS) {
    const keep = await db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(eq(people.name, p.keepName))
      .limit(1);
    const drop = await db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(eq(people.name, p.dropName))
      .limit(1);

    if (keep.length === 0) {
      console.log(`! canonical "${p.keepName}" not found — skipping`);
      continue;
    }

    const canonicalId = keep[0].id;
    const firstName = p.keepName.split(" ")[0]; // "James", "Peter", "Isaac"

    if (drop.length > 0) {
      const dupId = drop[0].id;
      // Move any FK references from the duplicate to the canonical row.
      console.log(`> reassigning FKs from ${p.dropName} (${dupId}) to ${p.keepName} (${canonicalId})`);

      await db.update(tasks).set({ assigneePersonId: canonicalId }).where(eq(tasks.assigneePersonId, dupId));
      await db.update(complianceItems).set({ responsiblePersonId: canonicalId }).where(eq(complianceItems.responsiblePersonId, dupId));
      await db.update(expenseEntries).set({ payeePersonId: canonicalId }).where(eq(expenseEntries.payeePersonId, dupId));

      await db.delete(people).where(eq(people.id, dupId));
      console.log(`  - dropped ${p.dropName} row`);
    }

    // Rename canonical to first name only.
    if (keep[0].name !== firstName) {
      await db.update(people).set({ name: firstName }).where(eq(people.id, canonicalId));
      console.log(`  - renamed ${p.keepName} → ${firstName}`);
    }
  }

  // Print summary of internal trio.
  const finalRows = await db
    .select({ id: people.id, name: people.name, role: people.role })
    .from(people)
    .where(inArray(people.role, ["owner", "co_owner", "operator"] as const));
  console.log("\nInternal trio after dedupe:");
  for (const r of finalRows) console.log(`  ${r.name.padEnd(8)} ${r.role.padEnd(10)} ${r.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("dedupe failed:", e);
    process.exit(1);
  });
