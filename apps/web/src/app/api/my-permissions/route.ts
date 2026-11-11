import { NextResponse } from "next/server";
import { getAuthToken } from "../../../features/auth/server-session";
import { serverApiFetch } from "../../../lib/server-api";

/**
 * Same-origin proxy exposing the caller's effective permissions to the sidebar
 * client island (session-cookie auth, no bearer token threaded through pages).
 * Used to hide nav sections a MANAGER / ACCOUNTANT isn't allowed to see. The API
 * still enforces access server-side — this is UX only.
 */
export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ permissions: {} }, { status: 401 });
  try {
    const res = await serverApiFetch("/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ permissions: {} }, { status: 200 });
    const body = (await res.json()) as { data?: { permissions?: Record<string, boolean> } };
    return NextResponse.json({ permissions: body.data?.permissions ?? {} });
  } catch {
    return NextResponse.json({ permissions: {} }, { status: 200 });
  }
}
