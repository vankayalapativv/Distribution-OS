import "server-only";
import { serverApiFetch } from "../../lib/server-api";
import { getApiAuthHeaders } from "./server-session";
import { getSessionRole } from "./auth-role";
import { neonServiceAdminSession } from "../../lib/neon-auth-server";

type Authorized = { ok: true; serviceSession: string };
type Denied = { ok: false; status: number; error: string };

/**
 * Authorize a server-mediated Neon-Auth admin op (set-password / edit identity /
 * manage sessions) against a target login, and return the SERVICE-admin session
 * used to perform it. Guarantees:
 *   1. the caller is a SUPER_ADMIN, and
 *   2. the target `appLoginId` resolves to a user IN THE CALLER'S OWN ENTERPRISE
 *      (via an RLS-scoped API lookup). Neon's admin role is GLOBAL across the
 *      shared project, so this tenant check — not the Neon admin — is what stops
 *      a SUPER_ADMIN from touching another enterprise's login.
 * Enterprise SUPER_ADMINs are never Neon admins; the service account does the op.
 */
export async function authorizeTenantLoginOp(appLoginId: string): Promise<Authorized | Denied> {
  const auth = await getSessionRole();
  if (auth?.role !== "SUPER_ADMIN") return { ok: false, status: 403, error: "Forbidden." };

  let res: Response;
  try {
    res = await serverApiFetch(`/super-admin/users/by-login/${encodeURIComponent(appLoginId)}`, {
      cache: "no-store",
      headers: await getApiAuthHeaders(),
    });
  } catch {
    return { ok: false, status: 503, error: "Could not reach the API. Please try again." };
  }
  if (!res.ok) return { ok: false, status: 403, error: "That user isn’t in your organisation." };

  const serviceSession = await neonServiceAdminSession();
  if (!serviceSession) {
    return { ok: false, status: 503, error: "User management isn’t configured yet. Please contact support." };
  }
  return { ok: true, serviceSession };
}
