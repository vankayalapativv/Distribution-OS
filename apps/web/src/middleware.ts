import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth-revocation guard. Protected pages already validate the session in their
 * server components, but a revoked session could otherwise linger on a cached
 * client navigation. This middleware re-checks the Neon session on every app
 * navigation so a signed-out device is bounced on its NEXT request — not only
 * on a hard refresh.
 *
 * Edge-safe: the mint check is inlined here (the shared neon-auth-server module
 * is `server-only`). It FAILS OPEN — a network hiccup never locks anyone out;
 * the page's own guard remains the backstop.
 */
const BASE = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");
const ORIGIN = process.env.NEON_AUTH_WEB_ORIGIN ?? "http://localhost:3000";
const NEON_SESSION_COOKIE = "__Secure-neon-auth.session_token";

async function neonSessionValid(session: string): Promise<boolean> {
  if (!BASE) return true; // not configured (e.g. preview) — let the page guard handle it
  try {
    const res = await fetch(`${BASE}/token`, {
      headers: { origin: ORIGIN, cookie: `${NEON_SESSION_COOKIE}=${session}` },
    });
    return res.ok;
  } catch {
    return true; // fail open
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const session = req.cookies.get("sa_session")?.value;
  const legacy = req.cookies.get("sri_aparajita_auth")?.value;

  // Only act when a Neon session is the sole credential: if it no longer mints a
  // token it was revoked/expired → clear it and return to /login. A legacy token
  // present, or no cookie at all, is left to the page's own guard.
  if (session && !legacy) {
    const ok = await neonSessionValid(session);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/logout";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Every app route except API routes, Next internals, the login page, and files
  // with an extension (static assets).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).*)"],
};
