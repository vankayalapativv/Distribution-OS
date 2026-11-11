import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

export interface Alert {
  id: string;
  alertDate: string;
  alertType: string;
  severity: string;
  customerId: string | null;
  customerName: string | null;
  executiveId: string | null;
  executiveName: string | null;
  alertMessage: string;
  recommendedAction: string | null;
  status: string;
  closedAt: string | null;
  createdAt: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}


async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listAlerts(params?: {
  status?: string;
}): Promise<Alert[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);

  const query = qs.toString();
  const response = await fetchApi(`/alerts${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Alerts API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<Alert[]>;
  return body.data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl:
      process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
