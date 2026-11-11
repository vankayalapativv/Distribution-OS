import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { neonJwtFromSession } from "../../lib/neon-auth-server";

/** Holds the Neon Managed Better Auth session (the app's primary login). */
const NEON_SESSION_COOKIE = "sa_session";
/** Legacy HS256 token cookie — kept as a fallback until the Neon Auth cutover. */
const LEGACY_JWT_COOKIE = "sri_aparajita_auth";

// Neon access tokens are short-lived (~15 min), so we mint a fresh one from the
// stored session on each server request — memoized per request/session so a
// page render hits Neon's /token at most once.
const mintJwt = cache((session: string) => neonJwtFromSession(session));

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();

  const session = cookieStore.get(NEON_SESSION_COOKIE)?.value;
  if (session) {
    const jwt = await mintJwt(session);
    if (jwt) return jwt;
  }

  // Fallback: the legacy HS256 token (pre-Neon-Auth login).
  return cookieStore.get(LEGACY_JWT_COOKIE)?.value ?? null;
}

export async function requireAuthToken(): Promise<string> {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login");
  }

  return token;
}

export async function getApiAuthHeaders() {
  const token = await requireAuthToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}
