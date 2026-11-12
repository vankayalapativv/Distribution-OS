import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../../lib/server-api";
import { neonJwtFromSession, neonSignIn } from "../../../../lib/neon-auth-server";
import { isWebRole } from "../../../../features/auth/auth-role";
import type { Role } from "@distribution-os/shared";

const SESSION_COOKIE = "sa_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request): Promise<NextResponse> {
  let identifier: string;
  let password: string;

  try {
    const body = (await request.json()) as { identifier?: string; email?: string; password?: string };
    identifier = String(body.identifier ?? body.email ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!identifier || !password) {
    return NextResponse.json({ error: "Email/phone and password are required." }, { status: 400 });
  }

  // 1. Authenticate against Neon Managed Better Auth and get a session.
  //    An email signs in directly from here; a phone number is resolved to its
  //    account email AND signed in by the API in one call (the web server has no
  //    DB access, and resolving-then-signing-in server-side never exposes the
  //    email). The browser's User-Agent is forwarded either way so the session
  //    records the real device.
  const userAgent = request.headers.get("user-agent");
  let session: string | null = null;
  let signInError = "Invalid email/phone or password.";
  if (identifier.includes("@")) {
    const signIn = await neonSignIn(identifier, password, userAgent);
    if (signIn.ok && signIn.session) session = signIn.session;
    else signInError = signIn.error ?? signInError;
  } else {
    try {
      const res = await serverApiFetch("/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(userAgent ? { "User-Agent": userAgent } : {}) },
        body: JSON.stringify({ identifier, password, device: userAgent }),
      });
      if (res.ok) {
        const j = (await res.json()) as { data?: { session?: string } };
        session = j.data?.session ?? null;
      }
    } catch {
      // leave session null → the generic 401 below
    }
  }
  if (!session) {
    return NextResponse.json({ error: signInError }, { status: 401 });
  }

  // 2. Resolve the application role. Neon tokens carry no role claim — the API
  //    maps the Neon user id (sub) → users.app_login_id → role.
  const jwt = await neonJwtFromSession(session);
  let role: string | null = null;
  if (jwt) {
    try {
      const meRes = await serverApiFetch("/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (meRes.ok) {
        const body = (await meRes.json()) as {
          data?: { auth?: { role?: string | null } };
        };
        role = body.data?.auth?.role ?? null;
      }
    } catch {
      // fall through to the not-linked response below
    }
  }

  // A non-web role (Sales Executive / Logistics) has no web app — reject before a
  // session cookie is set (it would otherwise loop /login ↔ /auth/redirect). A
  // role-LESS account is mid-onboarding (signed up, no enterprise yet): it keeps a
  // session and /auth/redirect sends it to /onboarding to RESUME the saved draft.
  // A web role whose enterprise is still pending/rejected is likewise routed to
  // /onboarding (its status) by /auth/redirect, not the dashboard.
  if (role && !isWebRole(role as Role)) {
    return NextResponse.json(
      { error: "Your role does not have web access. Please contact your administrator." },
      { status: 403 },
    );
  }

  // A role-LESS account is either a real signup still onboarding (it HAS a users
  // row but no enterprise yet → state "draft") or an identity with no enterprise
  // app presence at all (a platform owner using the wrong login, or an orphan →
  // state "no_account"). Only the former gets a session + the onboarding flow; the
  // latter is rejected here so it never lands on "Set up your company".
  if (!role && jwt) {
    let onboardingState = "no_account";
    try {
      const r = await serverApiFetch("/onboarding/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (r.ok) {
        onboardingState = ((await r.json()) as { data?: { state?: string } }).data?.state ?? "no_account";
      }
    } catch {
      /* treat as no_account → rejected below */
    }
    if (onboardingState === "no_account") {
      return NextResponse.json(
        { error: "This account isn't set up for the dashboard yet." },
        { status: 403 },
      );
    }
  }

  // 3. Persist the Neon session; the JWT is minted per request from it.
  // `secure` is gated to production so the cookie still works over http on
  // localhost dev, but is sent only over HTTPS in the deployed app.
  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
