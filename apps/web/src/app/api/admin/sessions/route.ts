import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  neonAdminListSessions,
  neonAdminRevokeSession,
  neonAdminRevokeSessions,
} from "../../../../lib/neon-auth-server";
import { authorizeTenantLoginOp } from "../../../../features/auth/admin-provisioning";

/**
 * Admin session management for a Neon-Auth-linked user. Authorized by
 * `authorizeTenantLoginOp`: the caller must be a SUPER_ADMIN AND the target
 * login must belong to their OWN enterprise; the dedicated SERVICE admin then
 * performs the Neon op (the SUPER_ADMIN is not a Neon admin).
 *
 * The Neon session TOKEN is the login credential, so it never leaves the server:
 * the client lists and revokes sessions by their opaque `id`, and DELETE
 * re-lists server-side to map id → token before revoking.
 */

/** GET /api/admin/sessions?appLoginId=… → a user's active sessions (no tokens). */
export async function GET(request: Request): Promise<NextResponse> {
  const appLoginId = new URL(request.url).searchParams.get("appLoginId")?.trim();
  if (!appLoginId) {
    return NextResponse.json({ error: "appLoginId is required." }, { status: 400 });
  }
  const authz = await authorizeTenantLoginOp(appLoginId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const result = await neonAdminListSessions(authz.serviceSession, appLoginId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not load sessions." }, { status: 400 });
  }
  // Strip the credential token before it reaches the browser. Flag the admin's
  // OWN current session (only relevant when they view their own account) so the
  // UI can bounce them to /login if they revoke it — without exposing the token.
  const store = await cookies();
  const callerSession = store.get("sa_session")?.value ?? "";
  const currentToken = callerSession.split(".")[0];
  const sessions = result.sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    current: Boolean(callerSession) && (s.token === callerSession || s.token === currentToken),
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

  const authz = await authorizeTenantLoginOp(appLoginId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  // Revoke ALL.
  if (!sessionId) {
    await neonAdminRevokeSessions(authz.serviceSession, appLoginId);
    return NextResponse.json({ ok: true });
  }

  // Revoke ONE: re-list to resolve id → token (the token never touches the client).
  const list = await neonAdminListSessions(authz.serviceSession, appLoginId);
  if (!list.ok) {
    return NextResponse.json({ error: list.error ?? "Could not load sessions." }, { status: 400 });
  }
  const target = list.sessions.find((s) => s.id === sessionId);
  if (!target) {
    // Already gone (expired or revoked elsewhere) — treat as success, it's idempotent.
    return NextResponse.json({ ok: true });
  }
  const revoked = await neonAdminRevokeSession(authz.serviceSession, target.token);
  if (!revoked.ok) {
    return NextResponse.json({ error: revoked.error ?? "Could not sign out that session." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
