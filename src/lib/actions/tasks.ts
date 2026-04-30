"use server";

// Tasks pillar — write paths.

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { TaskStatus } from "@/lib/queries/tasks";

const STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done", "archived"];

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    if (typeof input === "string") {
      return input
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }
  return input
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  assigneePersonId?: string | null;
  relatedCompanyId?: string | null;
  tags?: string[] | string | null;
  dueDate?: string | null; // YYYY-MM-DD
  priority?: number | null;
  status?: TaskStatus | null;
};

export async function createTask(
  input: CreateTaskInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const status = input.status && STATUSES.includes(input.status) ? input.status : "open";
  const tags = normalizeTags(input.tags);
  const priority = Number.isFinite(input.priority as number) ? Math.trunc(input.priority as number) : 0;

  const [row] = await db
    .insert(tasks)
    .values({
      title,
      description: input.description?.trim() || null,
      status,
      assigneePersonId: input.assigneePersonId || null,
      relatedCompanyId: input.relatedCompanyId || null,
      tags,
      dueDate: input.dueDate || null,
      priority,
      source: "manual",
    })
    .returning({ id: tasks.id });

  revalidatePath("/pending");
  return { ok: true, id: row.id };
}

export type UpdateTaskInput = {
  id: string;
  title?: string;
  description?: string | null;
  assigneePersonId?: string | null;
  relatedCompanyId?: string | null;
  tags?: string[] | string | null;
  dueDate?: string | null;
  priority?: number | null;
  status?: TaskStatus | null;
};

export async function updateTask(
  input: UpdateTaskInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id" };

  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) return { ok: false, error: "Title cannot be blank" };
    patch.title = t;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.assigneePersonId !== undefined) patch.assigneePersonId = input.assigneePersonId || null;
  if (input.relatedCompanyId !== undefined) patch.relatedCompanyId = input.relatedCompanyId || null;
  if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate || null;
  if (input.priority !== undefined) {
    patch.priority = Number.isFinite(input.priority as number) ? Math.trunc(input.priority as number) : 0;
  }
  if (input.status !== undefined && input.status) {
    if (!STATUSES.includes(input.status)) return { ok: false, error: `Unknown status: ${input.status}` };
    patch.status = input.status;
    // Stamp completed_at when transitioning into 'done'; clear it when leaving.
    if (input.status === "done") patch.completedAt = new Date();
    else patch.completedAt = null;
  }

  await db.update(tasks).set(patch).where(eq(tasks.id, input.id));
  revalidatePath("/pending");
  return { ok: true };
}

export async function completeTask(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };
  await db
    .update(tasks)
    .set({ status: "done", completedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(tasks.id, id));
  revalidatePath("/pending");
  return { ok: true };
}

export async function reopenTask(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };
  await db
    .update(tasks)
    .set({ status: "open", completedAt: null, updatedAt: sql`now()` })
    .where(eq(tasks.id, id));
  revalidatePath("/pending");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/pending");
  return { ok: true };
}
