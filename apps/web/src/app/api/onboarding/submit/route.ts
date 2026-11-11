import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../../lib/server-api";
import { getAuthToken } from "../../../../features/auth/server-session";

/** Submit the completed wizard → creates the pending enterprise. */
export async function POST(request: Request): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.text();
  const res = await serverApiFetch("/onboarding/submit", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
