import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { leadProposals } from "./lead-proposals";

// Interaction log for buyer/lead relationships. One row per touchpoint —
// outreach sent, reply received, call made, meeting booked, sample shipped,
// quote sent, deal closed.
//
// `buyerId` is a nullable FK into `companies.id` (NOT a separate `buyers`
// table) because buyers are modeled as companies with kind='buyer'. Pre-buyer
// interactions are anchored only by `leadProposalId`. Either FK can be null;
// at least one should be set, but the DB doesn't enforce that — too many
// edge cases (e.g. a manual log entry James drops in by hand).
//
// ON DELETE SET NULL on both FKs because interaction history outlives
// the parent record: if a lead_proposal is later promoted to a company
// and the proposal is purged, the call/meeting log shouldn't vanish.
export const leadInteractionTypeEnum = pgEnum("lead_interaction_type", [
  "outreach_sent",
  "reply_received",
  "call",
  "meeting",
  "sample_sent",
  "quote_sent",
  "closed",
]);

export const leadContactHistory = pgTable(
  "lead_contact_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    leadProposalId: uuid("lead_proposal_id").references(() => leadProposals.id, {
      onDelete: "set null",
    }),
    interactionType: leadInteractionTypeEnum("interaction_type").notNull(),
    interactionAt: timestamp("interaction_at", { withTimezone: true }).notNull(),
    note: text("note"),
    // Who/what produced the row. Examples: "agent:outreach-drafter", "james".
    draftedBy: text("drafted_by"),
    // Captured to align with the BUILD_LOG schema spec — same value the
    // other tables use for write-time provenance vs. real-world timestamp.
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    insertedAt: timestamp("inserted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    buyerIdx: index("lead_contact_history_buyer_idx").on(t.buyerId),
    leadProposalIdx: index("lead_contact_history_lead_proposal_idx").on(
      t.leadProposalId,
    ),
    interactionAtIdx: index("lead_contact_history_interaction_at_idx").on(
      t.interactionAt,
    ),
  }),
);

export type LeadContactHistoryRow = typeof leadContactHistory.$inferSelect;
export type NewLeadContactHistoryRow = typeof leadContactHistory.$inferInsert;
