import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import type { TrackedExecutive } from "./tracking-types";

// Re-exported so existing `from "./tracking-api"` imports keep working; the type
// definitions now live in ./tracking-types.
export type {
  TrackedExecutive, DeviceHealth, RoutePoint, CheckinOrder, CheckinCollection, TrackingCheckin,
} from "./tracking-types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listTrackedExecutives(): Promise<{ executives: TrackedExecutive[]; date: string }> {
  const response = await fetchApi("/tracking/executives");
  if (!response.ok) throw new Error(`Tracking API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ executives: TrackedExecutive[]; date: string }>;
  return body.data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return { apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1" };
}
