import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonAdminRevokeSessions, neonAdminSetPassword } from "../../../../lib/neon-auth-server";
import { getSessionRole } from "../../../../features/auth/auth-role";

/**
 * Set a Neon-Auth-linked user's password via the Admin plugin, using the
 * signed-in Super Admin's session. The target is addressed by its Neon user id
 * (users.app_login_id). Returns the password once so it can be handed over.
 */

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { appLoginId?: string; password?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const appLoginId = String(body.appLoginId ?? "").trim();
  if (!appLoginId) {
    return NextResponse.json({ error: "This account isn't linked to Neon Auth." }, { status: 400 });
  }

  const store = await cookies();
  const session = store.get("sa_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }
  // Explicit app-role gate: only a SUPER_ADMIN may reset passwords. A valid
  // sa_session cookie alone does not distinguish SUPER_ADMIN (every web role gets
  // one at login); don't rely solely on the downstream Neon admin plugin.
  const auth = await getSessionRole();
  if (auth?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const provided = body.password?.trim();
  const password = provided && provided.length > 0 ? provided : generatePassword();
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = await neonAdminSetPassword(session, { userId: appLoginId, newPassword: password });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not set the password." }, { status: 400 });
  }

  // A password reset invalidates existing sessions — so a handover logs the
  // departing person's devices out, and a lost-password reset can't be bypassed.
  await neonAdminRevokeSessions(session, appLoginId);

  return NextResponse.json({ password });
}
