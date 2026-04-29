// Harvests pillar — read paths. Types defined here (NOT in lib/data.ts).

import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { harvests, harvestSettlements, companies } from "@/db/schema";

export type SettlementRow = {
  id: string;
  settlementDate: string;
  kgManifested: string;
  kgProcessed: string;
  kgWaste: string;
  wastePct: string | null;
  grade1_5Kg: string | null;
  grade2Kg: string | null;
  gradeSmallKg: string | null;
  grade1_5RateUsd: string | null;
  grade2RateUsd: string | null;
  gradeSmallRateUsd: string | null;
  subtotalUsd: string;
  retentionUsd: string;
  netPayUsd: string;
  paidToAccountId: string;
  paidDate: string | null;
  pdfUrl: string | null;
  wasteObservations: string | null;
};

export type HarvestRow = {
  id: string;
  harvestDate: string;
  weekStartDate: string;
  processorCompanyId: string;
  processorName: string;
  processorSlug: string | null;
  lotNumber: string | null;
  kgDelivered: string;
  notes: string | null;
  evidenceUrl: string | null;
  settlement: SettlementRow | null;
};

export type HarvestStats = {
  count: number;
  pendingCount: number;
  kgDelivered: string;
  kgProcessed: string;
  kgWaste: string;
  wastePct: string;
  netPayUsd: string;
};

function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

function dateStrOrNull(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return dateStr(v);
}

// Single row builder shared by feed + by-id.
function rowToHarvest(r: {
  // harvest fields
  id: string;
  harvestDate: string | Date;
  weekStartDate: string | Date;
  processorCompanyId: string;
  processorName: string;
  processorSlug: string | null;
  lotNumber: string | null;
  kgDelivered: string;
  notes: string | null;
  evidenceUrl: string | null;
  // settlement fields (nullable — LEFT JOIN)
  settlementId: string | null;
  settlementDate: string | Date | null;
  kgManifested: string | null;
  kgProcessed: string | null;
  kgWaste: string | null;
  wastePct: string | null;
  grade1_5Kg: string | null;
  grade2Kg: string | null;
  gradeSmallKg: string | null;
  grade1_5RateUsd: string | null;
  grade2RateUsd: string | null;
  gradeSmallRateUsd: string | null;
  subtotalUsd: string | null;
  retentionUsd: string | null;
  netPayUsd: string | null;
  paidToAccountId: string | null;
  paidDate: string | Date | null;
  pdfUrl: string | null;
  wasteObservations: string | null;
}): HarvestRow {
  const settlement: SettlementRow | null = r.settlementId
    ? {
        id: r.settlementId,
        settlementDate: dateStr(r.settlementDate),
        kgManifested: r.kgManifested!,
        kgProcessed: r.kgProcessed!,
        kgWaste: r.kgWaste!,
        wastePct: r.wastePct,
        grade1_5Kg: r.grade1_5Kg,
        grade2Kg: r.grade2Kg,
        gradeSmallKg: r.gradeSmallKg,
        grade1_5RateUsd: r.grade1_5RateUsd,
        grade2RateUsd: r.grade2RateUsd,
        gradeSmallRateUsd: r.gradeSmallRateUsd,
        subtotalUsd: r.subtotalUsd!,
        retentionUsd: r.retentionUsd!,
        netPayUsd: r.netPayUsd!,
        paidToAccountId: r.paidToAccountId!,
        paidDate: dateStrOrNull(r.paidDate),
        pdfUrl: r.pdfUrl,
        wasteObservations: r.wasteObservations,
      }
    : null;

  return {
    id: r.id,
    harvestDate: dateStr(r.harvestDate),
    weekStartDate: dateStr(r.weekStartDate),
    processorCompanyId: r.processorCompanyId,
    processorName: r.processorName,
    processorSlug: r.processorSlug,
    lotNumber: r.lotNumber,
    kgDelivered: r.kgDelivered,
    notes: r.notes,
    evidenceUrl: r.evidenceUrl,
    settlement,
  };
}

