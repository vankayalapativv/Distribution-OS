import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonChangePassword } from "../../../../lib/neon-auth-server";

/**
 * Self-service password change for the signed-in web user. Uses their own
 * `sa_session` (all web roles authenticate via Neon Auth), so no admin role is
 * required — Better Auth verifies the current password against the session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both current and new passwords are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const store = await cookies();
  const session = store.get("sa_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }

  const result = await neonChangePassword(session, currentPassword, newPassword);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not change the password." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
