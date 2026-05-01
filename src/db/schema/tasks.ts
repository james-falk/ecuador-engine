import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { people } from "./people";
import { companies } from "./companies";

// Task status. The page filters default to NOT IN ('done', 'archived') so
// finished items stop competing with open work for screen space.
export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "blocked",
  "done",
  "archived",
]);

// Three-value priority. Stored as enum so the UI can render a fixed pill set
// (low/medium/high) and we don't have to interpret arbitrary integers.
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);

// Free-form, lightweight task table. Drives the Pending Items pillar.
// A task can be standalone (just a title), or anchored to a person + company
// + tag set. Examples:
//   - "Export License" / company=Finca / assignee=Isaac / tags=[compliance, export]
//   - "Reconcile Q4 liquidaciones" / standalone / tags=[expenses, bookkeeping]
// Tags are an array of free-form strings — no separate dictionary table; we
// derive the unique-tag set with a DISTINCT query on read.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    // Person responsible. ON DELETE SET NULL — losing a person doesn't lose
    // the task; it just becomes unassigned.
    assigneePersonId: uuid("assignee_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    // Optional company anchor (Finca, PureSol, INCALPACK, …).
    relatedCompanyId: uuid("related_company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    // Free-form tags. Lowercase by convention. Used for filtering chips.
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    dueDate: date("due_date"),
    // low / medium / high. Sort order in queries: high first.
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    // When status='blocked', why. Free text so the operator can write
    // "waiting on Tim Forrest" or "needs Drive PDF" without dropdowns.
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Provenance. "manual" for user-created; reserved for future ingest
    // sources (e.g. compliance_items reflux, master_sheet derivations).
    source: text("source"),
    // Who last mutated this row (person_id). Set by server actions from
    // the active session. Null when the actor isn't signed in (legacy or
    // unauth flows).
    lastTouchedByPersonId: uuid("last_touched_by_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    // Partial: only index OPEN/in_progress/blocked rows; done/archived stop
    // mattering on the default filter.
    statusIdx: index("tasks_status_idx").on(t.status),
    assigneeIdx: index("tasks_assignee_idx").on(t.assigneePersonId),
    companyIdx: index("tasks_company_idx").on(t.relatedCompanyId),
    dueIdx: index("tasks_due_idx").on(t.dueDate),
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
