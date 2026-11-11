import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonSignOut } from "../../../../lib/neon-auth-server";

/**
 * Clear the web session and return to /login. Supports both POST (the logout
 * button) and GET (server-component redirects that must drop a stale cookie —
 * e.g. a non-web role stuck in the login↔redirect loop). An optional `error`
 * query param is forwarded to /login so the reason can be shown.
 */
async function clearSessionAndRedirect(request: Request): Promise<NextResponse> {
  const store = await cookies();
  const session = store.get("sa_session")?.value;
  if (session) {
    await neonSignOut(session); // best-effort revoke of the Neon session
  }

  const error = new URL(request.url).searchParams.get("error");
  const dest = new URL(error ? `/login?error=${encodeURIComponent(error)}` : "/login", request.url);
  const response = NextResponse.redirect(dest);
  const clear = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("sa_session", "", clear);
  response.cookies.set("distribution_os_auth", "", clear); // legacy HS256 cookie
  return response;
}

export function GET(request: Request): Promise<NextResponse> {
  return clearSessionAndRedirect(request);
}

export function POST(request: Request): Promise<NextResponse> {
  return clearSessionAndRedirect(request);
}
