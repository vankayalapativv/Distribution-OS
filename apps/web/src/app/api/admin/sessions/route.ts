import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  neonAdminListSessions,
  neonAdminRevokeSession,
  neonAdminRevokeSessions,
} from "../../../../lib/neon-auth-server";
import { getSessionRole } from "../../../../features/auth/auth-role";

/**
 * Admin session management for a Neon-Auth-linked user (SUPER_ADMIN only, gated
 * by the /dashboard/super-admin/setup page + the Neon admin plugin, which
 * rejects a non-admin session). All calls use the admin's own `sa_session`.
 *
 * The Neon session TOKEN is the login credential, so it never leaves the server:
 * the client lists and revokes sessions by their opaque `id`, and DELETE
 * re-lists server-side to map id → token before revoking.
 */

async function adminSession(): Promise<string | null> {
  const store = await cookies();
  const session = store.get("sa_session")?.value ?? null;
  if (!session) return null;
  // Explicit app-role gate: only a SUPER_ADMIN may list/revoke sessions. A valid
  // sa_session cookie alone does not distinguish SUPER_ADMIN (every web role gets
  // one at login); don't rely solely on the downstream Neon admin plugin.
  const auth = await getSessionRole();
  return auth?.role === "SUPER_ADMIN" ? session : null;
}

/** GET /api/admin/sessions?appLoginId=… → a user's active sessions (no tokens). */
export async function GET(request: Request): Promise<NextResponse> {
  const appLoginId = new URL(request.url).searchParams.get("appLoginId")?.trim();
  if (!appLoginId) {
    return NextResponse.json({ error: "appLoginId is required." }, { status: 400 });
  }
  const session = await adminSession();
  if (!session) {
    return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }

  const result = await neonAdminListSessions(session, appLoginId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not load sessions." }, { status: 400 });
  }
  // Strip the credential token before it reaches the browser. Flag the admin's
  // OWN current session so the UI can bounce them to /login if they revoke it —
  // without ever exposing the token. The session cookie is signed
  // (`<token>.<signature>`) while the list returns the bare token, so match on
  // the token part, not the whole cookie.
  const currentToken = session.split(".")[0];
  const sessions = result.sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    current: s.token === session || s.token === currentToken,
  }));
  return NextResponse.json({ sessions });
}

/**
 * DELETE /api/admin/sessions — revoke sessions for a user.
 * Body `{ appLoginId, sessionId? }`: with `sessionId`, sign out that one device;
 * without it, sign out every device.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  let body: { appLoginId?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const appLoginId = String(body.appLoginId ?? "").trim();
  const sessionId = body.sessionId ? String(body.sessionId).trim() : null;
  if (!appLoginId) {
    return NextResponse.json({ error: "appLoginId is required." }, { status: 400 });
  }

  const session = await adminSession();
  if (!session) {
    return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }

  // Revoke ALL.
  if (!sessionId) {
    await neonAdminRevokeSessions(session, appLoginId);
    return NextResponse.json({ ok: true });
  }

  // Revoke ONE: re-list to resolve id → token (the token never touches the client).
  const list = await neonAdminListSessions(session, appLoginId);
  if (!list.ok) {
    return NextResponse.json({ error: list.error ?? "Could not load sessions." }, { status: 400 });
  }
  const target = list.sessions.find((s) => s.id === sessionId);
  if (!target) {
    // Already gone (expired or revoked elsewhere) — treat as success, it's idempotent.
    return NextResponse.json({ ok: true });
  }
  const revoked = await neonAdminRevokeSession(session, target.token);
  if (!revoked.ok) {
    return NextResponse.json({ error: revoked.error ?? "Could not sign out that session." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
