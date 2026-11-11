import { NextResponse } from "next/server";
import { getAuthToken } from "../../../../features/auth/server-session";
import { serverApiFetch } from "../../../../lib/server-api";

/** Same-origin proxy: store this browser's push subscription. */
export async function POST(req: Request) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.text();
  try {
    const res = await serverApiFetch("/web-push/subscribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ ok: res.ok }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
