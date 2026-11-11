import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../lib/server-api";
import { neonJwtFromSession, neonSignUp } from "../../../lib/neon-auth-server";

const SESSION_COOKIE = "sa_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Self-serve sign-up for a new distribution business. Creates the Neon Auth
 * account, signs them in, bootstraps the app `users` row (enterprise-less), and
 * sets the session cookie. The caller then goes to /onboarding.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let name = "", email = "", phone = "", password = "";
  try {
    const b = (await request.json()) as Record<string, unknown>;
    name = String(b.name ?? "").trim();
    email = String(b.email ?? "").trim();
    phone = String(b.phone ?? "").trim();
    password = String(b.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!name || !email.includes("@") || !phone || password.length < 8) {
    return NextResponse.json(
      { error: "Enter your name, a valid email, your phone, and a password of at least 8 characters." },
      { status: 422 },
    );
  }

  const userAgent = request.headers.get("user-agent");
  const signUp = await neonSignUp(name, email, password, userAgent);
  if (!signUp.ok || !signUp.session) {
    return NextResponse.json({ error: signUp.error ?? "Could not create the account." }, { status: 409 });
  }

  // Bootstrap the app users row (enterprise_id NULL) for the new identity.
  const jwt = await neonJwtFromSession(signUp.session);
  if (jwt) {
    try {
      await serverApiFetch("/onboarding/account", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ name, phone }),
      });
    } catch {
      // Non-fatal: the account exists in Neon Auth; /onboarding will bootstrap on load.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, signUp.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
