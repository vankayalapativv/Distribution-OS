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
