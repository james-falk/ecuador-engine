// Companies pillar — cross-pillar aggregations for the entity hub.
//
// /companies/[slug] uses these to surface "everything we know about this
// entity" — harvests routed through, expenses paid, cash movements with
// them, documents (later via Drive). Each helper is filtered to the
// entity's company UUID.

import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  complianceItems,
  expenseEntries,
  harvests,
  harvestSettlements,
  cashMovements,
} from "@/db/schema";

function dateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

export type CompanyActivityItem = {
  kind: "expense" | "harvest" | "cashMovement";
  id: string;
  date: string;
  primary: string;
  secondary: string | null;
  amountUsd: string | null;
  source: string | null;
};

export type CompanyOverview = {
  expenseCount: number;
  expenseTotalUsd: string;
  harvestCount: number;
  settlementsTotalUsd: string;
  settlementsCount: number;
  capitalInTotalUsd: string;
  capitalInCount: number;
  capitalOutTotalUsd: string;
  capitalOutCount: number;
};

// Pull cross-pillar activity for a single company. Year-bounded if from/to
// supplied. Combines:
//   • expense_entries WHERE payee_company_id = company.id
//   • harvests WHERE processor_company_id = company.id
//   • cash_movements WHERE counterparty ILIKE company.name (loose text match
//     until we have a proper FK on cash_movements; counterparty is currently
//     free text)
export async function getCompanyActivity(
  companyId: string,
  opts: { from?: string; to?: string } = {}
): Promise<CompanyActivityItem[]> {
  // Resolve the company name for the cash-movement loose match.
  const [co] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!co) return [];

  const expenseRows = await db
    .select({
      id: expenseEntries.id,
      date: expenseEntries.entryDate,
      categoryLabel: expenseEntries.categoryLabel,
      categoryType: expenseEntries.categoryType,
      amount: expenseEntries.amountUsd,
      payee: expenseEntries.payee,
      notes: expenseEntries.notes,
      source: expenseEntries.source,
    })
    .from(expenseEntries)
    .where(
      and(
        eq(expenseEntries.payeeCompanyId, companyId),
        opts.from ? gte(expenseEntries.entryDate, opts.from) : undefined,
        opts.to ? lte(expenseEntries.entryDate, opts.to) : undefined
      )
    );

  const harvestRows = await db
    .select({
      id: harvests.id,
      date: harvests.harvestDate,
      lot: harvests.lotNumber,
      kgDelivered: harvests.kgDelivered,
      settlementAmount: harvestSettlements.netPayUsd,
      settlementDate: harvestSettlements.paidDate,
    })
    .from(harvests)
    .leftJoin(harvestSettlements, eq(harvestSettlements.harvestId, harvests.id))
    .where(
      and(
        eq(harvests.processorCompanyId, companyId),
        opts.from ? gte(harvests.harvestDate, opts.from) : undefined,
        opts.to ? lte(harvests.harvestDate, opts.to) : undefined
      )
    );

  const cmRows = await db
    .select({
      id: cashMovements.id,
      date: cashMovements.transferDate,
      direction: cashMovements.direction,
      amount: cashMovements.amountUsd,
      counterparty: cashMovements.counterparty,
      source: cashMovements.source,
    })
    .from(cashMovements)
    .where(
      and(
        sql`${cashMovements.counterparty} ILIKE ${"%" + co.name + "%"}`,
        opts.from ? gte(cashMovements.transferDate, opts.from) : undefined,
        opts.to ? lte(cashMovements.transferDate, opts.to) : undefined
      )
    );

  const items: CompanyActivityItem[] = [];

  for (const r of expenseRows) {
    items.push({
      kind: "expense",
      id: r.id,
      date: dateStr(r.date),
      primary: `${r.categoryLabel ?? r.categoryType} — paid${r.payee ? ` (${r.payee})` : ""}`,
      secondary: r.notes,
      amountUsd: r.amount,
      source: r.source,
    });
  }
  for (const r of harvestRows) {
    items.push({
      kind: "harvest",
      id: r.id,
      date: dateStr(r.date),
      primary: r.settlementAmount
        ? `Harvest payment received${r.kgDelivered && Number(r.kgDelivered) > 0 ? ` · ${r.kgDelivered} kg delivered` : ""}`
        : "Harvest delivery (settlement pending)",
      secondary: r.lot ? r.lot : null,
      amountUsd: r.settlementAmount ?? null,
      source: r.lot,
    });
  }
  for (const r of cmRows) {
    items.push({
      kind: "cashMovement",
      id: r.id,
      date: dateStr(r.date),
      primary: r.direction === "in_to_ec" ? "US → EC wire" : "EC → US wire",
      secondary: r.counterparty,
      amountUsd: r.amount,
      source: r.source,
    });
  }

  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}

export type CompanyDocument = {
  source: "harvest_settlement" | "harvest_evidence" | "compliance";
  id: string;
  date: string;
  label: string;
  url: string;
};

