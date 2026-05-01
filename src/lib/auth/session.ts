// Session helpers. The cookie carries `<session_id>.<secret>` (32-byte
// secret); we hash the secret with HMAC-SHA256 (key = AUTH_COOKIE_SECRET)
// and compare against `auth_sessions.token_hash`. No plaintext secret on disk.
//
// The full chain:
//   1. /api/auth/magic-link  → email a one-time URL with token=<id>.<secret>
//   2. /api/auth/verify      → consume the magic link, mint a session,
//                              set cookie, redirect to "/"
//   3. Subsequent requests   → middleware checks the cookie and attaches
//                              x-person-id header for server-side reads.

import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, people } from "@/db/schema";

const SESSION_DURATION_DAYS = 30;
const COOKIE_NAME = "ee_session";

function getCookieSecret(): Buffer {
  const v = process.env.AUTH_COOKIE_SECRET;
  if (!v) throw new Error("AUTH_COOKIE_SECRET is missing. Set a 32-byte hex string in .env.local.");
  return Buffer.from(v, "hex");
}

export function hashWithCookieSecret(plain: string): string {
  return crypto.createHmac("sha256", getCookieSecret()).update(plain).digest("hex");
}

export function newRandomSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Mint a session for the given personId. Returns { id, secret, expiresAt }.
// Caller is responsible for setting the cookie.
export async function createSession(personId: string): Promise<{
  cookieValue: string;
  expiresAt: Date;
}> {
  const secret = newRandomSecret();
  const tokenHash = hashWithCookieSecret(secret);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400_000);
  const [row] = await db
    .insert(authSessions)
    .values({
      personId,
      tokenHash,
      expiresAt,
      lastUsedAt: new Date(),
    })
    .returning({ id: authSessions.id });
  return {
    cookieValue: `${row.id}.${secret}`,
    expiresAt,
  };
}

export type SessionPerson = {
  personId: string;
  name: string;
  email: string | null;
  role: string;
};

// Resolve a cookie value → person, or null if invalid/expired.
export async function resolveSession(cookieValue: string | undefined | null): Promise<SessionPerson | null> {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = cookieValue.slice(0, dot);
  const secret = cookieValue.slice(dot + 1);
  if (!sessionId || !secret) return null;

  let tokenHash: string;
  try {
    tokenHash = hashWithCookieSecret(secret);
  } catch {
    return null;
  }

  const [row] = await db
    .select({
      sid: authSessions.id,
      personId: authSessions.personId,
      tokenHash: authSessions.tokenHash,
      expiresAt: authSessions.expiresAt,
      name: people.name,
      email: people.email,
      role: people.role,
    })
    .from(authSessions)
    .innerJoin(people, eq(people.id, authSessions.personId))
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  if (!row) return null;
  if (row.tokenHash !== tokenHash) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  // Touch lastUsedAt occasionally — no need to fire on every request, but
  // this is cheap.
  await db.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.id, sessionId));

  return {
    personId: row.personId,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export async function destroySession(cookieValue: string | undefined): Promise<void> {
  if (!cookieValue) return;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return;
  const sessionId = cookieValue.slice(0, dot);
  if (!sessionId) return;
  await db.delete(authSessions).where(eq(authSessions.id, sessionId));
}

// Cleanup expired sessions on a best-effort basis. Cheap to call from any
// auth-touching path occasionally.
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(authSessions).where(sql`${authSessions.expiresAt} < now()`);
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

// Server-component helper: read the current person from cookies. Returns
// null when there's no valid session. Pages that require a logged-in user
// should redirect when this returns null.
export async function getCurrentPerson(): Promise<SessionPerson | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return resolveSession(jar.get(COOKIE_NAME)?.value);
}

// Best-effort lookup used by attribution. Returns null if not signed in.
export async function getCurrentPersonId(): Promise<string | null> {
  const p = await getCurrentPerson();
  return p?.personId ?? null;
}

