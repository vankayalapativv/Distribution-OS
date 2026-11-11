import "server-only";

/**
 * Server-side Neon Managed Better Auth client (REST).
 *
 * We drive Neon Auth from the web BFF instead of the beta `@neondatabase/auth`
 * SDK (which pins zod v4 and conflicts with the app's zod v3). Flow:
 *   sign-in → Neon returns a signed session cookie → we store that cookie value
 *   → per server request we mint a short-lived EdDSA JWT from it and send it to
 *   the API as a Bearer token (the API verifies it against Neon's JWKS).
 */

const BASE = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/$/, "");
// Neon Auth checks the Origin against its trusted-domains list. In prod set
// NEON_AUTH_WEB_ORIGIN to the deployed web origin (and register it in Neon).
const ORIGIN = process.env.NEON_AUTH_WEB_ORIGIN ?? "http://localhost:3000";

/** Better Auth's session cookie name (as issued by Neon Auth over HTTPS). */
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

export interface NeonSignInResult {
  ok: boolean;
  /** The signed session-cookie value to persist and replay on later calls. */
  session: string | null;
  error?: string;
}

/** Extract the signed `neon-auth.session_token=…` value from Set-Cookie headers. */
function sessionFromSetCookie(res: Response): string | null {
  const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of all) {
    const m = line.match(/^__Secure-neon-auth\.session_token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

export async function neonSignIn(
  email: string,
  password: string,
  userAgent?: string | null,
): Promise<NeonSignInResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        // Forward the browser's UA so Neon records the real device for this web
        // session; without it the session logs our server's "node" UA. The
        // session management screen then shows e.g. "Chrome on Windows".
        ...(userAgent ? { "user-agent": userAgent } : {}),
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, session: null, error: "Could not reach the authentication server." };
  }

  if (!res.ok) {
    let error = "Invalid email or password.";
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) error = b.message;
    } catch {
      /* keep default */
    }
    return { ok: false, session: null, error };
  }

  const session = sessionFromSetCookie(res);
  return session
    ? { ok: true, session }
    : { ok: false, session: null, error: "No session was issued." };
}

/**
 * A fresh session for the dedicated Neon-Auth SERVICE admin — a server-only
 * account with the Neon admin role. Used to provision/manage enterprise logins
 * on behalf of an enterprise SUPER_ADMIN, who is deliberately NOT a Neon admin
 * (that role is GLOBAL across the shared Neon project, so granting it to every
 * tenant's admin would let them manage other tenants' logins). The CALLER must
 * be authorized before this session is used. Signs in fresh each call (user
 * provisioning is rare), so there is no stale-session cache to manage. Returns
 * null when the service credentials aren't configured.
 */
export async function neonServiceAdminSession(): Promise<string | null> {
  const email = process.env.NEON_SERVICE_ADMIN_EMAIL;
  const password = process.env.NEON_SERVICE_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const r = await neonSignIn(email, password);
  return r.ok ? r.session : null;
}

/**
 * Self-serve sign-up (Better Auth email+password). On success Neon auto-signs the
 * user in and returns a session cookie, just like neonSignIn.
 */
export async function neonSignUp(
  name: string,
  email: string,
  password: string,
  userAgent?: string | null,
): Promise<NeonSignInResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(userAgent ? { "user-agent": userAgent } : {}),
      },
      body: JSON.stringify({ name, email, password }),
    });
  } catch {
    return { ok: false, session: null, error: "Could not reach the authentication server." };
  }
  if (!res.ok) {
    let error = "Could not create the account.";
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) error = b.message;
    } catch {
      /* keep default */
    }
    return { ok: false, session: null, error };
  }
  const session = sessionFromSetCookie(res);
  return session ? { ok: true, session } : { ok: false, session: null, error: "No session was issued." };
}

/** Mint a fresh EdDSA JWT for the API from a stored session cookie value. */
export async function neonJwtFromSession(session: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/token`, {
      headers: { origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { token?: string };
    return b.token ?? null;
  } catch {
    return null;
  }
}

/** Admin-plugin: create a Neon Auth user (requires an admin-role session). */
export async function neonAdminCreateUser(
  session: string,
  input: { email: string; password: string; name: string },
): Promise<{ ok: boolean; id: string | null; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/create-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, id: null, error: "Could not reach the authentication server." };
  }
  if (!res.ok) {
    let raw = "";
    try {
      const b = (await res.json()) as { message?: string };
      raw = b.message ?? "";
    } catch {
      /* keep default */
    }
    // Map Neon Auth's terse admin-plugin errors to clear, actionable copy
    // instead of passing raw strings like "You are not allowed to create users"
    // straight to the admin.
    const error =
      res.status === 403 || /not allowed|permission|forbidden|unauthori[sz]ed/i.test(raw)
        ? "Your account isn’t set up to add team members yet. Please contact support to enable user management for your company."
        : /exist|already|registered|duplicate|taken/i.test(raw)
          ? "A user with this email already exists."
          : raw || "Could not create the account. Please try again.";
    return { ok: false, id: null, error };
  }
  const b = (await res.json()) as { user?: { id?: string } };
  return b.user?.id ? { ok: true, id: b.user.id } : { ok: false, id: null, error: "No user id was returned." };
}

/** Admin-plugin: update a Neon Auth user's email / name (requires an admin session). */
export async function neonAdminUpdateUser(
  session: string,
  input: { userId: string; email?: string | null; name?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const data: Record<string, string> = {};
  if (input.email) data.email = input.email;
  if (input.name) data.name = input.name;
  if (Object.keys(data).length === 0) return { ok: true }; // nothing Neon owns changed

  try {
    const res = await fetch(`${BASE}/admin/update-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ userId: input.userId, data }),
    });
    if (!res.ok) {
      let error = "Could not update the account.";
      try {
        const b = (await res.json()) as { message?: string };
        if (b.message) error = b.message;
      } catch {
        /* keep default */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the authentication server." };
  }
}

