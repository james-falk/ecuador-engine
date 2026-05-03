// Migration 0011: buyers table + pricing_inputs table.
//
// Buyers — stage-based CRM rows for the Selling pillar.
// Pricing inputs — single-row table backing the editable cells of the
// Selling pricing model. We keep the constants in the DB (not env) so an
// operator can tweak fruit cost / kg-per-carton / packing without a
// deploy.
//
// Idempotent: tolerates "already exists" errors.

import "./_env";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "CREATE TYPE buyer_stage",
    sql: `CREATE TYPE "buyer_stage" AS ENUM ('lead', 'in_conversation', 'negotiating', 'active', 'lost')`,
  },
  {
    label: "CREATE TABLE buyers",
    sql: `CREATE TABLE "buyers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "contact_name" text,
      "contact_email" text,
      "contact_phone" text,
      "country" text,
      "stage" "buyer_stage" NOT NULL DEFAULT 'lead',
      "notes" text,
      "pricing_notes" text,
      "next_action" text,
      "next_action_date" date,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      "last_touched_at" timestamp with time zone
    )`,
  },
  {
    label: "INDEX buyers(stage)",
    sql: `CREATE INDEX IF NOT EXISTS "buyers_stage_idx" ON "buyers"("stage")`,
  },
  {
    label: "CREATE TABLE pricing_inputs",
    sql: `CREATE TABLE "pricing_inputs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "fruit_cost_per_kg_usd" numeric(10,4) NOT NULL DEFAULT 2.0000,
      "kg_per_carton" numeric(10,4) NOT NULL DEFAULT 4.5000,
      "label_cost_per_carton_usd" numeric(10,4) NOT NULL DEFAULT 0.1000,
      "packing_cost_per_carton_usd" numeric(10,4) NOT NULL DEFAULT 1.6000,
      "material_cost_per_carton_usd" numeric(10,4) NOT NULL DEFAULT 0.3000,
      "ecuador_transport_usd" numeric(10,2) NOT NULL DEFAULT 400.00,
      "ocean_freight_usd" numeric(10,2) NOT NULL DEFAULT 7000.00,
      "import_customs_usd" numeric(10,2) NOT NULL DEFAULT 1200.00,
      "cartons_per_20ft" integer NOT NULL DEFAULT 1920,
      "cartons_per_40ft" integer NOT NULL DEFAULT 3840,
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  },
  // Seed a single row of defaults pulled directly from the Pricing Sheet.xlsx
  // James shared. Idempotent: only inserts if no row exists.
  {
    label: "SEED default pricing inputs",
    sql: `INSERT INTO "pricing_inputs"
      (fruit_cost_per_kg_usd, kg_per_carton, label_cost_per_carton_usd, packing_cost_per_carton_usd, material_cost_per_carton_usd,
       ecuador_transport_usd, ocean_freight_usd, import_customs_usd, cartons_per_20ft, cartons_per_40ft)
      SELECT 2.0000, 4.5000, 0.1000, 1.6000, 0.3000, 400.00, 7000.00, 1200.00, 1920, 3840
      WHERE NOT EXISTS (SELECT 1 FROM "pricing_inputs")`,
  },
];

async function run(stmts: Array<{ label: string; sql: string }>) {
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    console.log(`[${i + 1}/${stmts.length}] ${s.label}`);
    try {
      await db.execute(sql.raw(s.sql));
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (/already exists/i.test(msg) || /duplicate column/i.test(msg)) {
        console.log(`     SKIPPED: ${msg}`);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log("=== Migration 0011: buyers + pricing_inputs ===");
  await run(STATEMENTS);
  console.log("\nMigration 0011 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION 0011 FAILED:", e);
    process.exit(1);
  });
