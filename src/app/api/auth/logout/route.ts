import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, destroySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  await destroySession(cookie);
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
