import "server-only";

import { redirect } from "next/navigation";
import { requireSessionRole, isWebRole, dashboardForRole } from "@/features/auth/auth-role";
import { getApiAuthHeaders, requireAuthToken } from "@/features/auth/server-session";
import { serverApiFetch } from "@/lib/server-api";
import type { ActionConfig } from "@/lib/api-client";
import type { BillingAccessV2, BillingChargeV2 } from "@/features/billing/billing-v2-api";
import type { SettingsRole, SystemSettings, UserProfile } from "./settings-shared";

// Public URL passed to the client component for browser-side calls (the
// browser reaches the API directly — no Worker-to-Worker restriction).
function getApiBaseUrl(): string {
  return process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1";
}

export interface SettingsProps {
  role: SettingsRole;
  profile: UserProfile;
  systemSettings: SystemSettings | null;
  actionConfig: ActionConfig;
  billingAccess: BillingAccessV2 | null;
  billingCharges: BillingChargeV2[];
  checkoutReturn: "success" | "failed" | null;
  initialTab?: string;
  closeHref: string;
}

/**
 * Shared server-side loader for the Settings dialog. Used by BOTH the full-page
 * route (hard load / billing payment-return) and the intercepted `@modal` slot
 * (soft navigation over the page you were on), so the two stay identical.
 */
export async function loadSettingsProps(sp: { checkout?: string; tab?: string }): Promise<SettingsProps> {
  const auth = await requireSessionRole();
  if (!isWebRole(auth.role)) {
    redirect(dashboardForRole(auth.role));
  }

  const apiBaseUrl = getApiBaseUrl();
  const headers = await getApiAuthHeaders();
  const authToken = await requireAuthToken();

  const profileRes = await serverApiFetch("/me/profile", { cache: "no-store", headers });
  const profileJson = profileRes.ok ? ((await profileRes.json()) as { data: UserProfile }) : null;
  const profile: UserProfile = profileJson?.data ?? { id: "", name: "", email: null, phone: null };

  let systemSettings: SystemSettings | null = null;
  let billingAccess: BillingAccessV2 | null = null;
  let billingCharges: BillingChargeV2[] = [];
  if (auth.role === "SUPER_ADMIN") {
    const settingsRes = await serverApiFetch("/system-settings", { cache: "no-store", headers });
    if (settingsRes.ok) {
      systemSettings = ((await settingsRes.json()) as { data: SystemSettings }).data;
    }
    const billingRes = await serverApiFetch("/billing/access", { cache: "no-store", headers });
    if (billingRes.ok) {
      billingAccess = ((await billingRes.json()) as { data: BillingAccessV2 }).data;
    }
    const chargesRes = await serverApiFetch("/billing/charges", { cache: "no-store", headers });
    if (chargesRes.ok) {
      billingCharges = ((await chargesRes.json()) as { data: { items: BillingChargeV2[] } }).data.items;
    }
  }

  let checkoutReturn: "success" | "failed" | null = null;
  if (sp?.checkout === "success") checkoutReturn = "success";
  else if (sp?.checkout === "failed") checkoutReturn = "failed";

  return {
    role: auth.role as SettingsRole,
    profile,
    systemSettings,
    actionConfig: { apiBaseUrl, authToken },
    billingAccess,
    billingCharges,
    checkoutReturn,
    initialTab: sp?.tab,
    closeHref: dashboardForRole(auth.role),
  };
}
