// Smoke test for the buyer-scout agent (Item #5).
//
// Exercises:
//   1. Dedupe canonicalization rules (punctuation, suffix stripping).
//   2. computeDedupeKey produces identical hashes for inputs that
//      canonicalize to the same identity.
//   3. computeDedupeKey produces different hashes for genuinely different
//      companies.
//   4. customs-manifest-leads source extracts >= 1 candidate from a fixture
//      pricing-snapshot-shaped array, with consignee aggregation.
//   5. runBuyerScoutAgent dry-run (testMode + dryRun + fixture) returns a
//      non-empty rows count without touching the DB.
//
// Exit 0 = pass, exit 1 = fail.

import {
  canonicalizeCompanyName,
  canonicalizeWebsite,
  computeDedupeKey,
  emailDomain,
} from "../src/lib/agents/buyer-scout/dedupe";
import {
  extractCandidatesFromShipments,
  type ShipmentRow,
} from "../src/lib/agents/buyer-scout/sources/customs-manifest-leads";
import { runBuyerScoutAgent } from "../src/lib/agents/buyer-scout/run";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function main() {
  console.log("smoke-buyer-scout: running...");

  // 1. Canonicalization rules.
  const canonChecks: Array<[string, string, string]> = [
    ["Frieda's Specialty Produce, Inc.", "friedas specialty", "name strip"],
    ["MELISSA'S PRODUCE LLC", "melissas", "uppercase + suffix strip"],
    ["H Mart Imports & Exports Co.", "h mart", "multi-suffix strip"],
    ["99 Ranch Market", "99 ranch market", "no suffix to strip"],
  ];
  for (const [input, expected, label] of canonChecks) {
    const got = canonicalizeCompanyName(input);
    if (got !== expected) {
      fail(`canonicalize "${input}" expected "${expected}" got "${got}" (${label})`);
    }
  }
  console.log("  canonicalization rules: OK");

  if (canonicalizeWebsite("https://www.Friedas.COM/about?ref=x") !== "friedas.com") {
    fail("canonicalizeWebsite did not strip protocol/www/path");
  }
  if (emailDomain("Buyer@Friedas.COM ") !== "friedas.com") {
    fail("emailDomain did not lowercase/trim");
  }
  console.log("  website + email canonicalization: OK");

  // 2. Dedupe key collisions for identical canonical identity.
  const a = computeDedupeKey({
    companyName: "Frieda's Specialty Produce, Inc.",
    website: "https://www.friedas.com/",
  });
  const b = computeDedupeKey({
    companyName: "FRIEDAS SPECIALTY PRODUCE LLC",
    website: "FRIEDAS.COM",
  });
  if (a.key !== b.key) {
    fail(`dedupe keys diverge for same canonical identity: ${a.key} vs ${b.key}`);
  }
  if (a.tier !== "name+website") fail(`expected tier name+website, got ${a.tier}`);
  console.log("  dedupe key collision (same identity → same hash): OK");

  // 3. Different companies → different hashes; tiers fall back correctly.
  const c = computeDedupeKey({ companyName: "Melissa's Produce" });
  const d = computeDedupeKey({ companyName: "Frieda's Specialty Produce" });
  if (c.key === d.key) fail("dedupe keys collide for clearly different companies");
  if (c.tier !== "name-only") fail(`expected name-only tier, got ${c.tier}`);

  const e = computeDedupeKey({
    companyName: "H Mart",
    email: "buyer@hmart.com",
  });
  if (e.tier !== "name+email-domain") {
    fail(`expected name+email-domain tier, got ${e.tier}`);
  }
  console.log("  tier fallback (website > email-domain > name-only): OK");

  // 4. Customs-manifest source extraction.
  const fixture: ShipmentRow[] = [
    {
      capturedAt: new Date("2026-04-29"),
      origin: "ecuador",
      rawBlob: {
        bill_of_lading: "BL-001",
        consignee: "Frieda's Specialty Produce",
        origin_country: "Ecuador",
        destination_port: "Los Angeles, CA",
        product_description: "DRAGON FRUIT RED SKIN WHITE FLESH",
        weight_kg: 18000,
        container_count: 1,
      },
    },
    {
      capturedAt: new Date("2026-04-22"),
      origin: "vietnam",
      rawBlob: {
        bill_of_lading: "BL-002",
        consignee: "Frieda's Specialty Produce",
        origin_country: "Vietnam",
        destination_port: "Long Beach, CA",
        product_description: "PITAHAYA YELLOW SKIN",
        weight_kg: 19500,
        container_count: 1,
      },
    },
    {
      capturedAt: new Date("2026-04-20"),
      origin: "vietnam",
      rawBlob: {
        bill_of_lading: "BL-003",
        consignee: "Melissa's Produce",
        origin_country: "Vietnam",
        destination_port: "Long Beach, CA",
        product_description: "DRAGON FRUIT",
        weight_kg: 22000,
        container_count: 1,
      },
    },
    {
      capturedAt: new Date("2026-04-21"),
      origin: "ecuador",
      rawBlob: {
        // No consignee — should be skipped.
        bill_of_lading: "BL-004",
        origin_country: "Ecuador",
        product_description: "DRAGON FRUIT",
      },
    },
  ];
  const candidates = extractCandidatesFromShipments(fixture);
  if (candidates.length !== 2) {
    fail(`expected 2 unique consignees, got ${candidates.length}`);
  }
  console.log("  source: 2 unique consignees from 4 shipments (1 dropped, no consignee): OK");

  const friedas = candidates.find((c) => /frieda/i.test(c.companyName));
  if (!friedas) fail("Frieda's not in candidates");
  if (friedas.score < 70) {
    fail(`Frieda's score expected >= 70 (Vietnam origin + 2 BoLs), got ${friedas.score}`);
  }
  if (!/2 distinct bill/i.test(friedas.volumeSignal ?? "")) {
    fail(`Frieda's volume signal expected to mention 2 BoLs, got "${friedas.volumeSignal}"`);
  }
  if (!Array.isArray((friedas.evidenceBlob as { shipments: unknown[] }).shipments)) {
    fail("Frieda's evidence_blob.shipments missing");
  }
  console.log(
    `  source scoring: Frieda's score=${friedas.score}, signal="${friedas.volumeSignal}" — OK`,
  );

  const melissas = candidates.find((c) => /melissa/i.test(c.companyName));
  if (!melissas) fail("Melissa's not in candidates");
  if (melissas.score !== 70) {
    // 50 base + 20 (Vietnam). Only 1 BoL so no +10.
    fail(`Melissa's score expected 70 (Vietnam, 1 BoL), got ${melissas.score}`);
  }
  console.log("  source scoring: Melissa's single-BoL score=70 — OK");

  // 5. Agent dry-run with fixture.
  process.env.DATABASE_URL ??= "postgres://smoke:test@localhost:5432/smoke";
  const result = await runBuyerScoutAgent({
    testMode: true,
    dryRun: true,
    customsManifestFixture: fixture,
  });
  if (result.rowsWritten < 1) {
    fail(`agent dry-run rowsWritten expected >= 1, got ${result.rowsWritten}`);
  }
  if (!result.sources.includes("importyeti-shipment")) {
    fail(`agent sources missing importyeti-shipment: ${result.sources.join(", ")}`);
  }
  console.log(
    `  agent dry-run: rowsWritten=${result.rowsWritten} sources=[${result.sources.join(", ")}] — OK`,
  );

  console.log("\nsmoke-buyer-scout: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