/**
 * Self-service: change the signed-in user's OWN password. Better Auth verifies
 * `currentPassword` against the session's user, so no admin role is needed — any
 * web role can rotate their own password. `revokeOtherSessions` signs the user's
 * other devices out, keeping the current session alive.
 */
export async function neonChangePassword(
  session: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/change-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    });
  } catch {
    return { ok: false, error: "Could not reach the authentication server." };
  }
  if (!res.ok) {
    // Better Auth returns 400 with a message when the current password is wrong.
    let error = res.status === 400 ? "Your current password is incorrect." : "Could not change the password.";
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) error = b.message;
    } catch {
      /* keep default */
    }
    return { ok: false, error };
  }
  return { ok: true };
}

/** Admin-plugin: set a Neon Auth user's password (requires an admin-role session). */
export async function neonAdminSetPassword(
  session: string,
  input: { userId: string; newPassword: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/admin/set-user-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      let error = "Could not set the password.";
      try {
        const b = (await res.json()) as { message?: string };
        if (b.message) error = b.message;
      } catch {
        /* keep default */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the authentication server." };
  }
}

/** One active Neon Auth session as reported by the admin plugin. `token` is the
 *  session credential — it stays server-side and is NEVER sent to the browser. */
export interface NeonSession {
  id: string;
  token: string;
  createdAt: string | null;
  expiresAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Admin-plugin: list a user's active sessions (requires an admin-role session). */
export async function neonAdminListSessions(
  session: string,
  userId: string,
): Promise<{ ok: boolean; sessions: NeonSession[]; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/list-user-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ userId }),
    });
  } catch {
    return { ok: false, sessions: [], error: "Could not reach the authentication server." };
  }
  if (!res.ok) {
    let error = "Could not load sessions.";
    try {
      const b = (await res.json()) as { message?: string };
      if (b.message) error = b.message;
    } catch {
      /* keep default */
    }
    return { ok: false, sessions: [], error };
  }
  const b = (await res.json()) as {
    sessions?: Array<{
      id?: string;
      token?: string;
      createdAt?: string;
      expiresAt?: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }>;
  };
  const sessions: NeonSession[] = (b.sessions ?? [])
    .filter((s): s is { id: string; token: string } & typeof s => Boolean(s.id && s.token))
    .map((s) => ({
      id: s.id,
      token: s.token,
      createdAt: s.createdAt ?? null,
      expiresAt: s.expiresAt ?? null,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
    }));
  return { ok: true, sessions };
}

/** Admin-plugin: revoke ONE session by its token (sign out a single device). */
export async function neonAdminRevokeSession(
  session: string,
  sessionToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/admin/revoke-user-session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ sessionToken }),
    });
    if (!res.ok) {
      let error = "Could not sign out that session.";
      try {
        const b = (await res.json()) as { message?: string };
        if (b.message) error = b.message;
      } catch {
        /* keep default */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the authentication server." };
  }
}

/** Admin-plugin: revoke ALL of a user's active sessions (log every device out). */
export async function neonAdminRevokeSessions(session: string, userId: string): Promise<void> {
  try {
    await fetch(`${BASE}/admin/revoke-user-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ userId }),
    });
  } catch {
    /* best-effort */
  }
}

/** Admin-plugin: remove a Neon Auth user (used to roll back a half-created account). */
export async function neonAdminRemoveUser(session: string, userId: string): Promise<void> {
  try {
    await fetch(`${BASE}/admin/remove-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ userId }),
    });
  } catch {
    /* best-effort */
  }
}

export async function neonSignOut(session: string): Promise<void> {
  try {
    await fetch(`${BASE}/sign-out`, {
      method: "POST",
      headers: { origin: ORIGIN, cookie: `${SESSION_COOKIE}=${session}` },
    });
  } catch {
    /* best-effort */
  }
}
