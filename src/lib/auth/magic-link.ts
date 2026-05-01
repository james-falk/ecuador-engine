// Magic-link: server-side issuance + verification. The mailer is in
// src/lib/notifications/email.ts so this stays storage-only.

import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authMagicLinks, people } from "@/db/schema";
import { hashWithCookieSecret, newRandomSecret } from "./session";

const MAGIC_LINK_TTL_MIN = 30;

export type IssuedLink = {
  url: string;
  email: string;
  personName: string;
  expiresAt: Date;
};

export async function issueMagicLink(rawEmail: string): Promise<
  | { ok: true; link: IssuedLink }
  | { ok: false; error: string }
> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email required." };

  const [person] = await db
    .select({ id: people.id, name: people.name, email: people.email })
    .from(people)
    .where(sql`LOWER(${people.email}) = ${email}`)
    .limit(1);
  if (!person) {
    // Don't disclose whether the email exists.
    return { ok: false, error: "If this email is registered, a link has been sent." };
  }

  const secret = newRandomSecret();
  const tokenHash = hashWithCookieSecret(secret);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60_000);
  const [row] = await db
    .insert(authMagicLinks)
    .values({ personId: person.id, tokenHash, expiresAt })
    .returning({ id: authMagicLinks.id });

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3009";
  const url = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(`${row.id}.${secret}`)}`;

  return {
    ok: true,
    link: {
      url,
      email,
      personName: person.name,
      expiresAt,
    },
  };
}

// Verify the token, mark consumed, return personId. One-time use; an
// already-consumed or expired token returns null.
export async function consumeMagicLink(token: string): Promise<{ personId: string } | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!id || !secret) return null;

  let tokenHash: string;
  try {
    tokenHash = hashWithCookieSecret(secret);
  } catch {
    return null;
  }

  // Look up + ensure not consumed + not expired in a single SELECT, then
  // UPDATE so concurrent verifies don't both succeed (the WHERE clause on
  // consumed_at IS NULL acts as a CAS).
  const [row] = await db
    .select({
      id: authMagicLinks.id,
      personId: authMagicLinks.personId,
      tokenHash: authMagicLinks.tokenHash,
      expiresAt: authMagicLinks.expiresAt,
      consumedAt: authMagicLinks.consumedAt,
    })
    .from(authMagicLinks)
    .where(eq(authMagicLinks.id, id))
    .limit(1);
  if (!row) return null;
  if (row.tokenHash !== tokenHash) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  if (row.consumedAt) return null;

  // Mark consumed; use a CAS so a parallel verify can't reuse the link.
  const updated = await db
    .update(authMagicLinks)
    .set({ consumedAt: new Date() })
    .where(and(eq(authMagicLinks.id, row.id), sql`${authMagicLinks.consumedAt} IS NULL`))
    .returning({ id: authMagicLinks.id });
  if (updated.length === 0) return null;

  // Mark email as verified (first-time login).
  await db.update(people).set({ emailVerifiedAt: new Date() }).where(eq(people.id, row.personId));

  return { personId: row.personId };
}
