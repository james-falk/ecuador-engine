// GET /api/auth/verify?token=<id.secret>
// Consume the magic link, mint a session, set the cookie, redirect home.
// Errors redirect to /login?error=<message> so the UI can render.

import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { AUTH_COOKIE_NAME, createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const origin = url.origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(`${origin}/login?error=invalid_or_expired`);
  }

  const session = await createSession(consumed.personId);
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set(AUTH_COOKIE_NAME, session.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
