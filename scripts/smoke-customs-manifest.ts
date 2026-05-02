// Smoke test for the customs-manifest market-intel source.
// Exercises both happy-path (test fixture) and upstream-down (no API key)
// branches per BUILD_LOG item #3 acceptance criteria. No DB access needed.
// Exit 0 = pass, exit 1 = fail.

import { fetchCustomsManifestRows } from "../src/lib/agents/market-intel/sources/customs-manifest";
import { runMarketIntelAgent } from "../src/lib/agents/market-intel/run";

async function main() {
  console.log("smoke-customs-manifest: running with test fixture...");

  // 1. Happy path: test mode returns parsed shipment rows.
  const rows = await fetchCustomsManifestRows(true);
  if (rows.length === 0) {
    console.error("FAIL: fetchCustomsManifestRows(test) returned 0 rows (expected >= 1)");
    process.exit(1);
  }
  console.log(`  fixture rows: ${rows.length} — OK`);

  // 2. Non-dragon-fruit fixture row must be filtered out.
  if (rows.length !== 2) {
    console.error(
      `FAIL: expected 2 dragon fruit rows after non-target filter, got ${rows.length}`,
    );
    process.exit(1);
  }
  console.log("  non-dragon-fruit filter: OK");

  // 3. At least one Ecuador-origin shipment in the fixture.
  const ecuadorRows = rows.filter((r) => r.origin === "ecuador");
  if (ecuadorRows.length === 0) {
    console.error("FAIL: no Ecuador-origin shipments in fixture output");
    process.exit(1);
  }
  console.log(`  ecuador-origin shipments: ${ecuadorRows.length} — OK`);

  // 4. Source/market are wired correctly for /pricing card filters later.
  const wrongSource = rows.find((r) => r.source !== "importyeti");
  const wrongMarket = rows.find((r) => r.market !== "import-manifest");
  if (wrongSource || wrongMarket) {
    console.error("FAIL: source/market mismatch — must be importyeti/import-manifest");
    process.exit(1);
  }
  console.log("  source=importyeti, market=import-manifest: OK");

  // 5. Shipment rows carry null prices (manifests don't publish FOB).
  const withPrices = rows.filter((r) => r.priceLow !== null || r.priceHigh !== null);
  if (withPrices.length > 0) {
    console.error(
      `FAIL: shipment rows must carry null prices, found ${withPrices.length} with prices`,
    );
    process.exit(1);
  }
  console.log("  null-price invariant for shipments: OK");

  // 6. raw_blob preserved for audit + downstream buyer-scout consumption.
  const missingRawBlob = rows.find((r) => !r.rawBlob || !r.rawBlob.bill_of_lading);
  if (missingRawBlob) {
    console.error("FAIL: rawBlob missing or lost bill_of_lading after parse");
    process.exit(1);
  }
  console.log("  rawBlob preserved (bill_of_lading present): OK");

  // 7. Upstream-down path: no API key in env → 0 rows, no throw.
  const savedKey = process.env.IMPORTYETI_API_KEY;
  delete process.env.IMPORTYETI_API_KEY;
  try {
    const upstreamDown = await fetchCustomsManifestRows(false);
    if (upstreamDown.length !== 0) {
      console.error(
        `FAIL: expected 0 rows when no API key set, got ${upstreamDown.length}`,
      );
      process.exit(1);
    }
    console.log("  upstream-down (no API key) returns []: OK");
  } finally {
    if (savedKey !== undefined) process.env.IMPORTYETI_API_KEY = savedKey;
  }

  // 8. Integration-level: agent dry-run picks up customs-manifest rows alongside
  //    USDA. Stub DATABASE_URL so db import doesn't throw at module init.
  console.log("smoke-customs-manifest: running agent in dry-run mode (both sources)...");
  process.env.DATABASE_URL ??= "postgres://smoke:test@localhost:5432/smoke";
  const result = await runMarketIntelAgent({ testMode: true, dryRun: true });
  if (!result.sources.includes("importyeti")) {
    console.error(
      `FAIL: importyeti source not represented in dry-run output (got ${result.sources.join(", ")})`,
    );
    process.exit(1);
  }
  console.log(`  dry-run sources: ${result.sources.join(", ")} — OK`);

  console.log("\nsmoke-customs-manifest: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
