import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { people } from "./people";

// Drive files pinned to a company by a user. Surfaces on the Companies →
// Documents tab alongside the auto-pulled ones (settlement PDFs, harvest
// evidence, compliance evidence). The drive_* columns snapshot what we
// knew at pin time; metadata is re-fetched lazily when needed.
export const entityDriveFiles = pgTable("entity_drive_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  driveFileId: text("drive_file_id").notNull(),
  driveFileName: text("drive_file_name").notNull(),
  driveViewLink: text("drive_view_link").notNull(),
  driveMimeType: text("drive_mime_type"),
  driveModifiedTime: timestamp("drive_modified_time", { withTimezone: true }),
  pinnedByPersonId: uuid("pinned_by_person_id").references(() => people.id, { onDelete: "set null" }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().default(sql`now()`),
  notes: text("notes"),
});

export type EntityDriveFile = typeof entityDriveFiles.$inferSelect;
export type NewEntityDriveFile = typeof entityDriveFiles.$inferInsert;
