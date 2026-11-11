import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

// Role-permission management (SUPER_ADMIN). Server-side fetch of the matrix that
// the SA page edits. Enforcement lives in the API; this is the config surface.

export type PermissionKind = "section" | "action";
export type ConfigurableRole = "MANAGER" | "ACCOUNTANT";

export interface PermissionCatalogEntry {
  key: string;
  kind: PermissionKind;
  label: string;
  group: string;
}

export interface PermissionMatrix {
  catalog: PermissionCatalogEntry[];
  roles: Record<ConfigurableRole, Record<string, boolean>>;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  const headers = await getApiAuthHeaders();
  const res = await serverApiFetch("/permissions", { cache: "no-store", headers });
  if (!res.ok) throw new Error(`Permissions API failed with ${res.status}`);
  return ((await res.json()) as ApiSuccess<PermissionMatrix>).data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
