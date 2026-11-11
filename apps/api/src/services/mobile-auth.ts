/**
 * Server-side Neon Managed Better Auth client for the MOBILE auth proxy.
 *
 * Phase 2 of the weak-signal auth fix: the mobile app used to call the Neon Auth
 * host (`…aws.neon.tech`) DIRECTLY from the device, which flaky mobile DNS often
 * failed to resolve (login failures + token-refresh logouts on 4G). These
 * endpoints move that hop server-side — the device talks only to the reliable
 * Cloudflare API host, and the Worker talks to Neon from inside Cloudflare's
 * network. Mirrors apps/web/src/lib/neon-auth-server.ts.
 *
 * (Token VERIFICATION still lives in lib/neon-auth.ts — this file only does the
 * sign-in / token-mint / sign-out REST calls.)
 */
import type { ApiEnv } from "../types";

type Env = ApiEnv["Bindings"];

/** Better Auth's session cookie name (issued by Neon Auth over HTTPS). */
const SESSION_COOKIE = "__Secure-neon-auth.session_token";
const NEON_TIMEOUT_MS = 10_000;

function base(env: Env): string {
  return (env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");
}
// Neon checks the Origin against its trusted-domains list. localhost:3000 is a
// registered trusted origin (the web BFF + the old direct-from-device mobile
// path both use it), so it is the safe default.
function origin(env: Env): string {
  return env.NEON_AUTH_ORIGIN ?? "http://localhost:3000";
}

/** fetch to Neon with a hard timeout (a stalled connect must not hang the Worker). */
async function neonFetch(env: Env, path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEON_TIMEOUT_MS);
  try {
    return await fetch(`${base(env)}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the signed `__Secure-neon-auth.session_token=…` value from Set-Cookie. */
function sessionFromSetCookie(res: Response): string | null {
  const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of all) {
    const m = line.match(/^__Secure-neon-auth\.session_token=([^;]+)/);
    if (m) return m[1];
  }
  const raw = res.headers.get("set-cookie") ?? "";
  const m = raw.match(/__Secure-neon-auth\.session_token=([^;]+)/);
  return m ? m[1] : null;
}

export interface NeonUser {
  id: string;
  name: string;
  email: string;
}

export type SignInResult =
  | { ok: true; session: string; user: NeonUser }
  | { ok: false; status: number; error: string };

export async function neonSignIn(
  env: Env,
  email: string,
  password: string,
  userAgent?: string,
): Promise<SignInResult> {
  let res: Response;
  try {
    res = await neonFetch(env, "/sign-in/email", {
      method: "POST",
      // Forward the caller's device string as the session user-agent so the
      // admin "Manage sessions" screen can name the device (mirrors the web
      // login BFF). Better Auth records this on the session row.
      headers: {
        "content-type": "application/json",
        origin: origin(env),
        ...(userAgent ? { "user-agent": userAgent } : {}),
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, status: 503, error: "Could not reach the authentication server." };
  }
  if (!res.ok) {
    let error = "Invalid email or password.";
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) error = b.message;
    } catch {
      /* keep default */
    }
    // 401/403 from Neon = bad credentials; anything else = upstream trouble.
    const status = res.status === 401 || res.status === 403 ? 401 : 503;
    return { ok: false, status, error };
  }
  const session = sessionFromSetCookie(res);
  const body = (await res.json().catch(() => ({}))) as { user?: NeonUser };
  if (!session || !body.user) {
    return { ok: false, status: 503, error: "Sign-in did not return a session." };
  }
  return { ok: true, session, user: body.user };
}

/** Three-way token outcome so the mobile client can tell a revoked session from
 *  a mere upstream outage (keep the user signed in on "unavailable"). */
export type TokenOutcome =
  | { status: "active"; token: string }
  | { status: "revoked" }
  | { status: "unavailable" };

export async function neonMintToken(env: Env, session: string): Promise<TokenOutcome> {
  let res: Response;
  try {
    res = await neonFetch(env, "/token", {
      headers: { origin: origin(env), cookie: `${SESSION_COOKIE}=${session}` },
    });
  } catch {
    return { status: "unavailable" };
  }
  if (res.status === 401 || res.status === 403) return { status: "revoked" };
  if (!res.ok) return { status: "unavailable" };
  const b = (await res.json().catch(() => ({}))) as { token?: string };
  return b.token ? { status: "active", token: b.token } : { status: "unavailable" };
}

export async function neonSignOut(env: Env, session: string): Promise<void> {
  try {
    await neonFetch(env, "/sign-out", {
      method: "POST",
      headers: { origin: origin(env), cookie: `${SESSION_COOKIE}=${session}` },
    });
  } catch {
    /* best-effort */
  }
}
