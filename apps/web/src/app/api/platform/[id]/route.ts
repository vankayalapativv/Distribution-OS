import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../../lib/server-api";
import { getAuthToken } from "../../../../features/auth/server-session";

/**
 * Full submitted config for one enterprise (approval-queue drill-down), or — with
 * `?charges=1` — its subscription charge history.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  const wantCharges = new URL(request.url).searchParams.get("charges");
  const path = wantCharges ? `/platform/enterprises/${id}/charges` : `/platform/enterprises/${id}`;
  const res = await serverApiFetch(path, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

// Each cockpit action maps to a platform-admin sub-route. Unknown actions fall
// back to approve (the original behaviour).
const ACTION_PATH: Record<string, string> = {
  approve: "approve",
  pricing: "pricing",
  reject: "reject",
  enforcement: "enforcement",
  "free-period": "free-period",
  status: "status",
  profile: "profile",
  settings: "settings",
  "invoice-series": "invoice-series",
  godowns: "godowns",
  "dues-bands": "dues-bands",
};

/** Owner actions on one enterprise. Body: { action, ... }. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string } & Record<string, unknown>;
  const path = ACTION_PATH[body.action ?? ""] ?? "approve";
  const { action: _omit, ...rest } = body;
  void _omit;
  const res = await serverApiFetch(`/platform/enterprises/${id}/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(rest),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