// Drive files referenced from rows scoped to this company:
//   • harvest_settlements.pdf_url where the harvest's processor = this co
//   • harvests.evidence_url      where processor_company_id = this co
//   • compliance_items.evidence_url where owner_company_id = this co
//
// All three columns are URLs (Drive view links typically). When Drive is
// connected we can layer real-time metadata (last-modified, owner) via the
// picker — for now we render whatever was stored at link time.
export async function getCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  const settlementRows = await db
    .select({
      id: harvestSettlements.id,
      url: harvestSettlements.pdfUrl,
      date: harvestSettlements.settlementDate,
    })
    .from(harvestSettlements)
    .leftJoin(harvests, eq(harvests.id, harvestSettlements.harvestId))
    .where(and(eq(harvests.processorCompanyId, companyId), isNotNull(harvestSettlements.pdfUrl)));

  const evidenceRows = await db
    .select({
      id: harvests.id,
      url: harvests.evidenceUrl,
      date: harvests.harvestDate,
    })
    .from(harvests)
    .where(and(eq(harvests.processorCompanyId, companyId), isNotNull(harvests.evidenceUrl)));

  const complianceRows = await db
    .select({
      id: complianceItems.id,
      url: complianceItems.evidenceUrl,
      date: complianceItems.updatedAt,
      label: complianceItems.item,
    })
    .from(complianceItems)
    .where(and(eq(complianceItems.ownerCompanyId, companyId), isNotNull(complianceItems.evidenceUrl)));

  const out: CompanyDocument[] = [];
  for (const r of settlementRows) {
    if (!r.url) continue;
    out.push({
      source: "harvest_settlement",
      id: r.id,
      date: dateStr(r.date),
      label: `Liquidación PDF · ${dateStr(r.date)}`,
      url: r.url,
    });
  }
  for (const r of evidenceRows) {
    if (!r.url) continue;
    out.push({
      source: "harvest_evidence",
      id: r.id,
      date: dateStr(r.date),
      label: `Delivery evidence · ${dateStr(r.date)}`,
      url: r.url,
    });
  }
  for (const r of complianceRows) {
    if (!r.url) continue;
    out.push({
      source: "compliance",
      id: r.id,
      date: dateStr(r.date),
      label: r.label,
      url: r.url,
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

export async function getCompanyOverview(
  companyId: string,
  opts: { from?: string; to?: string } = {}
): Promise<CompanyOverview> {
  const [co] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!co) {
    return {
      expenseCount: 0,
      expenseTotalUsd: "0.00",
      harvestCount: 0,
      settlementsTotalUsd: "0.00",
      settlementsCount: 0,
      capitalInTotalUsd: "0.00",
      capitalInCount: 0,
      capitalOutTotalUsd: "0.00",
      capitalOutCount: 0,
    };
  }

  const fromExp = opts.from ? gte(expenseEntries.entryDate, opts.from) : undefined;
  const toExp = opts.to ? lte(expenseEntries.entryDate, opts.to) : undefined;
  const fromHarv = opts.from ? gte(harvests.harvestDate, opts.from) : undefined;
  const toHarv = opts.to ? lte(harvests.harvestDate, opts.to) : undefined;
  const fromCm = opts.from ? gte(cashMovements.transferDate, opts.from) : undefined;
  const toCm = opts.to ? lte(cashMovements.transferDate, opts.to) : undefined;

  const [exp] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${expenseEntries.amountUsd}), 0)::numeric(12,2)`,
    })
    .from(expenseEntries)
    .where(and(eq(expenseEntries.payeeCompanyId, companyId), fromExp, toExp));

  const [harv] = await db
    .select({
      count: sql<number>`count(distinct ${harvests.id})::int`,
      settlementsCount: sql<number>`count(${harvestSettlements.id})::int`,
      settlementsTotal: sql<string>`coalesce(sum(${harvestSettlements.netPayUsd}), 0)::numeric(12,2)`,
    })
    .from(harvests)
    .leftJoin(harvestSettlements, eq(harvestSettlements.harvestId, harvests.id))
    .where(and(eq(harvests.processorCompanyId, companyId), fromHarv, toHarv));

  const [cm] = await db
    .select({
      inCount: sql<number>`count(*) filter (where ${cashMovements.direction} = 'in_to_ec')::int`,
      inTotal: sql<string>`coalesce(sum(${cashMovements.amountUsd}) filter (where ${cashMovements.direction} = 'in_to_ec'), 0)::numeric(12,2)`,
      outCount: sql<number>`count(*) filter (where ${cashMovements.direction} = 'out_to_us')::int`,
      outTotal: sql<string>`coalesce(sum(${cashMovements.amountUsd}) filter (where ${cashMovements.direction} = 'out_to_us'), 0)::numeric(12,2)`,
    })
    .from(cashMovements)
    .where(and(sql`${cashMovements.counterparty} ILIKE ${"%" + co.name + "%"}`, fromCm, toCm));

  return {
    expenseCount: exp?.count ?? 0,
    expenseTotalUsd: exp?.total ?? "0.00",
    harvestCount: harv?.count ?? 0,
    settlementsCount: harv?.settlementsCount ?? 0,
    settlementsTotalUsd: harv?.settlementsTotal ?? "0.00",
    capitalInCount: cm?.inCount ?? 0,
    capitalInTotalUsd: cm?.inTotal ?? "0.00",
    capitalOutCount: cm?.outCount ?? 0,
    capitalOutTotalUsd: cm?.outTotal ?? "0.00",
  };
}
