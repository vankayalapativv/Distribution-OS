import { NextResponse } from "next/server";
import { getAuthToken } from "@/features/auth/server-session";

/**
 * Mint a fresh short-lived API token from the (long-lived) session cookie.
 *
 * The Neon access token handed to the browser at page render is short-lived
 * (~15 min). When it expires, client-side API calls 401. This route lets the
 * client silently refresh — from the still-valid session — and retry, instead
 * of forcing a full page reload. The browser already holds this same token as
 * its `Bearer`, so returning it to the same authenticated session exposes
 * nothing new; a 401 here means the session itself is gone.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
