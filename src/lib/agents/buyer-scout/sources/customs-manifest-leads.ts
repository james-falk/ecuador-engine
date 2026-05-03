// Buyer-scout source: customs manifest shipments.
//
// Mines `pricing_snapshots` rows produced by the market-intel customs-manifest
// source (source='importyeti', market='import-manifest'). Each shipment row
// carries the full ImportYeti record in `raw_blob`, including the consignee
// (the US-side buyer). We aggregate by consignee, count distinct bills of
// lading + observed origins, and produce one candidate lead per unique
// consignee.
//
// Pure-function design: the extractor takes an array of pricing-snapshot-
// shaped rows so the smoke test can pass an in-memory fixture without DB.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { pricingSnapshots } from "@/db/schema";

const SOURCE = "importyeti-shipment";

// Subset of pricing-snapshot columns we need to mine consignee data. Matches
// the raw_blob shape written by market-intel/customs-manifest.
export interface ShipmentRow {
  capturedAt: Date | string;
  origin: string | null;
  rawBlob: Record<string, unknown> | null;
}

export interface BuyerScoutCandidate {
  source: string;
  sourceUrl: string | null;
  companyName: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  volumeSignal: string | null;
  origin: string | null;
  evidenceBlob: Record<string, unknown>;
  // 0-100 deterministic heuristic. See score() for the breakdown.
  score: number;
}

const COMPETITOR_ORIGINS = new Set(["vietnam", "nicaragua"]);

// Score model (placeholder — tunable later):
//   - 50 base
//   - +20 if any observed origin is a competitor source (Vietnam/Nicaragua)
//     to indicate this consignee is currently buying from someone we'd
//     displace.
//   - +10 if 2+ distinct bills of lading observed in the window
//   - capped at 100
function scoreCandidate(opts: {
  distinctBolCount: number;
  origins: Set<string>;
}): number {
  let s = 50;
  for (const o of opts.origins) {
    if (COMPETITOR_ORIGINS.has(o)) {
      s += 20;
      break;
    }
  }
  if (opts.distinctBolCount >= 2) s += 10;
  return Math.min(100, s);
}

function shipmentDescriptor(blob: Record<string, unknown> | null): {
  consignee: string | null;
  bol: string | null;
  origin: string | null;
  destinationPort: string | null;
} {
  if (!blob) return { consignee: null, bol: null, origin: null, destinationPort: null };
  const consignee =
    typeof blob.consignee === "string" && blob.consignee.trim().length > 0
      ? blob.consignee.trim()
      : null;
  const bol =
    typeof blob.bill_of_lading === "string" && blob.bill_of_lading.trim().length > 0
      ? blob.bill_of_lading.trim()
      : null;
  const origin =
    typeof blob.origin_country === "string" && blob.origin_country.trim().length > 0
      ? blob.origin_country.trim().toLowerCase()
      : null;
  const destinationPort =
    typeof blob.destination_port === "string" && blob.destination_port.trim().length > 0
      ? blob.destination_port.trim()
      : null;
  return { consignee, bol, origin, destinationPort };
}

// Pure function — used by both the live agent run and the smoke test.
export function extractCandidatesFromShipments(
  rows: ShipmentRow[],
): BuyerScoutCandidate[] {
  // Group by consignee (case-insensitive trim), capturing distinct BoLs +
  // origins so we can compute a volume signal + score.
  const groups = new Map<
    string,
    {
      displayName: string;
      bols: Set<string>;
      origins: Set<string>;
      destinationPorts: Set<string>;
      shipments: Record<string, unknown>[];
    }
  >();

  for (const row of rows) {
    const desc = shipmentDescriptor(row.rawBlob);
    if (!desc.consignee) continue;
    const key = desc.consignee.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = {
        displayName: desc.consignee,
        bols: new Set(),
        origins: new Set(),
        destinationPorts: new Set(),
        shipments: [],
      };
      groups.set(key, g);
    }
    if (desc.bol) g.bols.add(desc.bol);
    if (desc.origin) g.origins.add(desc.origin);
    else if (row.origin) g.origins.add(row.origin.toLowerCase());
    if (desc.destinationPort) g.destinationPorts.add(desc.destinationPort);
    g.shipments.push(row.rawBlob ?? {});
  }

  const out: BuyerScoutCandidate[] = [];
  for (const g of groups.values()) {
    const distinctBolCount = g.bols.size;
    const volumeSignal =
      distinctBolCount > 0
        ? `observed ${distinctBolCount} distinct bill${
            distinctBolCount === 1 ? "" : "s"
          } of lading in last 30d`
        : `${g.shipments.length} shipment record${g.shipments.length === 1 ? "" : "s"} in last 30d`;
    const primaryOrigin = [...g.origins][0] ?? null;
    out.push({
      source: SOURCE,
      sourceUrl: null,
      companyName: g.displayName,
      website: null,
      contactEmail: null,
      contactPhone: null,
      volumeSignal,
      origin: primaryOrigin,
      evidenceBlob: {
        kind: "customs-manifest-aggregate",
        distinctBolCount,
        origins: [...g.origins],
        destinationPorts: [...g.destinationPorts],
        shipments: g.shipments,
      },
      score: scoreCandidate({
        distinctBolCount,
        origins: g.origins,
      }),
    });
  }
  return out;
}

// Live path: pulls last-30d importyeti rows out of pricing_snapshots and
// hands them to the pure extractor.
export async function fetchCustomsManifestLeadCandidates(
  testMode = false,
  fixture?: ShipmentRow[],
): Promise<BuyerScoutCandidate[]> {
  if (testMode) {
    const rows = fixture ?? [];
    console.log(
      `[buyer-scout/customs-manifest-leads] test mode: ${rows.length} fixture shipments`,
    );
    return extractCandidatesFromShipments(rows);
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await db
    .select({
      capturedAt: pricingSnapshots.capturedAt,
      origin: pricingSnapshots.origin,
      rawBlob: pricingSnapshots.rawBlob,
    })
    .from(pricingSnapshots)
    .where(
      and(
        eq(pricingSnapshots.source, "importyeti"),
        eq(pricingSnapshots.market, "import-manifest"),
        gte(pricingSnapshots.capturedAt, since),
      ),
    );

  const candidates = extractCandidatesFromShipments(
    rows.map((r) => ({
      capturedAt: r.capturedAt,
      origin: r.origin,
      rawBlob: r.rawBlob as Record<string, unknown> | null,
    })),
  );
  console.log(
    `[buyer-scout/customs-manifest-leads] ${candidates.length} candidate consignees from ${rows.length} shipments`,
  );
  return candidates;
}
