import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../../lib/server-api";
import { neonJwtFromSession, neonSignIn } from "../../../../lib/neon-auth-server";

const SESSION_COOKIE = "sa_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Platform-owner sign-in for the `/admin` cockpit. Signs in via Neon Auth, then
 * confirms the account is a platform owner (the API's /platform/* returns 403
 * otherwise). The owner has no enterprise role, so this is separate from /login.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let email = "", password = "";
  try {
    const b = (await request.json()) as { email?: string; password?: string };
    email = String(b.email ?? "").trim();
    password = String(b.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const userAgent = request.headers.get("user-agent");
  const signIn = await neonSignIn(email, password, userAgent);
  if (!signIn.ok || !signIn.session) {
    return NextResponse.json({ error: signIn.error ?? "Invalid email or password." }, { status: 401 });
  }

  const jwt = await neonJwtFromSession(signIn.session);
  const check = jwt
    ? await serverApiFetch("/platform/enterprises", { cache: "no-store", headers: { Authorization: `Bearer ${jwt}` } })
    : null;
  if (!check || !check.ok) {
    return NextResponse.json({ error: "This account is not a platform owner." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, signIn.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
