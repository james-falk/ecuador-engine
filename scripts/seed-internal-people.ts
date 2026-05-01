// One-shot: seed the three internal team members so the task assignee
// dropdown has someone to point at. Idempotent: matches on name + role to
// avoid creating duplicates on re-runs.

import "./_env";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { people } from "../src/db/schema";

type Seed = { name: string; role: typeof people.$inferInsert.role; country: string };

const SEEDS: Seed[] = [
  { name: "James", role: "owner", country: "US" },
  { name: "Peter", role: "co_owner", country: "US" },
  { name: "Isaac", role: "operator", country: "EC" },
];

async function main() {
  for (const seed of SEEDS) {
    const existing = await db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(and(eq(people.name, seed.name), eq(people.role, seed.role)))
      .limit(1);
    if (existing.length > 0) {
      console.log(`✓ ${seed.name} (${seed.role}) already present (id=${existing[0].id})`);
      continue;
    }
    const [row] = await db
      .insert(people)
      .values({
        name: seed.name,
        role: seed.role,
        country: seed.country,
        vettingStatus: "vetted",
      })
      .returning({ id: people.id });
    console.log(`+ inserted ${seed.name} (${seed.role}) → ${row.id}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
