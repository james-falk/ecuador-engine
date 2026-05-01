// Single-page admin surface for the Google OAuth connection. Shows the
// currently-connected accounts, lets you start a new connection, and
// disconnects an existing one. v1 expects exactly one account
// (jamesfalk4@gmail.com); the table is multi-row so adding the work
// Gmails later is just additional connect clicks.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { listConnectedAccounts } from "@/lib/google/oauth";
import { startConnectAction, disconnectAccountAction } from "@/lib/actions/google-auth";

export const dynamic = "force-dynamic";

export default async function GoogleAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const accounts = await listConnectedAccounts();

  // Only flag missing env vars at render time, never at module load.
  const envIssues: string[] = [];
  for (const k of [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REDIRECT_URI",
    "GOOGLE_OAUTH_DEFAULT_EMAIL",
    "OAUTH_TOKEN_KEY",
  ]) {
    if (!process.env[k]) envIssues.push(k);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Admin", "Google auth"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {accounts.length} connected
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Google connection
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Read-only Drive access for picking PDFs and evidence files.
            </span>
          </div>

          {params.connected && (
            <Banner kind="ok">Connected as {params.connected}.</Banner>
          )}
          {params.error && (
            <Banner kind="err">{decodeURIComponent(params.error)}</Banner>
          )}
          {envIssues.length > 0 && (
            <Banner kind="warn">
              Missing env vars: {envIssues.join(", ")}. See <code>scripts/google-oauth-setup.md</code>.
            </Banner>
          )}

          <Section title="Accounts">
            {accounts.length === 0 ? (
              <div
                style={{
                  padding: "24px 18px",
                  border: "1px dashed var(--line-soft)",
                  borderRadius: 10,
                  color: "var(--text-3)",
                  fontSize: 12.5,
                  textAlign: "center",
                }}
              >
                No accounts connected yet.
              </div>
            ) : (
              <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
                {accounts.map((a, i) => (
                  <div
                    key={a.email}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 14,
                      padding: "14px 16px",
                      alignItems: "center",
                      borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ color: "var(--text-1)", fontSize: 13 }}>{a.email}</span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                        {a.scopes.length} scope{a.scopes.length === 1 ? "" : "s"}
                        {a.lastUsedAt ? ` · last used ${a.lastUsedAt.toISOString().slice(0, 10)}` : ""}
                      </span>
                    </div>
                    <form action={disconnectAccountAction}>
                      <input type="hidden" name="email" value={a.email} />
                      <button type="submit" className="btn btn--ghost" style={{ fontSize: 11.5 }}>
                        Disconnect
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Connect a Google account">
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 0 }}>
              Opens Google&apos;s consent screen, then bounces back here. Drive
              read-only scope only.
            </p>
            <form action={startConnectAction}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={envIssues.length > 0}
                title={envIssues.length > 0 ? "Set the missing env vars first." : ""}
              >
                Connect Google
              </button>
            </form>
          </Section>

          <Section title="GCP setup">
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 0 }}>
              See <Link href="https://github.com/" style={{ color: "var(--text-1)" }}>scripts/google-oauth-setup.md</Link> in the repo for step-by-step
              instructions on creating an OAuth client, picking scopes, and
              filling in the four env vars above.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ font: "500 14px/1.2 var(--font-display)", margin: "0 0 10px", color: "var(--text-1)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Banner({ kind, children }: { kind: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const bg =
    kind === "ok" ? "color-mix(in oklab, var(--green) 12%, var(--bg-1))" :
    kind === "warn" ? "color-mix(in oklab, var(--amber) 12%, var(--bg-1))" :
    "color-mix(in oklab, var(--rose) 12%, var(--bg-1))";
  const fg = kind === "ok" ? "var(--green)" : kind === "warn" ? "var(--amber)" : "var(--rose)";
  return (
    <div
      style={{
        marginBottom: 18,
        padding: "10px 14px",
        background: bg,
        border: `1px solid ${fg}`,
        borderRadius: 8,
        color: fg,
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}
