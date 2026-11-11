import type { SuperAdminSetupData } from "./super-admin-setup";
import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function getSuperAdminSetupData(): Promise<SuperAdminSetupData> {
  const response = await fetchSuperAdminSetup();

  if (!response.ok) {
    throw new Error(`Super Admin setup API failed with ${response.status}`);
  }

  const body = (await response.json()) as ApiSuccess<SuperAdminSetupData>;

  if (!body.success) {
    throw new Error("Super Admin setup API returned an unsuccessful response.");
  }

  return body.data;
}

async function fetchSuperAdminSetup(): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch("/super-admin/setup", {
    cache: "no-store",
    headers: authHeaders,
  });
}
