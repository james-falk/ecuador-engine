import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// `kind` describes WHAT a company is in the engine's domain model.
// Add new kinds as the operation grows (e.g. "broker", "buyer", "lab").
export const companyKindEnum = pgEnum("company_kind", [
  "holding", // parent holding co (e.g. Enigma)
  "producer", // farm / grower (e.g. Finca del Dragón)
  "packing_facility", // third-party packer (e.g. INCALPACK)
  "importer", // US importer of record (e.g. PureSol Imports)
  "carrier", // ocean / air freight carrier (e.g. Seaboard Marine)
  "freight_forwarder", // ground / origin coordination
  "customs_broker",
  "buyer", // end buyer / distributor
  "consultant", // e.g. Tim Forrest Consulting
  "lawyer", // e.g. Kerry Law PLLC
  "other",
]);

// `vetting_status` is universal across every imported entity per James's rule:
// nothing trusted by default, everything explicitly graded.
export const vettingStatusEnum = pgEnum("vetting_status", [
  "unvetted",
  "vetted",
  "disqualified",
  "dead",
]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"), // null = current single-tenant; reserved for multi-tenant
  // URL-safe handle. UI routes (/companies/[slug]) and cross-pillar references
  // use the slug rather than the UUID so URLs stay stable through DB resets.
  // Nullable so external/imported companies (carriers, buyers) don't need one.
  slug: text("slug").unique(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  kind: companyKindEnum("kind").notNull(),
  parentId: uuid("parent_id"), // self-reference for parent-subsidiary; resolved in queries
  country: text("country"),
  addressLine: text("address_line"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  website: text("website"),
  primaryEmail: text("primary_email"),
  primaryPhone: text("primary_phone"),
  // Identifiers — nullable; engine populates as evidence arrives
  taxId: text("tax_id"), // generic; for Finca this is the RUC, for US co's the EIN
  duns: text("duns"),
  ein: text("ein"),
  fdaRegistrationNo: text("fda_registration_no"),
  agrocalidadRegistrationNo: text("agrocalidad_registration_no"),
  vettingStatus: vettingStatusEnum("vetting_status").notNull().default("unvetted"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
