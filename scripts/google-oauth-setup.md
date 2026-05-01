# Google OAuth setup for Ecuador Engine

One-time setup so the engine can read your Drive and pull PDFs/evidence
files into the right rows. Read-only scope; no Gmail; no writes.

## What you'll create

A single OAuth 2.0 web-app client in your Google Cloud project. The
engine will use that client's ID + secret to mint short-lived access
tokens against `jamesfalk4@gmail.com`'s Drive.

## Steps (you do these once)

### 1. Open Google Cloud Console

https://console.cloud.google.com/ → top-left project picker → either
reuse an existing project (e.g. the one already wired up for the local
MCP) or create one named `ecuador-engine`.

### 2. Enable the Drive API

Sidebar → **APIs & Services** → **Library** → search "Google Drive API"
→ **Enable**.

### 3. Configure the OAuth consent screen

Sidebar → **APIs & Services** → **OAuth consent screen**.

- User type: **External** (you can keep it in Testing mode forever for
  internal use; published mode is only needed for distribution).
- App name: `Ecuador Engine`
- User support email: `jamesfalk4@gmail.com`
- Developer contact: same.
- Scopes — add these two:
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`
- Test users — add `jamesfalk4@gmail.com` (and Peter / Isaac if they'll
  ever connect their own).

### 4. Create the OAuth client

Sidebar → **APIs & Services** → **Credentials** → **+ Create
credentials** → **OAuth client ID**.

- Application type: **Web application**
- Name: `Ecuador Engine`
- Authorized JavaScript origins:
  - `http://localhost:3009`
  - (later) `https://<your-vercel-url>`
- Authorized redirect URIs:
  - `http://localhost:3009/api/google/callback`
  - (later) `https://<your-vercel-url>/api/google/callback`

Click **Create**. Google shows a modal with:

- **Client ID** — long string ending in `.apps.googleusercontent.com`
- **Client secret**

Keep that modal open or download the JSON.

### 5. Generate an at-rest encryption key

The engine encrypts your refresh token in the database with AES-256-GCM.
Generate a 32-byte hex key locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the 64-char hex output.

### 6. Fill in `.env.local`

In `c:\Users\james\blob\dev-factory\ecuador-engine\.env.local`, add:

```
GOOGLE_OAUTH_CLIENT_ID=<paste from step 4>
GOOGLE_OAUTH_CLIENT_SECRET=<paste from step 4>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3009/api/google/callback
GOOGLE_OAUTH_DEFAULT_EMAIL=jamesfalk4@gmail.com
OAUTH_TOKEN_KEY=<paste from step 5>
```

Restart the dev server so it picks up the new vars.

### 7. Apply the migration (one-time)

```bash
npx tsx scripts/apply-migration-0005.ts
```

This creates the `oauth_tokens` table.

### 8. Connect

Visit `http://localhost:3009/admin/google-auth` → **Connect Google** →
Google's consent screen → grant Drive read-only → bounces back with a
"Connected as jamesfalk4@gmail.com" banner.

### 9. Verify

Go to **Harvests → Reports → Record processor report → Browse Drive**.
You should see a modal with your Drive folders. Navigate to a
Liquidación PDF, click it, and the form's "Liquidación PDF" field
populates with the Drive view link.

Save a report → visit the matching company's **Documents** tab on
`/companies/...` → the PDF you picked appears there.

## When you deploy to Vercel later

- Add the same five env vars in Vercel project settings (with the prod
  redirect URI variant).
- Add the prod redirect URI to the OAuth client's authorized list.
- Push and visit `/admin/google-auth` on the prod URL to connect there
  separately. Tokens are per-deployment-DB; local dev and prod can each
  have their own connected account row.

## Disconnecting

`/admin/google-auth → Disconnect` revokes the grant at Google and
deletes the encrypted token row. To reconnect, click Connect again.

## Adding the work Gmails later

The `oauth_tokens` table is keyed by `account_email`, so adding
`james@kerrybros.com` or other accounts is just another connect click.
The engine currently reads from `GOOGLE_OAUTH_DEFAULT_EMAIL`; expanding
to multi-account means letting callers pass `email` through to
`getAccessToken(email)`.
