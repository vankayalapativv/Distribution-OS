import { NextResponse } from "next/server";
import { neonAdminRevokeSessions, neonAdminSetPassword } from "../../../../lib/neon-auth-server";
import { authorizeTenantLoginOp } from "../../../../features/auth/admin-provisioning";

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

  // Authorize: caller is a SUPER_ADMIN AND the target login is in their own
  // enterprise. The dedicated SERVICE admin performs the reset (the SUPER_ADMIN
  // is not a Neon admin).
  const authz = await authorizeTenantLoginOp(appLoginId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const provided = body.password?.trim();
  const password = provided && provided.length > 0 ? provided : generatePassword();
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const result = await neonAdminSetPassword(authz.serviceSession, { userId: appLoginId, newPassword: password });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not set the password." }, { status: 400 });
  }

  // A password reset invalidates existing sessions — so a handover logs the
  // departing person's devices out, and a lost-password reset can't be bypassed.
  await neonAdminRevokeSessions(authz.serviceSession, appLoginId);

  return NextResponse.json({ password });
}
