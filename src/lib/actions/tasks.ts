"use server";

// Tasks pillar — write paths.

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tasks, people } from "@/db/schema";
import type { TaskPriority, TaskStatus } from "@/lib/queries/tasks";
import { getCurrentPersonId } from "@/lib/auth/session";
import { sendEmail, taskAssignedEmail } from "@/lib/notifications/email";
import { logActivity } from "@/lib/activity/log";

const STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done", "archived"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

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

function normalizePriority(input: unknown): TaskPriority {
  if (typeof input === "string" && PRIORITIES.includes(input as TaskPriority)) {
    return input as TaskPriority;
  }
  return "medium";
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  assigneePersonId?: string | null;
  relatedCompanyId?: string | null;
  tags?: string[] | string | null;
  dueDate?: string | null; // YYYY-MM-DD
  priority?: TaskPriority | null;
  status?: TaskStatus | null;
  blockedReason?: string | null;
};

export async function createTask(
  input: CreateTaskInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const title = (input.title ?? "").trim();
    if (!title) return { ok: false, error: "Title is required" };

    const status = input.status && STATUSES.includes(input.status) ? input.status : "open";
    const priority = normalizePriority(input.priority);
    const tags = normalizeTags(input.tags);
    const blockedReason = input.blockedReason?.trim() || null;

    if (status === "blocked" && !blockedReason) {
      return { ok: false, error: "Blocked tasks need a reason." };
    }

    const actorId = await getCurrentPersonId();

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
        blockedReason,
        source: "manual",
        lastTouchedByPersonId: actorId,
      })
      .returning({ id: tasks.id });

    revalidatePath("/pending");
    await logActivity({
      action: "create",
      entityKind: "task",
      entityId: row.id,
      summary: `Created task: ${title}`,
      metadata: { status, priority, assigneePersonId: input.assigneePersonId ?? null },
      actorPersonId: actorId,
    });
    if (input.assigneePersonId) {
      await notifyAssigned(input.assigneePersonId, actorId, title);
    }
    return { ok: true, id: row.id };
  } catch (e) {
    console.error("createTask failed:", e);
    return { ok: false, error: (e as Error).message ?? "Insert failed" };
  }
}

async function notifyAssigned(assigneeId: string, actorId: string | null, title: string) {
  try {
    const [assignee] = await db
      .select({ name: people.name, email: people.email })
      .from(people)
      .where(eq(people.id, assigneeId))
      .limit(1);
    if (!assignee?.email) return; // No email → can't notify.
    let actorName: string | null = null;
    if (actorId && actorId !== assigneeId) {
      const [actor] = await db.select({ name: people.name }).from(people).where(eq(people.id, actorId)).limit(1);
      actorName = actor?.name ?? null;
    }
    await sendEmail(
      taskAssignedEmail({
        to: assignee.email,
        assigneeName: assignee.name,
        title,
        byName: actorName,
        appUrl: process.env.APP_BASE_URL ?? "http://localhost:3009",
      })
    );
  } catch (e) {
    console.error("notifyAssigned failed:", e);
  }
}

export type UpdateTaskInput = {
  id: string;
  title?: string;
  description?: string | null;
  assigneePersonId?: string | null;
  relatedCompanyId?: string | null;
  tags?: string[] | string | null;
  dueDate?: string | null;
  priority?: TaskPriority | null;
  status?: TaskStatus | null;
  blockedReason?: string | null;
};

export async function updateTask(
  input: UpdateTaskInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
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
    let assigneeChangedTo: string | null = null;
    if (input.assigneePersonId !== undefined) {
      patch.assigneePersonId = input.assigneePersonId || null;
      assigneeChangedTo = input.assigneePersonId || null;
    }
    if (input.relatedCompanyId !== undefined) patch.relatedCompanyId = input.relatedCompanyId || null;
    if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate || null;
    if (input.priority !== undefined) patch.priority = normalizePriority(input.priority);

    if (input.blockedReason !== undefined) {
      patch.blockedReason = input.blockedReason?.trim() || null;
    }

    if (input.status !== undefined && input.status) {
      if (!STATUSES.includes(input.status)) return { ok: false, error: `Unknown status: ${input.status}` };
      patch.status = input.status;
      // Stamp completed_at when transitioning into 'done'; clear it when leaving.
      if (input.status === "done") patch.completedAt = new Date();
      else patch.completedAt = null;

      // Enforce blocked needs a reason. Use either the new patch value or the existing one.
      if (input.status === "blocked") {
        const reason = patch.blockedReason ?? input.blockedReason ?? null;
        if (!reason) return { ok: false, error: "Blocked tasks need a reason." };
      }
    }

    const actorId = await getCurrentPersonId();
    patch.lastTouchedByPersonId = actorId;

    // Pull the title for notifications + the prior assignee to skip
    // re-notifying when the assignee didn't actually change.
    const [prior] = await db
      .select({ title: tasks.title, assigneePersonId: tasks.assigneePersonId })
      .from(tasks)
      .where(eq(tasks.id, input.id))
      .limit(1);

    await db.update(tasks).set(patch).where(eq(tasks.id, input.id));
    revalidatePath("/pending");

    await logActivity({
      action: input.status === "done" ? "complete" : "update",
      entityKind: "task",
      entityId: input.id,
      summary: `Updated task: ${patch.title ?? prior?.title ?? ""}`.trim(),
      metadata: { changes: Object.keys(patch).filter((k) => k !== "updatedAt" && k !== "lastTouchedByPersonId") },
      actorPersonId: actorId,
    });

    if (
      prior &&
      assigneeChangedTo &&
      assigneeChangedTo !== prior.assigneePersonId
    ) {
      await notifyAssigned(assigneeChangedTo, actorId, patch.title ?? prior.title);
    }
    return { ok: true };
  } catch (e) {
    console.error("updateTask failed:", e);
    return { ok: false, error: (e as Error).message ?? "Update failed" };
  }
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
