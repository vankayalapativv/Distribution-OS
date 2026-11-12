import { NextResponse } from "next/server";
import { serverApiFetch } from "../../../../lib/server-api";
import { getAuthToken } from "../../../../features/auth/server-session";

/** Full submitted config for one enterprise (approval-queue drill-down). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  const res = await serverApiFetch(`/platform/enterprises/${id}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

/** Approve (+ set price), edit pricing, or reject (+ reason) an enterprise. Body: { action, ... }. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string } & Record<string, unknown>;
  const action =
    body.action === "reject"
      ? "reject"
      : body.action === "pricing"
        ? "pricing"
        : body.action === "enforcement"
          ? "enforcement"
          : "approve";
  const { action: _omit, ...rest } = body;
  void _omit;
  const res = await serverApiFetch(`/platform/enterprises/${id}/${action}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(rest),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
