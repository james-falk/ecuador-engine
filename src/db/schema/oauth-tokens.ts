import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One row per Google account we hold tokens for. v1 is single-account
// (jamesfalk4@gmail.com), but the table is per-account so we can add
// the work Gmails (PureSol, Finca) without a schema change.
//
// Tokens are encrypted at rest with AES-256-GCM under the OAUTH_TOKEN_KEY
// env var. Plain text never lives on disk and never logs.
export const oauthTokens = pgTable("oauth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountEmail: text("account_email").notNull().unique(),
  // Long-lived. Refresh-on-demand to mint short-lived access tokens.
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  // Cached access token + its expiry. Re-fetched lazily when expired.
  accessTokenEncrypted: text("access_token_encrypted"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  // Granted scopes — verified at use time so we fail loudly if Google
  // returned a narrower grant than we asked for.
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type OauthToken = typeof oauthTokens.$inferSelect;
export type NewOauthToken = typeof oauthTokens.$inferInsert;
