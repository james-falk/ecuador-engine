// Google's redirect lands here with ?code=… on success or ?error=… on
// user-cancel. We exchange the code, persist the encrypted refresh
// token, and bounce back to /admin/google-auth so the user sees the
// "connected as …" state. Errors are surfaced via query params so the
// admin page can render them inline rather than as a stack trace.

import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  if (err) {
    return NextResponse.redirect(
      `${origin}/admin/google-auth?error=${encodeURIComponent(err)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/admin/google-auth?error=missing_code`);
  }

  try {
    const { email } = await exchangeCode(code);
    return NextResponse.redirect(
      `${origin}/admin/google-auth?connected=${encodeURIComponent(email)}`
    );
  } catch (e) {
    const msg = (e as Error).message ?? "exchange_failed";
    return NextResponse.redirect(
      `${origin}/admin/google-auth?error=${encodeURIComponent(msg)}`
    );
  }
}
