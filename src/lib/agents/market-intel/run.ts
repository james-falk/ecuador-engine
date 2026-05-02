// Market-intel agent entrypoint.
// Orchestrates all sources, deduplicates by (source, market, capturedAt, variety,
// cartonSize) to avoid re-inserting the same report on retry, writes to
// pricing_snapshots.
//
// Called by the API route or directly by the nightly cron via
// USDA_TEST_MODE=true for smoke testing.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { pricingSnapshots } from "@/db/schema";
import { fetchUsdaAmsRows, type UsdaAmsRow } from "./sources/usda-ams";
import { fetchCustomsManifestRows } from "./sources/customs-manifest";

export interface MarketIntelResult {
  rowsWritten: number;
  rowsSkipped: number;
  sources: string[];
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export async function runMarketIntelAgent(opts: {
  testMode?: boolean;
  dryRun?: boolean;
}): Promise<MarketIntelResult> {
  const { testMode = false, dryRun = false } = opts;

  const allRows: UsdaAmsRow[] = [];
  // Sources run in parallel; each handles its own upstream-down case and
  // returns [] gracefully so one bad source doesn't abort the run.
  const sourceResults = await Promise.allSettled([
    fetchUsdaAmsRows(testMode),
    fetchCustomsManifestRows(testMode),
  ]);
  for (const r of sourceResults) {
    if (r.status === "fulfilled") allRows.push(...r.value);
    else console.log(`[market-intel] source rejected: ${String(r.reason)}`);
  }

  if (allRows.length === 0) {
    console.log("[market-intel] no rows from any source — upstream(s) unavailable");
    return { rowsWritten: 0, rowsSkipped: 0, sources: [] };
  }

  if (dryRun) {
    console.log(`[market-intel] dry-run: would write ${allRows.length} rows`);
    return {
      rowsWritten: allRows.length,
      rowsSkipped: 0,
      sources: [...new Set(allRows.map((r) => r.source))],
    };
  }

  // Dedup: load existing rows for dates covered by this batch to skip re-inserts
  const minDate = allRows.reduce(
    (min, r) => (r.reportDate < min ? r.reportDate : min),
    allRows[0].reportDate
  );
  const existing = await db
    .select({
      source: pricingSnapshots.source,
      market: pricingSnapshots.market,
      capturedAt: pricingSnapshots.capturedAt,
      variety: pricingSnapshots.variety,
      cartonSize: pricingSnapshots.cartonSize,
    })
    .from(pricingSnapshots)
    .where(gte(pricingSnapshots.capturedAt, startOfDay(minDate)));

  // Build a seen-set keyed on source+market+date+variety+carton
  const seenKey = (
    source: string,
    market: string,
    date: Date,
    variety: string | null,
    cartonSize: string | null
  ) => `${source}|${market}|${date.toISOString().slice(0, 10)}|${variety ?? ""}|${cartonSize ?? ""}`;

  const seen = new Set(
    existing.map((e) =>
      seenKey(e.source, e.market, new Date(e.capturedAt), e.variety, e.cartonSize)
    )
  );

  let rowsWritten = 0;
  let rowsSkipped = 0;
  const writtenSources = new Set<string>();

  for (const row of allRows) {
    const key = seenKey(row.source, row.market, row.reportDate, row.variety, row.cartonSize);
    if (seen.has(key)) {
      rowsSkipped++;
      continue;
    }
    seen.add(key);

    await db.insert(pricingSnapshots).values({
      capturedAt: row.reportDate,
      source: row.source,
      market: row.market,
      variety: row.variety ?? undefined,
      cartonSize: row.cartonSize ?? undefined,
      origin: row.origin ?? undefined,
      priceLowUsd: row.priceLow !== null ? String(row.priceLow) : undefined,
      priceHighUsd: row.priceHigh !== null ? String(row.priceHigh) : undefined,
      rawBlob: row.rawBlob,
    });

    rowsWritten++;
    writtenSources.add(row.source);
  }

  console.log(
    `[market-intel] done — wrote ${rowsWritten}, skipped ${rowsSkipped} (already in DB)`
  );
  return { rowsWritten, rowsSkipped, sources: [...writtenSources] };
}
