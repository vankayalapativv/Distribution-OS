import type {
  DashboardExperienceData,
  WebDashboardRole,
} from "./dashboard-experience";
import type { DashboardMetrics } from "./metrics-dashboard";
import { mapDashboardData, type ApiDashboard, type ApiSuccess } from "./dashboard-transform";
import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

type DashboardSlug = "super-admin" | "manager" | "accountant";

const roleToSlug: Record<WebDashboardRole, DashboardSlug> = {
  SUPER_ADMIN: "super-admin",
  MANAGER: "manager",
  ACCOUNTANT: "accountant",
};

export async function getDashboardExperienceData(
  role: WebDashboardRole,
): Promise<DashboardExperienceData> {
  const response = await fetchDashboard(role);
  if (!response.ok) {
    throw new Error(`Dashboard API failed with ${response.status}`);
  }
  const body = (await response.json()) as ApiSuccess<ApiDashboard>;
  if (!body.success) {
    throw new Error("Dashboard API returned an unsuccessful response.");
  }
  return mapDashboardData(body.data);
}

async function fetchDashboard(role: WebDashboardRole): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(`/dashboard/${roleToSlug[role]}`, {
    cache: "no-store",
    headers: authHeaders,
  });
}

/** The signed-in user's own name, for the dashboard greeting. Empty on failure
 *  so the caller can fall back to the role label. Works for every web auth path. */
export async function fetchMyName(): Promise<string> {
  try {
    const authHeaders = await getApiAuthHeaders();
    const response = await serverApiFetch("/me/profile", {
      cache: "no-store",
      headers: authHeaders,
    });
    if (!response.ok) return "";
    const body = (await response.json()) as ApiSuccess<{ name?: string }>;
    return body.success ? (body.data.name ?? "").trim() : "";
  } catch {
    return "";
  }
}

// ── Live metrics (2026-07-18, SUPER_ADMIN + MANAGER) ─────────────────────────

export async function getInitialDashboardMetrics(): Promise<DashboardMetrics> {
  const authHeaders = await getApiAuthHeaders();
  const response = await serverApiFetch(`/dashboard/metrics`, {
    cache: "no-store",
    headers: authHeaders,
  });
  if (!response.ok) {
    throw new Error(`Dashboard metrics API failed with ${response.status}`);
  }
  const body = (await response.json()) as ApiSuccess<DashboardMetrics>;
  return body.data;
}

export function getMetricsApiBaseUrl(): string {
  return process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1";
}
