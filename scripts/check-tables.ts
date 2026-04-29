import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  const r = await db.execute(
    sql`select table_name from information_schema.tables where table_schema='public' order by table_name`
  );
  console.log("TABLES:", r.rows.map((row) => row.table_name).join(", "));
  const enums = await db.execute(
    sql`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname='public' and t.typtype='e' order by t.typname`
  );
  console.log("ENUMS: ", enums.rows.map((row) => row.typname).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
