import { NextResponse } from "next/server";
import { getAuthToken } from "../../../features/auth/server-session";
import { serverApiFetch } from "../../../lib/server-api";

/**
 * Same-origin sink for client-side web errors. The browser error boundaries and
 * the global error listener POST here; this reads the session cookie and forwards
 * to the API's /errors/ingest with `source: "web"` — so the client never needs a
 * bearer token of its own (mirrors /api/badge-counts). Best-effort: a failure to
 * report must never surface to the user, so every path returns 2xx.
 */
export async function POST(request: Request) {
  const token = await getAuthToken();
  // No session (e.g. an error on the login page) → nothing to attribute; drop it.
  if (!token) return new NextResponse(null, { status: 204 });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const message = typeof payload.message === "string" ? payload.message : "";
  if (!message) return new NextResponse(null, { status: 204 });

  try {
    await serverApiFetch("/errors/ingest", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        source: "web",
        message: message.slice(0, 4000),
        stack: typeof payload.stack === "string" ? payload.stack.slice(0, 12000) : undefined,
        kind: typeof payload.kind === "string" ? payload.kind : undefined,
        level: payload.level === "fatal" || payload.level === "warning" ? payload.level : "error",
        route: typeof payload.route === "string" ? payload.route : undefined,
        context: payload.context ?? undefined,
      }),
    });
  } catch {
    // Swallow — reporting failures are never shown to the user.
  }
  return new NextResponse(null, { status: 202 });
}
