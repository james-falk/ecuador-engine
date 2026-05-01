import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vettingStatusEnum } from "./companies";

// Roles a person can play in the engine. A single person can hold multiple
// roles across multiple companies, so this is a free-text-ish enum that hints
// the typical UI treatment, not a hard constraint.
export const personRoleEnum = pgEnum("person_role", [
  "owner",
  "co_owner",
  "operator", // on-the-ground ops (e.g. Isaac Garcia)
  "attorney",
  "accountant",
  "consultant",
  "buyer_contact",
  "carrier_contact",
  "advisor",
  "other",
]);

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id"),
  name: text("name").notNull(),
  role: personRoleEnum("role").notNull(),
  // companyIds is a list because one person often touches multiple companies
  // (e.g. Matt Kerry is attorney for both Enigma and PureSol).
  companyIds: uuid("company_ids").array(),
  primaryEmail: text("primary_email"),
  altEmails: text("alt_emails").array(),
  // Login email — distinct from primaryEmail (which is the contact email
  // for external comms). Set only for internal team members who need to
  // sign in. Nullable; uniqueness enforced via lower() index.
  email: text("email"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  primaryPhone: text("primary_phone"),
  whatsapp: text("whatsapp"),
  country: text("country"),
  vettingStatus: vettingStatusEnum("vetting_status").notNull().default("unvetted"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
