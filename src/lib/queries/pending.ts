// Pending tracker derives next-stage items from the harvest pipeline.
// These are NOT stored as `tasks` rows — they're computed on the fly so
// they always reflect current pipeline state. The /pending page lists
// them in their own section alongside manual tasks.

import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { farmHarvests, harvests, harvestSettlements, companies } from "@/db/schema";

export type PipelineStageItem = {
  id: string; // synthetic id `<stage>:<harvestId|farmHarvestId>`
  stage: "awaiting_processed" | "awaiting_payment" | "awaiting_balance";
  date: string; // YYYY-MM-DD — the date most relevant to acting on this item
  title: string;
  detail: string;
  relatedHarvestId: string | null;
  relatedFarmHarvestId: string | null;
};

function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

// 1. Farm harvests that have buckets but no linked delivery (harvest row).
// 2. Harvests with no settlement at all.
// 3. Harvests whose settlements sum to less than expectedTotalUsd.
export async function getPipelinePending(): Promise<PipelineStageItem[]> {
  const items: PipelineStageItem[] = [];

  // 1. Farm harvests with buckets but no delivery linked.
  const orphanFarmHarvests = await db
    .select({
      id: farmHarvests.id,
      harvestDate: farmHarvests.harvestDate,
      bucketCount: farmHarvests.bucketCount,
      flowerCount: farmHarvests.flowerCount,
    })
    .from(farmHarvests)
    .leftJoin(harvests, eq(harvests.farmHarvestId, farmHarvests.id))
    .where(sql`${harvests.id} IS NULL AND ${farmHarvests.bucketCount} > 0`);

  for (const r of orphanFarmHarvests) {
    items.push({
      id: `awaiting_processed:farm:${r.id}`,
      stage: "awaiting_processed",
      date: dateStr(r.harvestDate),
      title: `Awaiting processed report — ${r.bucketCount} buckets`,
      detail: `Farm harvest ${dateStr(r.harvestDate)} not yet linked to a processor delivery.`,
      relatedHarvestId: null,
      relatedFarmHarvestId: r.id,
    });
  }

  // 2. Harvests with no settlement row at all.
  const orphanHarvests = await db
    .select({
      id: harvests.id,
      harvestDate: harvests.harvestDate,
      processorName: companies.name,
      kgDelivered: harvests.kgDelivered,
    })
    .from(harvests)
    .leftJoin(companies, eq(companies.id, harvests.processorCompanyId))
    .leftJoin(harvestSettlements, eq(harvestSettlements.harvestId, harvests.id))
    .where(isNull(harvestSettlements.id));

  for (const r of orphanHarvests) {
    items.push({
      id: `awaiting_processed:harvest:${r.id}`,
      stage: "awaiting_processed",
      date: dateStr(r.harvestDate),
      title: `Awaiting processed report — ${r.processorName ?? "Unattributed processor"}`,
      detail: `Delivery on ${dateStr(r.harvestDate)} (${r.kgDelivered} kg).`,
      relatedHarvestId: r.id,
      relatedFarmHarvestId: null,
    });
  }

  // 3. Harvests where sum(net_pay) < expected_total_usd. Latest expected
  // among the harvest's settlements wins (operator updates set the most
  // recent expected). If expected is null AND nothing has been paid yet,
  // surface as "awaiting payment" without a target amount.
  const paymentRollups = await db.execute<{
    harvest_id: string;
    harvest_date: string;
    processor_name: string | null;
    received: string;
    expected: string | null;
  }>(sql`
    SELECT
      h.id AS harvest_id,
      h.harvest_date::text AS harvest_date,
      c.name AS processor_name,
      COALESCE(SUM(s.net_pay_usd::numeric), 0)::text AS received,
      MAX(s.expected_total_usd::numeric)::text AS expected
    FROM harvests h
    INNER JOIN harvest_settlements s ON s.harvest_id = h.id
    LEFT JOIN companies c ON c.id = h.processor_company_id
    GROUP BY h.id, h.harvest_date, c.name
  `);

  for (const r of paymentRollups.rows) {
    const received = Number(r.received ?? "0");
    const expected = r.expected ? Number(r.expected) : null;

    if (expected !== null) {
      const remaining = expected - received;
      if (remaining > 0.01) {
        items.push({
          id: `awaiting_balance:${r.harvest_id}`,
          stage: received > 0 ? "awaiting_balance" : "awaiting_payment",
          date: r.harvest_date,
          title:
            received > 0
              ? `Awaiting balance — $${remaining.toFixed(2)} of $${expected.toFixed(2)}`
              : `Awaiting payment — $${expected.toFixed(2)} expected`,
          detail: `${r.processor_name ?? "Unattributed"} delivery on ${r.harvest_date}.`,
          relatedHarvestId: r.harvest_id,
          relatedFarmHarvestId: null,
        });
      }
    } else if (received === 0) {
      // No expected total set, no payment yet — still awaiting.
      items.push({
        id: `awaiting_payment:${r.harvest_id}`,
        stage: "awaiting_payment",
        date: r.harvest_date,
        title: "Awaiting payment",
        detail: `${r.processor_name ?? "Unattributed"} delivery on ${r.harvest_date} — no payment recorded yet.`,
        relatedHarvestId: r.harvest_id,
        relatedFarmHarvestId: null,
      });
    }
  }

  // Newest first.
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}
