import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../lib/server-api";
import { getAuthToken } from "../../../features/auth/server-session";

async function auth(): Promise<string | null> {
  return getAuthToken();
}

/** Onboarding status + the saved draft, for the current signed-in user. */
export async function GET(): Promise<NextResponse> {
  const token = await auth();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const headers = { Authorization: `Bearer ${token}` };
  const meRes = await serverApiFetch("/onboarding/me", { cache: "no-store", headers });
  const me = (await meRes.json()) as { data?: unknown };
  let draft: unknown = null;
  if (meRes.ok) {
    const dRes = await serverApiFetch("/onboarding/draft", { cache: "no-store", headers });
    if (dRes.ok) draft = ((await dRes.json()) as { data?: { draft?: unknown } }).data?.draft ?? null;
  }
  return NextResponse.json({ ...(me.data ? { ...(me.data as object) } : {}), draft }, { status: meRes.status });
}

/** Autosave the wizard draft. */
export async function PUT(request: Request): Promise<NextResponse> {
  const token = await auth();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.text();
  const res = await serverApiFetch("/onboarding/draft", {
    method: "PUT",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
