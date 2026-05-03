// Buyer-scout agent entrypoint.
//
// Orchestrates all lead-discovery sources, dedupes against BOTH existing
// `lead_proposals.dedupe_key` AND `companies` (kind='buyer') computed at
// query-time, then writes new rows to lead_proposals with status='proposed'.
//
// Companies-side dedupe note: BUILD_LOG dedupe contract requires checking
// the buyers tier as well. There is no `buyers` table — buyers live in
// `companies` with kind='buyer', and `companies` is on the don't-touch
// list. We therefore compute their dedupe_key on the fly and merge into
// the seen-set rather than adding a column.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, leadProposals } from "@/db/schema";
import {
  fetchCustomsManifestLeadCandidates,
  type BuyerScoutCandidate,
  type ShipmentRow,
} from "./sources/customs-manifest-leads";
import { computeDedupeKey } from "./dedupe";

export interface BuyerScoutResult {
  rowsWritten: number;
  rowsSkipped: number;
  sources: string[];
}

export interface BuyerScoutOptions {
  testMode?: boolean;
  dryRun?: boolean;
  // Optional fixtures wired straight to the customs-manifest source — used
  // by the smoke test to avoid a DB round-trip.
  customsManifestFixture?: ShipmentRow[];
}

export async function runBuyerScoutAgent(
  opts: BuyerScoutOptions = {},
): Promise<BuyerScoutResult> {
  const { testMode = false, dryRun = false, customsManifestFixture } = opts;

  const allCandidates: BuyerScoutCandidate[] = [];
  const sourceResults = await Promise.allSettled([
    fetchCustomsManifestLeadCandidates(testMode, customsManifestFixture),
  ]);
  for (const r of sourceResults) {
    if (r.status === "fulfilled") allCandidates.push(...r.value);
    else console.log(`[buyer-scout] source rejected: ${String(r.reason)}`);
  }

  if (allCandidates.length === 0) {
    console.log("[buyer-scout] no candidates from any source");
    return { rowsWritten: 0, rowsSkipped: 0, sources: [] };
  }

  if (dryRun) {
    console.log(`[buyer-scout] dry-run: ${allCandidates.length} candidates`);
    return {
      rowsWritten: allCandidates.length,
      rowsSkipped: 0,
      sources: [...new Set(allCandidates.map((c) => c.source))],
    };
  }

  // Build seen-set: existing lead_proposal keys + companies-side computed keys.
  const existingLeadKeys = await db
    .select({ key: leadProposals.dedupeKey })
    .from(leadProposals);
  const seen = new Set<string>(existingLeadKeys.map((r) => r.key));

  const buyerCompanies = await db
    .select({
      name: companies.name,
      website: companies.website,
      email: companies.primaryEmail,
    })
    .from(companies)
    .where(eq(companies.kind, "buyer"));
  for (const c of buyerCompanies) {
    const k = computeDedupeKey({
      companyName: c.name,
      website: c.website,
      email: c.email,
    });
    seen.add(k.key);
  }

  let rowsWritten = 0;
  let rowsSkipped = 0;
  const writtenSources = new Set<string>();

  for (const cand of allCandidates) {
    const k = computeDedupeKey({
      companyName: cand.companyName,
      website: cand.website,
      email: cand.contactEmail,
    });
    if (seen.has(k.key)) {
      rowsSkipped++;
      continue;
    }
    seen.add(k.key);

    await db.insert(leadProposals).values({
      capturedAt: new Date(),
      source: cand.source,
      sourceUrl: cand.sourceUrl ?? undefined,
      companyName: cand.companyName,
      websiteCanonical: cand.website ?? undefined,
      contactEmailCanonical: cand.contactEmail ?? undefined,
      contactPhoneCanonical: cand.contactPhone ?? undefined,
      volumeSignal: cand.volumeSignal ?? undefined,
      evidenceBlob: cand.evidenceBlob,
      score: cand.score,
      dedupeKey: k.key,
    });

    rowsWritten++;
    writtenSources.add(cand.source);
  }

  console.log(
    `[buyer-scout] done — wrote ${rowsWritten}, skipped ${rowsSkipped} (dedupe hit)`,
  );
  return { rowsWritten, rowsSkipped, sources: [...writtenSources] };
}
