// Farm harvests pillar — read paths for the picking events.

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { farmHarvests, harvests, companies } from "@/db/schema";

export type FarmHarvestRow = {
  id: string;
  harvestDate: string;
  flowerCount: number | null;
  bucketCount: number | null;
  notes: string | null;
  recordedBy: string | null;
  // Linked delivery info (LEFT JOIN). If a delivery exists pointing to
  // this farm_harvest, surfaced here so the page can show "delivered to X
  // on Y" inline.
  delivery: {
    id: string;
    processorName: string | null;
    deliveryDate: string;
  } | null;
};

function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

const baseSelect = () =>
  db
    .select({
      id: farmHarvests.id,
      harvestDate: farmHarvests.harvestDate,
      flowerCount: farmHarvests.flowerCount,
      bucketCount: farmHarvests.bucketCount,
      notes: farmHarvests.notes,
      recordedBy: farmHarvests.recordedBy,
      deliveryId: harvests.id,
      processorName: companies.name,
      deliveryDate: harvests.harvestDate,
    })
    .from(farmHarvests)
    .leftJoin(harvests, eq(harvests.farmHarvestId, farmHarvests.id))
    .leftJoin(companies, eq(companies.id, harvests.processorCompanyId));

function rowToFarmHarvest(
  r: Awaited<ReturnType<ReturnType<typeof baseSelect>["execute"]>>[number]
): FarmHarvestRow {
  return {
    id: r.id,
    harvestDate: dateStr(r.harvestDate),
    flowerCount: r.flowerCount,
    bucketCount: r.bucketCount,
    notes: r.notes,
    recordedBy: r.recordedBy,
    delivery: r.deliveryId
      ? {
          id: r.deliveryId,
          processorName: r.processorName,
          deliveryDate: dateStr(r.deliveryDate),
        }
      : null,
  };
}

export async function getFarmHarvests(
  opts: { from?: string; to?: string } = {}
): Promise<FarmHarvestRow[]> {
  const where = [
    opts.from ? gte(farmHarvests.harvestDate, opts.from) : undefined,
    opts.to ? lte(farmHarvests.harvestDate, opts.to) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  const rows = await baseSelect()
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(farmHarvests.harvestDate));
  return rows.map(rowToFarmHarvest);
}

export async function getFarmHarvestById(id: string): Promise<FarmHarvestRow | null> {
  const [row] = await baseSelect().where(eq(farmHarvests.id, id)).limit(1);
  return row ? rowToFarmHarvest(row) : null;
}

// Stats for the page header.
export type FarmHarvestStats = {
  count: number;
  totalFlowers: number;
  totalBuckets: number;
};

export async function getFarmHarvestStats(
  opts: { from?: string; to?: string } = {}
): Promise<FarmHarvestStats> {
  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      flowers: sql<number>`coalesce(sum(${farmHarvests.flowerCount}), 0)::int`,
      buckets: sql<number>`coalesce(sum(${farmHarvests.bucketCount}), 0)::int`,
    })
    .from(farmHarvests)
    .where(
      and(
        opts.from ? gte(farmHarvests.harvestDate, opts.from) : undefined,
        opts.to ? lte(farmHarvests.harvestDate, opts.to) : undefined
      )
    );
  return {
    count: agg?.count ?? 0,
    totalFlowers: agg?.flowers ?? 0,
    totalBuckets: agg?.buckets ?? 0,
  };
}

// Processor companies for the picker. Anything not "producer" or "importer"
// (i.e. anyone who's not Finca or PureSol — mostly packing facilities,
// buyers, other downstream parties) qualifies.
export async function getProcessorOptions(): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(sql`${companies.kind} NOT IN ('producer', 'importer')`)
    .orderBy(asc(companies.name));
  return rows;
}
