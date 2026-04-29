import { sql } from "drizzle-orm";
import {
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const complianceJurisdictionEnum = pgEnum("compliance_jurisdiction", [
  "ecuador", // Agrocalidad, ECUAPASS, SRI, etc.
  "us_federal", // FDA, CBP, USDA, IRS
  "us_state", // state of formation, registered agent, etc.
  "carrier", // ISPM-15 pallets, container/seal numbers — per-shipment items
  "other",
]);

export const complianceAreaEnum = pgEnum("compliance_area", [
  "registration", // entity registration (FFR, SAS registration, EIN, DUNS, etc.)
  "fsvp", // Foreign Supplier Verification Program
  "phytosanitary", // phyto cert, Agrocalidad inspection
  "customs", // CBP entry, customs broker, bond, Form 5106
  "documentation", // commercial invoice, packing list, BOL
  "logistics", // freight booking, drayage, cold storage
  "labeling", // FDA labeling rules, country of origin
  "prior_notice", // FDA Prior Notice
  "other",
]);

// Status reflects ENGINE's view of evidence, not consultant's claims.
// "consultant_claims_done" is a real state because Tim Forrest has told James
// some things are done without producing the artifact (e.g. FFR registration
// number); we track those separately so they surface on the dashboard until a
// document or number lands and the engine flips them to "verified".
export const complianceStatusEnum = pgEnum("compliance_status", [
  "todo",
  "in_flight",
  "consultant_claims_done",
  "verified",
  "blocked",
  "not_applicable",
]);

// Where in the corridor this item sits. Drives the per-company UI grouping
// (Importing / Exporting / Shipment buckets on the company page).
//   - importing: bringing the container into the US (FDA, FSVP, customs entry)
//   - exporting: getting the container out of Ecuador (Agrocalidad, ECUAPASS, phyto)
//   - shipment:  the container itself (carton labels, pallets, cold chain, drayage)
// Some items overlap (FDA carton labels are technically US-side but operationally
// a shipment concern) — bucket is the operational view, jurisdiction is the legal
// origin, and they intentionally aren't 1:1.
export const complianceBucketEnum = pgEnum("compliance_bucket", [
  "importing",
  "exporting",
  "shipment",
]);

export const complianceItems = pgTable("compliance_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  bucket: complianceBucketEnum("bucket").notNull(),
  jurisdiction: complianceJurisdictionEnum("jurisdiction").notNull(),
  area: complianceAreaEnum("area").notNull(),
  // The actual checklist item — short label, e.g. "FDA Food Facility Registration".
  item: text("item").notNull(),
  description: text("description"),
  // Which OWNED entity (Finca / PureSol / Enigma) carries this item. INCALPACK's
  // FDA cert, for example, is owned by Finca's export chain even though the
  // physical responsibility sits with INCALPACK — so ownerCompanyId here is Finca
  // and `responsible` is the free-text label "INCALPACK".
  ownerCompanyId: uuid("owner_company_id"),
  // Free-text label for who's actually moving the item ("Tim Forrest", "INCALPACK",
  // "You", "Matt Kerry"). Free text because responsibility crosses person/company
  // lines and we don't want premature relational pressure.
  responsible: text("responsible"),
  // Optional hard reference to a person row (when the responsible IS a known person).
  responsiblePersonId: uuid("responsible_person_id"),
  status: complianceStatusEnum("status").notNull().default("todo"),
  // Source: where the claim/fact came from. "tim_forrest_email_2025-10-29",
  // "drive:certificate.pdf", "self-attested", etc. Free-text on purpose so we
  // don't constrain provenance prematurely.
  evidenceSource: text("evidence_source"),
  evidenceUrl: text("evidence_url"),
  // For things with an actual identifier (FDA reg #, DUNS, EIN, Agrocalidad #),
  // store the value here once verified. Null = no number known yet.
  identifier: text("identifier"),
  dueDate: date("due_date"),
  notes: text("notes"),
  // Last time someone touched this item (advanced status, added evidence, etc.).
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;
export type NewComplianceItem = typeof complianceItems.$inferInsert;
