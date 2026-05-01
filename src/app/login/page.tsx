// /login — magic-link request form. Public route (no auth required).
//
// Flow: enter email → POST /api/auth/magic-link → confirmation. The email
// arrives via Resend (when RESEND_API_KEY is set) or in the dev-server
// console (when not set). Click the link → /api/auth/verify mints a
// session + redirects to "/".

"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-3)",
  border: "1px solid var(--line-soft)",
  borderRadius: 8,
  color: "var(--text-0)",
  fontSize: 14,
  outline: "none",
};

export default function LoginPage() {
  const sp = useSearchParams();
  const error = sp.get("error");
  const [email, setEmail] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [sendErr, setSendErr] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSendErr(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/auth/magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!r.ok) throw new Error("send failed");
        setSent(true);
      } catch (e) {
        setSendErr((e as Error).message);
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-0)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: "100%",
          padding: 24,
          background: "var(--bg-1)",
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
            Ecuador Engine
          </h1>
          <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            Sign in with a one-time email link.
          </span>
        </div>

        {error === "invalid_or_expired" && (
          <Banner kind="err">That link was invalid or expired. Request a new one.</Banner>
        )}
        {error === "missing_token" && <Banner kind="err">Missing token. Try again.</Banner>}

        {sent ? (
          <Banner kind="ok">
            Check your inbox at <b>{email}</b>. The link expires in 30 minutes.
          </Banner>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              autoFocus
              style={inputStyle}
            />
            <button type="submit" className="btn btn--primary" disabled={isPending || !email.trim()}>
              {isPending ? "Sending…" : "Send sign-in link"}
            </button>
            {sendErr && <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{sendErr}</span>}
          </form>
        )}

        <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12, fontSize: 11, color: "var(--text-3)" }}>
          Only seeded team members (James, Peter, Isaac) can sign in. If your
          email isn&apos;t recognized you&apos;ll get the same response — no
          disclosure either way.
        </div>
      </div>
    </div>
  );
}

function Banner({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  const fg = kind === "ok" ? "var(--green)" : "var(--rose)";
  return (
    <div
      style={{
        padding: "10px 14px",
        background: `oklch(from ${fg} l c h / 0.12)`,
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
