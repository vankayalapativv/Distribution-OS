import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonAdminUpdateUser } from "../../../../lib/neon-auth-server";
import { serverApiFetch } from "../../../../lib/server-api";
import { getApiAuthHeaders } from "../../../../features/auth/server-session";

/**
 * Edit a user's identity. For Neon-Auth-linked accounts the email + name are
 * synced to the Neon identity (so their LOGIN email changes) BEFORE the app row
 * is updated — Neon runs first so an email clash is caught before any DB write.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    id?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    status?: string;
    appLoginId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const name = String(body.name ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const status = String(body.status ?? "").trim();
  if (!id || !name || !status) {
    return NextResponse.json({ error: "Name and status are required." }, { status: 400 });
  }

  const store = await cookies();
  const session = store.get("sa_session")?.value;

  // 1. Sync the Neon identity (email/name) first.
  if (body.appLoginId) {
    if (!session) {
      return NextResponse.json({ error: "Your session has expired — sign in again." }, { status: 401 });
    }
    const upd = await neonAdminUpdateUser(session, { userId: body.appLoginId, email, name });
    if (!upd.ok) {
      return NextResponse.json({ error: upd.error ?? "Could not update the account." }, { status: 400 });
    }
  }

  // 2. Update the app users row.
  let apiRes: Response;
  try {
    apiRes = await serverApiFetch(`/super-admin/users/${id}`, {
      method: "PATCH",
      headers: { ...(await getApiAuthHeaders()), "content-type": "application/json" },
      body: JSON.stringify({ name, email, phone, status }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the API. Please try again." }, { status: 503 });
  }

  if (!apiRes.ok) {
    let message = "Could not save the user.";
    try {
      const b = (await apiRes.json()) as { error?: { message?: string } };
      if (b.error?.message) message = b.error.message;
    } catch {
      /* keep default */
    }
    return NextResponse.json({ error: message }, { status: apiRes.status });
  }

  const { data } = (await apiRes.json()) as {
    data: { id: string; name: string; email: string | null; phone: string | null; status: string };
  };
  return NextResponse.json(data);
}
