// Email sender. Wraps Resend if RESEND_API_KEY is set; otherwise prints
// to the dev-server console (so local development doesn't need real mail
// infrastructure). Never throws — logging-only failure ensures auth and
// pipeline events keep flowing even if Resend is down.

import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export type EmailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; provider: "resend" | "console"; error?: string }> {
  const from = process.env.EMAIL_FROM ?? "Ecuador Engine <onboarding@resend.dev>";
  const resend = getResend();

  if (!resend) {
    // Local dev fallback. Prints the email body so developers can copy
    // the magic-link URL without setting up Resend.
    // eslint-disable-next-line no-console
    console.log("\n────────── ✉️  EMAIL (console fallback) ──────────");
    console.log(`From: ${from}`);
    console.log(`To: ${msg.to}`);
    console.log(`Subject: ${msg.subject}`);
    if (msg.text) {
      console.log("\n" + msg.text);
    }
    if (msg.html) {
      console.log("\n[HTML body, " + msg.html.length + " chars]");
    }
    console.log("──────────────────────────────────────────────────\n");
    return { ok: true, provider: "console" };
  }

  try {
    // Resend's typed union requires either html OR text (not both undefined).
    // Build the payload conditionally so TS picks the right variant.
    const base = { from, to: msg.to, subject: msg.subject };
    const payload = msg.html
      ? { ...base, html: msg.html, text: msg.text }
      : { ...base, text: msg.text ?? "" };
    const r = await resend.emails.send(payload);
    if (r.error) {
      console.error("Resend error:", r.error);
      return { ok: false, provider: "resend", error: r.error.message };
    }
    return { ok: true, provider: "resend" };
  } catch (e) {
    console.error("sendEmail threw:", e);
    return { ok: false, provider: "resend", error: (e as Error).message };
  }
}

// ── Templates ─────────────────────────────────────────────────────────

export function magicLinkEmail({ to, name, url }: { to: string; name: string; url: string }): EmailMessage {
  return {
    to,
    subject: "Sign in to Ecuador Engine",
    text: `Hi ${name},\n\nClick to sign in (expires in 30 minutes):\n${url}\n\nIf you didn't request this, ignore.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #222;">
        <p>Hi ${escapeHtml(name)},</p>
        <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#0d6e3f;color:#fff;border-radius:6px;text-decoration:none;">Sign in to Ecuador Engine</a></p>
        <p style="color:#666;font-size:13px;">Link expires in 30 minutes. If you didn't request this, ignore.</p>
      </div>
    `,
  };
}

export function taskAssignedEmail({
  to,
  assigneeName,
  title,
  byName,
  appUrl,
}: {
  to: string;
  assigneeName: string;
  title: string;
  byName: string | null;
  appUrl: string;
}): EmailMessage {
  return {
    to,
    subject: `Task assigned: ${title}`,
    text: `${assigneeName},\n\n${byName ? `${byName} ` : ""}assigned you a task: "${title}".\n\nView in Ecuador Engine: ${appUrl}/pending`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #222;">
        <p>Hi ${escapeHtml(assigneeName)},</p>
        <p>${byName ? `${escapeHtml(byName)} assigned` : "You were assigned"} a new task:</p>
        <p style="font-weight:600;">${escapeHtml(title)}</p>
        <p><a href="${escapeHtml(appUrl)}/pending">Open Pending Items →</a></p>
      </div>
    `,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
