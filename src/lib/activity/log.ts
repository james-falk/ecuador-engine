// Activity logger. Server-side helper that any mutating action can call
// to drop a row in `activity_events`. Always best-effort: a failed log
// row never blocks the main mutation.

import { db } from "@/db";
import { activityEvents } from "@/db/schema";
import { getCurrentPersonId } from "@/lib/auth/session";

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "complete"
  | "reopen"
  | "advance_stage"
  | "pin_drive_file"
  | "unpin_drive_file"
  | "send_invite"
  | "sign_in"
  | "sign_out"
  | (string & { __brand?: "custom" });

export type LogActivityInput = {
  action: ActivityAction;
  entityKind: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  // Optional override; if not provided, we read from the current session.
  // Useful for system actions that should explicitly attribute null.
  actorPersonId?: string | null;
};

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const actor =
      input.actorPersonId !== undefined
        ? input.actorPersonId
        : await getCurrentPersonId();
    await db.insert(activityEvents).values({
      actorPersonId: actor,
      action: input.action,
      entityKind: input.entityKind,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    // Never throw from the logger — the main action's success/failure
    // shouldn't depend on whether we logged it.
    console.error("logActivity failed:", e);
  }
}
