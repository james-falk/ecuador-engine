// Tasks pillar — read paths.

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, people, companies, type Task } from "@/db/schema";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "done"
  | "archived";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneePersonId: string | null;
  assigneeName: string | null;
  relatedCompanyId: string | null;
  relatedCompanyName: string | null;
  relatedCompanySlug: string | null;
  tags: string[];
  dueDate: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  source: string | null;
};

function dateStr(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}
function tsStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.toISOString();
}

const taskSelect = () =>
  db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      assigneePersonId: tasks.assigneePersonId,
      assigneeName: people.name,
      relatedCompanyId: tasks.relatedCompanyId,
      relatedCompanyName: companies.name,
      relatedCompanySlug: companies.slug,
      tags: tasks.tags,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      completedAt: tasks.completedAt,
      source: tasks.source,
    })
    .from(tasks)
    .leftJoin(people, eq(people.id, tasks.assigneePersonId))
    .leftJoin(companies, eq(companies.id, tasks.relatedCompanyId));

function rowToTask(r: Awaited<ReturnType<ReturnType<typeof taskSelect>["execute"]>>[number]): TaskRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as TaskStatus,
    assigneePersonId: r.assigneePersonId,
    assigneeName: r.assigneeName,
    relatedCompanyId: r.relatedCompanyId,
    relatedCompanyName: r.relatedCompanyName,
    relatedCompanySlug: r.relatedCompanySlug,
    tags: (r.tags as string[] | null) ?? [],
    dueDate: dateStr(r.dueDate),
    priority: r.priority,
    createdAt: tsStr(r.createdAt),
    updatedAt: tsStr(r.updatedAt),
    completedAt: tsStr(r.completedAt),
    source: r.source,
  };
}

// Default filter EXCLUDES done + archived so the page shows live work.
// Pass `includeDone=true` to surface them too.
export type TaskFilters = {
  assigneeId?: string;
  companyId?: string;
  tag?: string;
  dueBefore?: string;
  includeDone?: boolean;
};

export async function getTasks(filters: TaskFilters = {}): Promise<TaskRow[]> {
  const where = [
    filters.includeDone
      ? undefined
      : sql`${tasks.status} NOT IN ('done', 'archived')`,
    filters.assigneeId ? eq(tasks.assigneePersonId, filters.assigneeId) : undefined,
    filters.companyId ? eq(tasks.relatedCompanyId, filters.companyId) : undefined,
    filters.tag ? sql`${filters.tag} = ANY(${tasks.tags})` : undefined,
    filters.dueBefore ? lte(tasks.dueDate, filters.dueBefore) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];

  const rows = await taskSelect()
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      // Overdue first (NULLs last), then priority desc, then most recent.
      sql`${tasks.dueDate} ASC NULLS LAST`,
      desc(tasks.priority),
      desc(tasks.createdAt)
    );
  return rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<TaskRow | null> {
  const [row] = await taskSelect().where(eq(tasks.id, id)).limit(1);
  return row ? rowToTask(row) : null;
}

// All distinct tags currently in use, sorted alphabetically. Drives the
// filter chip UI.
export async function getTaskTags(): Promise<string[]> {
  const r = await db.execute<{ tag: string }>(
    sql`SELECT DISTINCT unnest(tags) AS tag FROM tasks ORDER BY tag`
  );
  return r.rows.map((row) => row.tag).filter(Boolean);
}

// All people / all companies for the filter dropdowns. Cheap full scans —
// these tables are small and the page mounts infrequently.
//
// Internal-only filter: only James, Peter, Isaac use this app, so external
// people (advisors, attorneys, accountants, vendor contacts) are filtered
// out of assignee pickers. The internal trio carries roles `owner`,
// `co_owner`, or `operator`. External names stay in the DB as references
// (compliance evidence, harvest delivery slip names, etc.) but don't
// pollute the assignee dropdown.
const INTERNAL_ROLES = ["owner", "co_owner", "operator"] as const;

export async function getTaskAssigneeOptions(): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(inArray(people.role, INTERNAL_ROLES as unknown as (typeof people.role.enumValues)[number][]))
    .orderBy(asc(people.name));
  return rows;
}

// Companies dropdown filter: only the operating entities James and Peter
// actually run (producer + importer). External companies (processors,
// carriers, buyers, lawyers, etc.) live in the same table but don't make
// sense as "related company" on internal tasks.
const INTERNAL_COMPANY_KINDS = ["producer", "importer"] as const;

export async function getTaskCompanyOptions(): Promise<Array<{ id: string; name: string; slug: string | null }>> {
  const rows = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug })
    .from(companies)
    .where(inArray(companies.kind, INTERNAL_COMPANY_KINDS as unknown as (typeof companies.kind.enumValues)[number][]))
    .orderBy(asc(companies.name));
  return rows;
}

// Bulk lookup by id list (for the drawer's pre-fetch when re-opening).
export async function getTasksByIds(ids: string[]): Promise<TaskRow[]> {
  if (ids.length === 0) return [];
  const rows = await taskSelect().where(inArray(tasks.id, ids));
  return rows.map(rowToTask);
}

// Range scan — used by the Companies hub Activity tab to show this entity's
// open work alongside its harvests/expenses. `since` is an ISO date or
// timestamp string; parsed to a Date so Drizzle's typed comparison accepts
// it on the timestamptz column.
export async function getTasksForCompany(companyId: string, opts: { since?: string } = {}): Promise<TaskRow[]> {
  const sinceDate = opts.since ? new Date(opts.since) : null;
  const where = [
    eq(tasks.relatedCompanyId, companyId),
    sinceDate && !Number.isNaN(sinceDate.getTime()) ? gte(tasks.createdAt, sinceDate) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  const rows = await taskSelect().where(and(...where)).orderBy(desc(tasks.createdAt));
  return rows.map(rowToTask);
}

export type { Task };
