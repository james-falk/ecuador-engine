import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy initialization. Throwing at module-import time breaks Next.js build
// passes that import every page module to read its config (e.g. metadata)
// even when no actual query runs — including the default `/_not-found` page,
// which transitively imports the root layout and DB-touching queries. With a
// Proxy, importing this module is side-effect-free; the env-var check fires
// only on first query.
type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env.local and fill it in."
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = Db;
