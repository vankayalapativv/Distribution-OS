import { NextResponse, type NextRequest } from "next/server";
import { OWNER_PREFIX, isOwnerHost } from "./lib/owner-host";

/**
 * Two jobs:
 *
 * 1. **Host routing for the owner cockpit.** The cockpit is served by this same
 *    worker on its own subdomain (owner.distributionos…). On the owner host every
 *    app path is rewritten into the real `/owner` route segment (App Router can't
 *    address a bare route group by path); on the apex host the `/owner` namespace
 *    is blocked. Serving the cockpit on a separate host keeps its `sa_session`
 *    cookie host-only, so it never clobbers a tenant's apex session.
 *
 * 2. **Auth-revocation guard.** Protected pages already validate the session in
 *    their server components, but a revoked session could otherwise linger on a
 *    cached client navigation. This middleware re-checks the Neon session on
 *    every app navigation so a signed-out device is bounced on its NEXT request —
 *    not only on a hard refresh.
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
  const legacy = req.cookies.get("distribution_os_auth")?.value;
  const owner = isOwnerHost(req.headers.get("host"));
  const path = req.nextUrl.pathname;

  // Revocation guard runs first and may redirect on either host (the owner's
  // sa_session is a Neon session too). A /owner/* logout redirect is left intact
  // below (it is already inside the owner namespace, so no rewrite applies).
  if (session && !legacy) {
    const ok = await neonSessionValid(session);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/logout";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (owner) {
    // Owner host → serve the cockpit. Rewrite any non-prefixed app path into the
    // `/owner` segment ("/" → "/owner", "/anything" → "/owner/anything"). API and
    // Next internals are matcher-excluded and never reach here.
    if (path !== OWNER_PREFIX && !path.startsWith(`${OWNER_PREFIX}/`)) {
      const url = req.nextUrl.clone();
      url.pathname = path === "/" ? OWNER_PREFIX : `${OWNER_PREFIX}${path}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Apex (tenant) host → the cockpit namespace is off-limits; send it home.
  if (path === OWNER_PREFIX || path.startsWith(`${OWNER_PREFIX}/`)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Every app route except API routes, Next internals, the login page, and files
  // with an extension (static assets).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).*)"],
};
