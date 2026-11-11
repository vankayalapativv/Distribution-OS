import { NextResponse } from "next/server";
import { getAuthToken } from "../../../../features/auth/server-session";
import { serverApiFetch } from "../../../../lib/server-api";

/** Same-origin proxy: the VAPID public key the client needs to subscribe. */
export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ publicKey: null }, { status: 401 });
  try {
    const res = await serverApiFetch("/web-push/public-key", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ publicKey: null }, { status: 200 });
    const body = (await res.json()) as { data?: { publicKey?: string | null } };
    return NextResponse.json({ publicKey: body.data?.publicKey ?? null });
  } catch {
    return NextResponse.json({ publicKey: null }, { status: 200 });
  }
}
