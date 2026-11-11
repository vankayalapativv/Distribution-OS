import { apiRequest, type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";

export interface SaveUserPayload {
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface SavedUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

/**
 * Persist a user's identity + status. A Neon-Auth-linked account (appLoginId)
 * goes through the BFF so Neon and the app row stay in sync; a local-only
 * account goes straight to the API. Shared by the Edit dialog and the kebab's
 * Activate/Deactivate toggle so both honour the same dual path.
 */
export async function saveSuperAdminUser(
  user: SuperAdminSetupUser,
  payload: SaveUserPayload,
  actionConfig: ActionConfig,
): Promise<SavedUser> {
  if (user.appLoginId) {
    const res = await fetch("/api/admin/update-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id, appLoginId: user.appLoginId, ...payload }),
    });
    const json = (await res.json()) as SavedUser & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Could not save the user.");
    return json;
  }
  return apiRequest<SavedUser>(
    actionConfig,
    "PATCH",
    `/super-admin/users/${user.id}`,
    payload as unknown as Record<string, unknown>,
  );
}
