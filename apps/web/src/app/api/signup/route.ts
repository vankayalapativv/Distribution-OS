import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApiFetch } from "../../../lib/server-api";
import { neonJwtFromSession, neonSignUp } from "../../../lib/neon-auth-server";
import { OTP_COOKIE, verifyOtp } from "../../../lib/otp";

const SESSION_COOKIE = "sa_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const OTP_ERRORS: Record<string, string> = {
  missing: "Your verification code has expired. Please request a new one.",
  expired: "Your verification code has expired. Please request a new one.",
  email_mismatch: "This code was sent to a different email. Request a new one.",
  too_many: "Too many incorrect attempts. Please request a new code.",
  mismatch: "That code is incorrect. Please check and try again.",
};

/**
 * Self-serve sign-up for a new distribution business. Verify-before-create: the
 * email OTP (set by /api/signup/send-otp, stored as a hash in a signed cookie)
 * must check out FIRST. Only then do we create the Neon Auth account, sign them
 * in, bootstrap the app `users` row (enterprise-less), and set the session
 * cookie. The caller then goes to /onboarding.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let name = "", email = "", phone = "", password = "", code = "";
  try {
    const b = (await request.json()) as Record<string, unknown>;
    name = String(b.name ?? "").trim();
    email = String(b.email ?? "").trim();
    phone = String(b.phone ?? "").trim();
    password = String(b.password ?? "");
    code = String(b.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!name || !email.includes("@") || !phone || password.length < 8) {
    return NextResponse.json(
      { error: "Enter your name, a valid email, your phone, and a password of at least 8 characters." },
      { status: 422 },
    );
  }

  // Gate on the email OTP before creating anything.
  const cookieStore = await cookies();
  const verdict = await verifyOtp(cookieStore.get(OTP_COOKIE)?.value, email, code);
  if (!verdict.ok) {
    const res = NextResponse.json(
      { error: OTP_ERRORS[verdict.reason] ?? "Could not verify the code.", otp: verdict.reason },
      { status: 422 },
    );
    // Persist the bumped attempt counter on a wrong-but-allowed code.
    if (verdict.cookie) {
      res.cookies.set(OTP_COOKIE, verdict.cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }
    return res;
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
  // Burn the verification cookie — it has done its job.
  response.cookies.set(OTP_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
