// Read paths for the global activity log.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, people } from "@/db/schema";

export type ActivityRow = {
  id: string;
  actorPersonId: string | null;
  actorName: string | null;
  action: string;
  entityKind: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  happenedAt: string; // ISO
};

function tsStr(v: Date | string | null | undefined): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.toISOString();
}

export async function getRecentActivity(opts: { limit?: number } = {}): Promise<ActivityRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await db
    .select({
      id: activityEvents.id,
      actorPersonId: activityEvents.actorPersonId,
      actorName: people.name,
      action: activityEvents.action,
      entityKind: activityEvents.entityKind,
      entityId: activityEvents.entityId,
      summary: activityEvents.summary,
      metadata: activityEvents.metadata,
      happenedAt: activityEvents.happenedAt,
    })
    .from(activityEvents)
    .leftJoin(people, eq(people.id, activityEvents.actorPersonId))
    .orderBy(desc(activityEvents.happenedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    actorPersonId: r.actorPersonId,
    actorName: r.actorName,
    action: r.action,
    entityKind: r.entityKind,
    entityId: r.entityId,
    summary: r.summary,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    happenedAt: tsStr(r.happenedAt),
  }));
}
