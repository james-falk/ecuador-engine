// Smoke test for the market-intel agent — dry-run with USDA_TEST_MODE=true.
// DATABASE_URL is not required; dryRun=true skips all DB writes.
// Exit 0 = pass, exit 1 = fail.

import { fetchUsdaAmsRows } from "../src/lib/agents/market-intel/sources/usda-ams";
import { runMarketIntelAgent } from "../src/lib/agents/market-intel/run";

async function main() {
  console.log("smoke-market-intel: running USDA AMS source with test fixture...");

  // 1. Unit-level: fetch rows in test mode
  const rows = await fetchUsdaAmsRows(true);

  if (rows.length === 0) {
    console.error("FAIL: fetchUsdaAmsRows returned 0 rows in test mode (expected >= 1)");
    process.exit(1);
  }
  console.log(`  fetchUsdaAmsRows: ${rows.length} rows — OK`);

  // 2. Verify at least one Ecuador row (the fixture has one)
  const ecuadorRows = rows.filter((r) => r.origin === "ecuador");
  if (ecuadorRows.length === 0) {
    console.error("FAIL: no Ecuador rows found in fixture output");
    process.exit(1);
  }
  console.log(`  ecuador-origin rows: ${ecuadorRows.length} — OK`);

  // 3. Verify no-price rows are filtered out (fixture has one empty-price record)
  const noPriceRows = rows.filter((r) => r.priceLow === null && r.priceHigh === null);
  if (noPriceRows.length > 0) {
    console.error(`FAIL: ${noPriceRows.length} rows with no price should have been filtered`);
    process.exit(1);
  }
  console.log("  no-price filter: OK");

  // 4. Integration-level: runMarketIntelAgent dry-run
  console.log("smoke-market-intel: running agent in dry-run mode...");
  // Stub DATABASE_URL so db import doesn't throw at module init
  process.env.DATABASE_URL = "postgres://smoke:test@localhost:5432/smoke";

  const result = await runMarketIntelAgent({ testMode: true, dryRun: true });

  if (result.rowsWritten === 0) {
    console.error("FAIL: dry-run reported 0 rowsWritten (expected >= 1)");
    process.exit(1);
  }
  console.log(`  dry-run rowsWritten: ${result.rowsWritten} — OK`);
  console.log(`  sources: ${result.sources.join(", ")}`);

  console.log("\nsmoke-market-intel: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
