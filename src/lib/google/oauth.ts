// Google OAuth 2.0 — server-side flow for the deployed engine.
// Single account in v1 (jamesfalk4@gmail.com). The table is keyed by
// account_email so adding the work Gmails later is a row insert, not
// a migration.
//
// Flow:
//   /admin/google-auth → "Connect" → getAuthorizeUrl → Google consent →
//     /api/google/callback?code=… → exchangeCode → store encrypted refresh
//     token → redirect back. Subsequent calls use getAccessToken which
//     refreshes lazily when the cached access token expires.

import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthTokens } from "@/db/schema";
import { encrypt, decrypt } from "./crypto";

// Drive read-only is enough for picking + linking PDFs. Add more scopes
// (gmail.readonly, drive.file for write) when those features land.
export const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing. See README for GCP setup.`);
  return v;
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    envOrThrow("GOOGLE_OAUTH_CLIENT_ID"),
    envOrThrow("GOOGLE_OAUTH_CLIENT_SECRET"),
    envOrThrow("GOOGLE_OAUTH_REDIRECT_URI")
  );
}

export function getAuthorizeUrl(state?: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    // Force a refresh-token return even on re-consent — Google otherwise
    // omits it on subsequent grants.
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

// Exchanges the ?code= from the callback for tokens, identifies the
// account, and upserts the encrypted refresh token. Returns the email
// so the admin page can show "connected as …".
export async function exchangeCode(code: string): Promise<{ email: string }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke the prior grant in your Google account and try again."
    );
  }
  client.setCredentials(tokens);

  // Identify which Google account just consented.
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: me } = await oauth2.userinfo.get();
  const email = me.email;
  if (!email) throw new Error("Could not read email from userinfo response.");

  const now = new Date();
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  const grantedScopes = (tokens.scope ?? "").split(" ").filter(Boolean);

  const refreshEnc = encrypt(tokens.refresh_token);
  const accessEnc = tokens.access_token ? encrypt(tokens.access_token) : null;

  // Upsert by account_email — Postgres ON CONFLICT keeps it atomic.
  await db
    .insert(oauthTokens)
    .values({
      accountEmail: email,
      refreshTokenEncrypted: refreshEnc,
      accessTokenEncrypted: accessEnc,
      accessTokenExpiresAt: expiresAt,
      scopes: grantedScopes,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: oauthTokens.accountEmail,
      set: {
        refreshTokenEncrypted: refreshEnc,
        accessTokenEncrypted: accessEnc,
        accessTokenExpiresAt: expiresAt,
        scopes: grantedScopes,
        updatedAt: now,
        lastUsedAt: now,
      },
    });

  return { email };
}

// Returns a fresh access token for the given account. Refreshes via
// the long-lived refresh token if the cached access token is missing
// or within 60s of expiry.
export async function getAccessToken(email: string): Promise<string> {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.accountEmail, email))
    .limit(1);
  if (!row) throw new Error(`No Google connection for ${email}. Visit /admin/google-auth.`);

  const now = Date.now();
  const expMs = row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt).getTime() : 0;
  if (row.accessTokenEncrypted && expMs - 60_000 > now) {
    return decrypt(row.accessTokenEncrypted);
  }

  // Refresh.
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: decrypt(row.refreshTokenEncrypted) });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Refresh did not return an access_token.");

  const accessEnc = encrypt(credentials.access_token);
  const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
  await db
    .update(oauthTokens)
    .set({
      accessTokenEncrypted: accessEnc,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    })
    .where(eq(oauthTokens.id, row.id));
  return credentials.access_token;
}

export async function disconnectAccount(email: string): Promise<void> {
  // Best-effort revoke at Google, then drop the row regardless. We don't
  // want a stale row hanging around if Google's revoke endpoint is down.
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.accountEmail, email))
    .limit(1);
  if (row) {
    try {
      const client = getOAuth2Client();
      const refresh = decrypt(row.refreshTokenEncrypted);
      await client.revokeToken(refresh);
    } catch {
      // Ignore — we still drop the row below.
    }
    await db.delete(oauthTokens).where(eq(oauthTokens.id, row.id));
  }
}

export async function listConnectedAccounts() {
  return db
    .select({
      email: oauthTokens.accountEmail,
      scopes: oauthTokens.scopes,
      createdAt: oauthTokens.createdAt,
      lastUsedAt: oauthTokens.lastUsedAt,
    })
    .from(oauthTokens)
    .orderBy(oauthTokens.accountEmail);
}
