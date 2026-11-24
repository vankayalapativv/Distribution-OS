import { redirect } from "next/navigation";
import type { Role } from "@distribution-os/shared";
import { getAuthToken } from "./server-session";
import { serverApiFetch } from "../../lib/server-api";

// Role codes are defined once in @distribution-os/shared; `AppRole` is kept as the
// web-local alias so existing usages are unchanged (audit G-0102/G-0103).
export type AppRole = Role;

export interface MeAuthContext {
  role: AppRole | null;
  userId: string | null;
  isProviderAdmin: boolean;
  isAuthenticated: boolean;
  /** Effective permissions (from /me): key → allowed. SUPER_ADMIN is all-true. */
  permissions: Record<string, boolean>;
}

interface MeApiResponse {
  success: true;
  data: {
    auth: Omit<MeAuthContext, "permissions">;
    permissions?: Record<string, boolean>;
  };
}

const WEB_ROLES: AppRole[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];

const ROLE_DASHBOARD: Record<AppRole, string> = {
  // Web roles all land on the role-neutral home "/", which renders their dashboard.
  SUPER_ADMIN: "/",
  MANAGER: "/",
  ACCOUNTANT: "/",
  // Non-web roles have no web app: route them through the logout endpoint so their
  // session cookie is cleared before landing on /login (a bare /login redirect
  // would ping-pong back via /auth/redirect — ERR_TOO_MANY_REDIRECTS).
  SALES_EXECUTIVE: "/api/auth/logout?error=no_web_access",
  LOGISTICS: "/api/auth/logout?error=no_web_access",
};

export async function getSessionRole(): Promise<MeAuthContext | null> {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const response = await serverApiFetch("/me", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as MeApiResponse;
    return { ...body.data.auth, permissions: body.data.permissions ?? {} };
  } catch {
    return null;
  }
}

export async function requireSessionRole(): Promise<MeAuthContext> {
  const auth = await getSessionRole();

  if (!auth || !auth.isAuthenticated) {
    redirect("/login");
  }

  return auth;
}

export function dashboardForRole(role: AppRole | null): string {
  if (!role) {
    return "/login?error=not_registered";
  }

  return ROLE_DASHBOARD[role];
}

export function isWebRole(role: AppRole | null): role is "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT" {
  return role !== null && WEB_ROLES.includes(role);
}

export type OnboardingState =
  | "no_account"
  | "draft"
  | "pending"
  | "active"
  | "rejected"
  // The enterprise exists but is suspended by the platform owner. A first-class
  // state end-to-end so a suspended tenant sees a clear "account suspended" screen
  // instead of being logged out with `?error=not_registered`.
  | "suspended"
  // Sentinel: we could NOT determine the state (network blip / 5xx / token hiccup),
  // as distinct from a genuine 200 "no_account". Never clears the session — an
  // active tenant must not be logged out by a transient failure.
  | "unknown";

/**
 * The signed-in account's onboarding state (from /onboarding/me). Used to route a
 * returning user: a half-finished signup resumes the wizard, a submitted one sees
 * "awaiting approval", a rejected one sees the reason, a suspended one sees the
 * suspended screen — instead of being rejected at /login.
 *
 * A genuine 200 with no enterprise is "no_account"; a transient failure (network
 * throw, 5xx, 408/429) returns "unknown" so the caller keeps the session rather
 * than clearing it. One quick retry absorbs a single blip.
 */
export async function getOnboardingState(): Promise<OnboardingState> {
  const token = await getAuthToken();
  if (!token) return "no_account";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await serverApiFetch("/onboarding/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { state?: OnboardingState } };
        return body.data?.state ?? "no_account";
      }
      // A transient server-side failure: retry once, then report "unknown" (never
      // "no_account", which would log an active tenant out). A 4xx that is not a
      // rate-limit/timeout is treated as a genuine miss.
      if (res.status >= 500 || res.status === 408 || res.status === 429) continue;
      return "no_account";
    } catch {
      // Network-level failure — retry once, then "unknown".
    }
  }
  return "unknown";
}

/**
 * Where an authenticated session should land. The dashboard is reached ONLY by a
 * web role whose enterprise is active; every onboarding-stage account (draft /
 * no_account / pending / rejected) goes to /onboarding, which renders the right
 * surface (resume wizard, pending, rejected, or suspended). A non-web role on an
 * active enterprise (SE / Logistics) has no web app, so its session is cleared.
 */
export function landingPathFor(role: AppRole | null, state: OnboardingState): string {
  if (state === "active") {
    return isWebRole(role) ? "/" : "/api/auth/logout?error=no_web_access";
  }
  // A signup account with a users row but no enterprise yet — resume the wizard or
  // show its submitted / rejected / suspended status. All render under /onboarding.
  if (state === "draft" || state === "pending" || state === "rejected" || state === "suspended") {
    return "/onboarding";
  }
  // "unknown": a transient failure — do NOT clear the session. A web role goes to
  // the dashboard (its own guard re-resolves /me); anyone else to /onboarding,
  // which tolerates the failure and shows the wizard. Neither path bounces an
  // authenticated token, so there is no redirect loop and no false logout.
  if (state === "unknown") {
    return isWebRole(role) ? "/" : "/onboarding";
  }
  // "no_account": authenticated but NOT an enterprise app user — a platform owner
  // who came through the wrong door, or an orphan Neon identity. Not a dashboard
  // user and not an onboarding one; clear the cookie and return to /login.
  return "/api/auth/logout?error=not_registered";
}

/**
 * Whether the session may access a nav section (migration 0073 permissions).
 * SUPER_ADMIN always may; MANAGER / ACCOUNTANT are governed by their effective
 * `section:<key>` permission (defaults mirror pre-feature access). Other roles
 * (SE / LOGISTICS) have no web section access.
 */
export function canAccessSection(
  auth: MeAuthContext,
  sectionKey: string,
): auth is MeAuthContext & { role: "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT" } {
  if (auth.role === "SUPER_ADMIN") return true;
  // Only MANAGER / ACCOUNTANT carry section permissions; a true here implies a
  // web role, which lets callers treat auth.role as non-null after the check.
  return auth.permissions[`section:${sectionKey}`] === true;
}

/**
 * Whether the session may perform a configurable ACTION (e.g. "orders.create",
 * "invoices.generate", "customers.edit"). SUPER_ADMIN always may; MANAGER /
 * ACCOUNTANT are governed by their effective `action:<key>` permission. Used to
 * hide action buttons a role can't use — the API still enforces independently.
 */
export function canPerformAction(auth: MeAuthContext, actionKey: string): boolean {
  if (auth.role === "SUPER_ADMIN") return true;
  return auth.permissions[`action:${actionKey}`] === true;
}

/**
 * Page guard for a configurable section: redirects home if the session's role
 * isn't allowed the section. Replaces the old hardcoded per-page role checks so
 * SA grants/revokes take effect. The API still enforces access independently.
 */
export async function requireSectionAccess(
  sectionKey: string,
): Promise<MeAuthContext & { role: "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT" }> {
  const auth = await requireSessionRole();
  if (!canAccessSection(auth, sectionKey)) {
    redirect(dashboardForRole(auth.role));
  }
  // A passing check means role is SUPER_ADMIN or a role that holds section
  // permissions (MANAGER / ACCOUNTANT) — never null or a mobile role.
  return auth as MeAuthContext & { role: "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT" };
}
