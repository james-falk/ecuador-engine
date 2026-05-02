import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Buyer-scout output. One row per discovered candidate buyer before James
// promotes it into `companies` (kind='buyer'). Built by Item #5 onward.
//
// Dedupe contract: `dedupe_key` is SHA256(company_name_canonical +
// '|' + website_canonical) — see BUILD_LOG.md "Dedupe strategy" for the
// canonicalization rules. Buyer-scout MUST query existing
// `lead_proposals.dedupe_key` before inserting.
//
// Cross-table dedupe note (read before Item #5): BUILD_LOG also says
// buyer-scout must query `buyers.dedupe_key`, but there is no `buyers`
// table — buyers are rows in `companies` with kind='buyer', and the
// `companies` table is on the don't-touch list. Item #5 will add the
// companies-side dedupe via either a side table or query-time hash;
// nothing here pre-commits that decision.
export const leadProposalStatusEnum = pgEnum("lead_proposal_status", [
  "proposed",
  "approved",
  "rejected",
  "deferred",
]);

export const leadProposals = pgTable(
  "lead_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    // Provenance: which scraper/source surfaced this lead. Examples:
    //   "importyeti-shipment", "friedas-directory",
    //   "hunts-point-tenant-list", "hmart-procurement".
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    companyName: text("company_name").notNull(),
    // Lowercased, host-only registered domain. No protocol, no path, no www.
    websiteCanonical: text("website_canonical"),
    // Lowercased, trimmed email if found. Nullable.
    contactEmailCanonical: text("contact_email_canonical"),
    // Digits-only phone if found. Nullable.
    contactPhoneCanonical: text("contact_phone_canonical"),
    // Free-text capacity signal. Examples: "imported 12 containers in 2025".
    volumeSignal: text("volume_signal"),
    // Full scraped payload + parser interpretation. Audit trail.
    evidenceBlob: jsonb("evidence_blob"),
    // 0-100 buyer-scout score. Higher = better fit.
    score: integer("score"),
    status: leadProposalStatusEnum("status").notNull().default("proposed"),
    // SHA256 of canonicalized identity (see BUILD_LOG dedupe section).
    // Unique — duplicate inserts are rejected at the DB layer; the
    // scout upgrades the existing row's evidence_blob instead.
    dedupeKey: text("dedupe_key").notNull(),
    insertedAt: timestamp("inserted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    dedupeKeyUnique: uniqueIndex("lead_proposals_dedupe_key_unique").on(t.dedupeKey),
    statusIdx: index("lead_proposals_status_idx").on(t.status),
    sourceIdx: index("lead_proposals_source_idx").on(t.source),
    capturedIdx: index("lead_proposals_captured_idx").on(t.capturedAt),
  }),
);

export type LeadProposal = typeof leadProposals.$inferSelect;
export type NewLeadProposal = typeof leadProposals.$inferInsert;
