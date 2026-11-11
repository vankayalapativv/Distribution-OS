import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../lib/server-api";

/**
 * Public, same-origin proxy for the API's /status-summary (90-day component
 * history + live current status), backing the /status page. No auth. If the API
 * itself can't be reached, it reports that so the page can show a hard outage.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await serverApiFetch("/status-summary", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return NextResponse.json({ apiReachable: true, summary: body?.data ?? null }, { status: 200 });
  } catch {
    return NextResponse.json({ apiReachable: false, summary: null }, { status: 200 });
  }
}
