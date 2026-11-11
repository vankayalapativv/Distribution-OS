import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonAdminCreateUser, neonAdminRemoveUser } from "../../../../lib/neon-auth-server";
import { serverApiFetch } from "../../../../lib/server-api";
import { getApiAuthHeaders } from "../../../../features/auth/server-session";

/**
 * Admin provisioning: create a user in Neon Auth (admin plugin, using the
 * signed-in Super Admin's session) AND the linked app `users` row (role +
 * app_login_id) via the API. If the app row fails, the Neon identity is rolled
 * back so we never leave an orphan. Returns the created user + a one-time
 * generated password to hand over.
 */

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { name?: string; email?: string; phone?: string | null; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const role = String(body.role ?? "").trim();
  if (!name || !email || !role) {
    return NextResponse.json({ error: "Name, email and role are required." }, { status: 400 });
  }

  const store = await cookies();
  const session = store.get("sa_session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
  }

  const password = generatePassword();

  // 1. Create the Neon Auth identity (admin-only; no public sign-up needed).
  const created = await neonAdminCreateUser(session, { email, password, name });
  if (!created.ok || !created.id) {
    return NextResponse.json({ error: created.error ?? "Could not create the account." }, { status: 400 });
  }

  // 2. Create the linked app users row (role + app_login_id) via the API.
  let apiRes: Response;
  try {
    apiRes = await serverApiFetch("/super-admin/users", {
      method: "POST",
      headers: { ...(await getApiAuthHeaders()), "content-type": "application/json" },
      body: JSON.stringify({ name, email, phone, role, appLoginId: created.id }),
    });
  } catch {
    await neonAdminRemoveUser(session, created.id);
    return NextResponse.json({ error: "Could not reach the API. Please try again." }, { status: 503 });
  }

  if (!apiRes.ok) {
    await neonAdminRemoveUser(session, created.id); // roll back the orphan identity
    let message = "Could not create the user.";
    try {
      const b = (await apiRes.json()) as { error?: { message?: string } };
      if (b.error?.message) message = b.error.message;
    } catch {
      /* keep default */
    }
    return NextResponse.json({ error: message }, { status: apiRes.status });
  }

  const { data } = (await apiRes.json()) as {
    data: { id: string; name: string; email: string | null; phone: string | null; status: string; role: string };
  };
  return NextResponse.json({ ...data, appLoginId: created.id, generatedPassword: password });
}
