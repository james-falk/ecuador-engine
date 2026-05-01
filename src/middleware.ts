// Auth gate. Active only when AUTH_COOKIE_SECRET is set in the environment.
// Without that secret, the gate no-ops so the dev server stays open without
// any setup. With it, every request that isn't on the allow-list redirects
// to /login.
//
// We don't validate the cookie here (only check presence) because middleware
// runs in the Edge runtime and our session lookup needs the Node DB driver.
// Page-level checks via getCurrentPerson() do the real validation; this
// middleware is just a router-level redirect for unauthed users.

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "ee_session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/magic-link",
  "/api/auth/verify",
  "/api/auth/logout",
  "/api/google/callback",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Static assets + Next internals.
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  // Off-by-default: skip when no secret is configured.
  if (!process.env.AUTH_COOKIE_SECRET) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
