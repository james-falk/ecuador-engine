// Harvests pillar — read paths. Types defined here (NOT in lib/data.ts).
//
// A harvest can have MULTIPLE settlement rows (advance / balance / lump_sum).
// `settlements` is the full list ordered by date; `settlement` is the most
// recent for the existing single-row UI to keep working.

import { desc, eq, and, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { harvests, harvestSettlements, companies } from "@/db/schema";

export type SettlementKind = "advance" | "balance" | "lump_sum";

export type SettlementRow = {
  id: string;
  kind: SettlementKind;
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
  expectedTotalUsd: string | null;
  paidToAccountId: string;
  paidDate: string | null;
  pdfUrl: string | null;
  wasteObservations: string | null;
};

export type HarvestRow = {
  id: string;
  harvestDate: string;
  weekStartDate: string;
  processorCompanyId: string | null;
  processorName: string | null;
  processorSlug: string | null;
  lotNumber: string | null;
  kgDelivered: string;
  notes: string | null;
  evidenceUrl: string | null;
  settlements: SettlementRow[];
  // Most recent settlement (by paidDate desc, settlementDate desc). Kept for
  // the existing single-row callers; new code should consume `settlements`.
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

type SettlementRawRow = {
  id: string;
  harvestId: string;
  kind: SettlementKind;
  settlementDate: string | Date;
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
  expectedTotalUsd: string | null;
  paidToAccountId: string;
  paidDate: string | Date | null;
  pdfUrl: string | null;
  wasteObservations: string | null;
};

function shapeSettlement(s: SettlementRawRow): SettlementRow {
  return {
    id: s.id,
    kind: s.kind,
    settlementDate: dateStr(s.settlementDate),
    kgManifested: s.kgManifested,
    kgProcessed: s.kgProcessed,
    kgWaste: s.kgWaste,
    wastePct: s.wastePct,
    grade1_5Kg: s.grade1_5Kg,
    grade2Kg: s.grade2Kg,
    gradeSmallKg: s.gradeSmallKg,
    grade1_5RateUsd: s.grade1_5RateUsd,
    grade2RateUsd: s.grade2RateUsd,
    gradeSmallRateUsd: s.gradeSmallRateUsd,
    subtotalUsd: s.subtotalUsd,
    retentionUsd: s.retentionUsd,
    netPayUsd: s.netPayUsd,
    expectedTotalUsd: s.expectedTotalUsd,
    paidToAccountId: s.paidToAccountId,
    paidDate: dateStrOrNull(s.paidDate),
    pdfUrl: s.pdfUrl,
    wasteObservations: s.wasteObservations,
  };
}

async function fetchSettlementsForHarvests(harvestIds: string[]): Promise<Map<string, SettlementRow[]>> {
  if (harvestIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: harvestSettlements.id,
      harvestId: harvestSettlements.harvestId,
      kind: harvestSettlements.kind,
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
      expectedTotalUsd: harvestSettlements.expectedTotalUsd,
      paidToAccountId: harvestSettlements.paidToAccountId,
      paidDate: harvestSettlements.paidDate,
      pdfUrl: harvestSettlements.pdfUrl,
      wasteObservations: harvestSettlements.wasteObservations,
    })
    .from(harvestSettlements)
    .where(inArray(harvestSettlements.harvestId, harvestIds))
    .orderBy(desc(harvestSettlements.paidDate), desc(harvestSettlements.settlementDate));

  const map = new Map<string, SettlementRow[]>();
  for (const r of rows) {
    const list = map.get(r.harvestId) ?? [];
    list.push(shapeSettlement(r as SettlementRawRow));
    map.set(r.harvestId, list);
  }
  return map;
}

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
    })
    .from(harvests)
    .leftJoin(companies, eq(companies.id, harvests.processorCompanyId));
}

function buildHarvestRow(
  r: {
    id: string;
    harvestDate: string | Date;
    weekStartDate: string | Date;
    processorCompanyId: string | null;
    processorName: string | null;
    processorSlug: string | null;
    lotNumber: string | null;
    kgDelivered: string;
    notes: string | null;
    evidenceUrl: string | null;
  },
  settlements: SettlementRow[]
): HarvestRow {
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
    settlements,
    settlement: settlements[0] ?? null,
  };
}

export async function getHarvestFeed(filters: { from?: string; to?: string } = {}): Promise<HarvestRow[]> {
  const where = [
    filters.from ? gte(harvests.harvestDate, filters.from) : undefined,
    filters.to ? lte(harvests.harvestDate, filters.to) : undefined,
  ].filter(Boolean);

  const rows = await harvestSelect()
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(harvests.harvestDate));

  const settlementMap = await fetchSettlementsForHarvests(rows.map((r) => r.id));
  return rows.map((r) => buildHarvestRow(r, settlementMap.get(r.id) ?? []));
}

export async function getHarvestById(id: string): Promise<HarvestRow | null> {
  const [row] = await harvestSelect().where(eq(harvests.id, id)).limit(1);
  if (!row) return null;
  const settlementMap = await fetchSettlementsForHarvests([id]);
  return buildHarvestRow(row, settlementMap.get(id) ?? []);
}

export async function getHarvestStats(opts: { from?: string; to?: string } = {}): Promise<HarvestStats> {
  const where = [
    opts.from ? gte(harvests.harvestDate, opts.from) : undefined,
    opts.to ? lte(harvests.harvestDate, opts.to) : undefined,
  ].filter(Boolean);

  const [agg] = await db
    .select({
      count: sql<number>`count(distinct ${harvests.id})::int`,
      pendingCount: sql<number>`(count(distinct ${harvests.id}) filter (where ${harvestSettlements.id} is null))::int`,
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
