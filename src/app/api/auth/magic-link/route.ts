// POST /api/auth/magic-link
// Body: { email: string }
// Response: { ok: true } regardless of whether the email is registered
// (don't disclose membership). The actual link is delivered via email
// (or printed to the dev console in local mode).

import { NextResponse, type NextRequest } from "next/server";
import { issueMagicLink } from "@/lib/auth/magic-link";
import { magicLinkEmail, sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

  const issued = await issueMagicLink(email);
  if (!issued.ok) {
    // Even if no person found, return generic success to avoid disclosure.
    return NextResponse.json({ ok: true });
  }

  await sendEmail(
    magicLinkEmail({
      to: issued.link.email,
      name: issued.link.personName,
      url: issued.link.url,
    })
  );

  return NextResponse.json({ ok: true });
}
