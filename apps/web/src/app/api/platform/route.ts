import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../lib/server-api";
import { getAuthToken } from "../../../features/auth/server-session";

/** List enterprises (optionally by status) for the platform-owner cockpit. */
export async function GET(request: Request): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const res = await serverApiFetch(`/platform/enterprises${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
