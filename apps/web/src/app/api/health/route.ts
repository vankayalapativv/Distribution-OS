import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../lib/server-api";

/**
 * Public, same-origin proxy for the API's /health probe, backing the /status
 * page. No auth — the whole point is that it works during an outage. If the API
 * is reachable it forwards the health payload (200 healthy / 503 degraded-body);
 * if the API itself can't be reached, it reports a hard outage rather than throw.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await serverApiFetch("/health", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return NextResponse.json({ apiReachable: true, health: body?.data ?? null }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        apiReachable: false,
        health: {
          status: "down",
          database: { configured: true, reachable: false, latencyMs: null },
          checkedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  }
}
