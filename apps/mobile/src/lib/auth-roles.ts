/**
 * Which roles may use the MOBILE app. The field roles (Sales Executive,
 * Logistics) plus SUPER_ADMIN, who has an in-app admin area (2026-08). MANAGER
 * and ACCOUNTANT are web-only.
 *
 * This is the exact complement of the web's `isWebRole`
 * (apps/web/src/features/auth/auth-role.ts): SUPER_ADMIN is on BOTH platforms,
 * SE/Logistics are mobile-only, Manager/Accountant are web-only. Keep the two in
 * sync — every role lands on exactly one platform, except SUPER_ADMIN on both.
 */
export const MOBILE_ROLES = ["SALES_EXECUTIVE", "LOGISTICS", "SUPER_ADMIN"] as const;

export type MobileRole = (typeof MOBILE_ROLES)[number];

/** True when `role` is allowed to sign in to the mobile app. A null/unknown role
 *  (e.g. a signup not yet provisioned with a role) is NOT allowed. */
export function isMobileRole(role: string | null | undefined): role is MobileRole {
  return role != null && (MOBILE_ROLES as readonly string[]).includes(role);
}
