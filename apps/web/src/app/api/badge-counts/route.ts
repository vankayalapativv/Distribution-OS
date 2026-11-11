import { NextResponse } from "next/server";
import { getAuthToken } from "../../../features/auth/server-session";
import { serverApiFetch } from "../../../lib/server-api";

/**
 * Same-origin proxy for the sidebar notification badges. The client sidebar
 * island polls this every 60s; using the session cookie here means the client
 * needs no bearer token of its own (which would otherwise have to be threaded
 * through DashboardShell on every page).
 */
export async function GET() {
  const empty = {
    tasksActive: 0,
    alertsOpen: 0,
    ordersNew: 0,
    collectionsNew: 0,
    visitsNew: 0,
    latestCollection: null,
    latestOrder: null,
    latestVisit: null,
  };
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(empty, { status: 401 });
  }

  try {
    const res = await serverApiFetch("/me/badge-counts", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(empty, { status: 200 });
    }
    const body = (await res.json()) as {
      data?: {
        tasksActive?: number;
        alertsOpen?: number;
        ordersNew?: number;
        collectionsNew?: number;
        visitsNew?: number;
        latestCollection?: { amount: number; customer: string; executive: string | null } | null;
        latestOrder?: { value: number; customer: string; executive: string | null } | null;
        latestVisit?: { customer: string; executive: string | null } | null;
      };
    };
    return NextResponse.json({
      tasksActive: body.data?.tasksActive ?? 0,
      alertsOpen: body.data?.alertsOpen ?? 0,
      ordersNew: body.data?.ordersNew ?? 0,
      collectionsNew: body.data?.collectionsNew ?? 0,
      visitsNew: body.data?.visitsNew ?? 0,
      latestCollection: body.data?.latestCollection ?? null,
      latestOrder: body.data?.latestOrder ?? null,
      latestVisit: body.data?.latestVisit ?? null,
    });
  } catch {
    return NextResponse.json(empty, { status: 200 });
  }
}
