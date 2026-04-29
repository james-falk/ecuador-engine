// DB → UI shape adapters for the compliance pillar.
//
// The UI components were built against the design's mock shape in `src/lib/data.ts`.
// These functions return the same shape but pull from the real DB so the
// components don't need to change.

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, complianceItems, type Company } from "@/db/schema";
import type { Entity, ComplianceItem, ComplianceBucket } from "@/lib/data";

// Which DB company kinds count as "James's owned entities" — the ones that
// appear in the sidebar's Companies dropdown and have their own /companies/[slug]
// page. Third-party companies (carriers, packers, buyers) do NOT belong here;
// they're network parties.
const OWNED_KINDS = ["holding", "producer", "importer"] as const;

// DB → design EntityColor. The design uses `color` to pick the avatar tint.
function entityColor(c: Pick<Company, "kind">): Entity["color"] {
  if (c.kind === "producer") return "green";
  if (c.kind === "importer") return "sky";
  return "amber"; // holding co
}

// DB stores ids/codes spread across multiple columns; the design wants a flat
// `ids: { LABEL: value }` map. Build it from whichever columns are populated.
function buildIds(c: Company): Record<string, string> {
  const ids: Record<string, string> = {};
  if (c.taxId) ids.RUC = c.taxId;
  if (c.duns) ids.DUNS = c.duns;
  if (c.ein) ids.EIN = c.ein;
  if (c.fdaRegistrationNo) ids["FDA REG"] = c.fdaRegistrationNo;
  if (c.agrocalidadRegistrationNo) ids["AGROCALIDAD"] = c.agrocalidadRegistrationNo;
  // Importer with EIN pending shows "pending" so the design's amber styling kicks in.
  if (c.kind === "importer" && !c.ein) ids.EIN = "pending";
  return ids;
}

function rowToEntity(c: Company): Entity {
  return {
    id: c.slug ?? c.id,
    name: c.name,
    role:
      c.kind === "producer" ? "producer" :
      c.kind === "importer" ? "importer" :
      c.kind === "holding"  ? "parent"   :
      c.kind,
    country: c.country === "Ecuador" ? "EC" : c.country === "United States" ? "US" : (c.country ?? ""),
    kind:
      c.kind === "producer" ? "S.A.S." :
      c.kind === "importer" ? "LLC"    :
      c.kind === "holding"  ? "Holding" :
      c.kind,
    ids: buildIds(c),
    color: entityColor(c),
  };
}

export async function getOwnedEntities(): Promise<Entity[]> {
  const rows = await db
    .select()
    .from(companies)
    .where(inArray(companies.kind, OWNED_KINDS as unknown as Company["kind"][]));
  // Sort: producer first (Finca), then importer (PureSol), then holding (Enigma).
  // Holding hidden by default — design only shows operating subs in the sidebar.
  return rows
    .filter((c) => c.kind !== "holding")
    .sort((a, b) => (a.kind === "producer" ? -1 : b.kind === "producer" ? 1 : 0))
    .map(rowToEntity);
}

export async function getEntityBySlug(slug: string): Promise<Entity | null> {
  const [row] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return row ? rowToEntity(row) : null;
}

// Convert a DB compliance row to the design's shape. We need the owner company's
// slug, so the caller passes a slug-by-id map (built once per query).
function rowToCompliance(
  r: typeof complianceItems.$inferSelect,
  slugByCompanyId: Record<string, string | null>
): ComplianceItem {
  // Map DB jurisdiction enum → human label for display. This is presentation,
  // not domain — the enum stays canonical in DB.
  const jurisdictionLabel: Record<string, string> = {
    ecuador: "Ecuador",
    us_federal: "US Federal",
    us_state: "US State",
    carrier: "Carrier",
    other: "Other",
  };
  // Same for area — DB enum to title case for the UI.
  const areaLabel: Record<string, string> = {
    registration: "Registration",
    fsvp: "FSVP",
    phytosanitary: "Phytosanitary",
    customs: "Customs",
    documentation: "Documentation",
    logistics: "Logistics",
    labeling: "Labeling",
    prior_notice: "Prior Notice",
    other: "Other",
  };
  return {
    id: r.id,
    title: r.item,
    bucket: r.bucket as ComplianceBucket,
    area: areaLabel[r.area] ?? r.area,
    jurisdiction: jurisdictionLabel[r.jurisdiction] ?? r.jurisdiction,
    owner: (r.ownerCompanyId && slugByCompanyId[r.ownerCompanyId]) || "",
    responsible: r.responsible ?? "",
    status: r.status as ComplianceItem["status"],
    identifier: r.identifier,
    evidence: r.evidenceSource ?? "",
    notes: r.notes ?? "",
  };
}

async function getSlugMap(): Promise<Record<string, string | null>> {
  const rows = await db.select({ id: companies.id, slug: companies.slug }).from(companies);
  return Object.fromEntries(rows.map((r) => [r.id, r.slug]));
}

export async function getAllCompliance(): Promise<ComplianceItem[]> {
  const [rows, slugMap] = await Promise.all([
    db.select().from(complianceItems),
    getSlugMap(),
  ]);
  return rows.map((r) => rowToCompliance(r, slugMap));
}

export async function getComplianceForEntity(slug: string): Promise<ComplianceItem[]> {
  const [entity] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!entity) return [];
  const [rows, slugMap] = await Promise.all([
    db.select().from(complianceItems).where(eq(complianceItems.ownerCompanyId, entity.id)),
    getSlugMap(),
  ]);
  return rows.map((r) => rowToCompliance(r, slugMap));
}

export async function getComplianceById(id: string): Promise<ComplianceItem | null> {
  const [row] = await db.select().from(complianceItems).where(eq(complianceItems.id, id)).limit(1);
  if (!row) return null;
  const slugMap = await getSlugMap();
  return rowToCompliance(row, slugMap);
}