// Common SELECT shape: harvest fields + processor + LEFT JOIN settlement.
function harvestSelect() {
  return db
    .select({
      id: harvests.id,
      harvestDate: harvests.harvestDate,
      weekStartDate: harvests.weekStartDate,
      processorCompanyId: harvests.processorCompanyId,
      processorName: companies.name,
      processorSlug: companies.slug,
      lotNumber: harvests.lotNumber,
      kgDelivered: harvests.kgDelivered,
      notes: harvests.notes,
      evidenceUrl: harvests.evidenceUrl,
      settlementId: harvestSettlements.id,
      settlementDate: harvestSettlements.settlementDate,
      kgManifested: harvestSettlements.kgManifested,
      kgProcessed: harvestSettlements.kgProcessed,
      kgWaste: harvestSettlements.kgWaste,
      wastePct: harvestSettlements.wastePct,
      grade1_5Kg: harvestSettlements.grade1_5Kg,
      grade2Kg: harvestSettlements.grade2Kg,
      gradeSmallKg: harvestSettlements.gradeSmallKg,
      grade1_5RateUsd: harvestSettlements.grade1_5RateUsd,
      grade2RateUsd: harvestSettlements.grade2RateUsd,
      gradeSmallRateUsd: harvestSettlements.gradeSmallRateUsd,
      subtotalUsd: harvestSettlements.subtotalUsd,
      retentionUsd: harvestSettlements.retentionUsd,
      netPayUsd: harvestSettlements.netPayUsd,
      paidToAccountId: harvestSettlements.paidToAccountId,
      paidDate: harvestSettlements.paidDate,
      pdfUrl: harvestSettlements.pdfUrl,
      wasteObservations: harvestSettlements.wasteObservations,
    })
    .from(harvests)
    .innerJoin(companies, eq(companies.id, harvests.processorCompanyId))
    .leftJoin(harvestSettlements, eq(harvestSettlements.harvestId, harvests.id));
}

export async function getHarvestFeed(filters: { from?: string; to?: string } = {}): Promise<HarvestRow[]> {
  const where = [
    filters.from ? gte(harvests.harvestDate, filters.from) : undefined,
    filters.to ? lte(harvests.harvestDate, filters.to) : undefined,
  ].filter(Boolean);

  const rows = await harvestSelect()
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(harvests.harvestDate));

  return rows.map(rowToHarvest);
}

export async function getHarvestById(id: string): Promise<HarvestRow | null> {
  const [row] = await harvestSelect().where(eq(harvests.id, id)).limit(1);
  return row ? rowToHarvest(row) : null;
}

export async function getHarvestStats(opts: { from?: string; to?: string } = {}): Promise<HarvestStats> {
  const where = [
    opts.from ? gte(harvests.harvestDate, opts.from) : undefined,
    opts.to ? lte(harvests.harvestDate, opts.to) : undefined,
  ].filter(Boolean);

  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      pendingCount: sql<number>`sum(case when ${harvestSettlements.id} is null then 1 else 0 end)::int`,
      kgDelivered: sql<string>`coalesce(sum(${harvests.kgDelivered}), 0)::numeric(12,2)`,
      kgProcessed: sql<string>`coalesce(sum(${harvestSettlements.kgProcessed}), 0)::numeric(12,2)`,
      kgWaste: sql<string>`coalesce(sum(${harvestSettlements.kgWaste}), 0)::numeric(12,2)`,
      netPayUsd: sql<string>`coalesce(sum(${harvestSettlements.netPayUsd}), 0)::numeric(12,2)`,
    })
    .from(harvests)
    .leftJoin(harvestSettlements, eq(harvestSettlements.harvestId, harvests.id))
    .where(where.length ? and(...where) : undefined);

  const kgManifested = Number(agg.kgProcessed) + Number(agg.kgWaste);
  const wastePct = kgManifested > 0 ? ((Number(agg.kgWaste) / kgManifested) * 100).toFixed(2) : "0.00";

  return {
    count: agg.count ?? 0,
    pendingCount: agg.pendingCount ?? 0,
    kgDelivered: agg.kgDelivered ?? "0.00",
    kgProcessed: agg.kgProcessed ?? "0.00",
    kgWaste: agg.kgWaste ?? "0.00",
    wastePct,
    netPayUsd: agg.netPayUsd ?? "0.00",
  };
}
