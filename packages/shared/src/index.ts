/**
 * Shared contracts for the Distribution OS apps (api / web / mobile).
 *
 * The single source of truth for cross-app types that were previously duplicated
 * in each codebase (architecture audit G-0102/G-0103). Start small and grow this
 * deliberately — every type here removes a triplicated definition and its
 * connascence across the deploy boundary.
 */

/**
 * Canonical role codes (the `roles` table `code` values). One source of truth for
 * api, web, and mobile — replaces the ~800 hardcoded role string literals and the
 * per-app `Role` / `AppRole` unions (audit G-0103).
 */
export const ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE", "LOGISTICS"] as const;

export type Role = (typeof ROLES)[number];

/** The office roles that use the web dashboard (never SE / LOGISTICS). */
export const WEB_ROLES: readonly Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];

/** The field roles that use the mobile app. */
export const MOBILE_ROLES: readonly Role[] = ["SALES_EXECUTIVE", "LOGISTICS"];

/** Runtime guard: is a string a valid role code? */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Standard API response envelope. Every endpoint returns one of these; the
 * shape was previously re-declared in web and mobile API clients (audit G-0102).
 */
export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Client branding — the single source for the company/product name (architecture
 * audit G-0302). Previously "Sri Aparajita" was hardcoded across ~40 files, making
 * every new client a code fork. Consume `BRAND.*` instead of literals. For a full
 * SaaS/per-tenant setup this becomes runtime config; as a build constant it already
 * collapses the many hardcoded sites to one.
 */
export const BRAND = {
  /** Short display name (UI/tab title). */
  name: "Sri Aparajita Enterprises",
  /** Registered/legal name — used on invoices; keep the legal spelling. */
  fullName: "Sri Aparajitha Enterprise",
  /** Product/system name. */
  systemName: "Sri Aparajitha Enterprise Distribution Management System",
} as const;

// Invoice PDF renderer — the single source of truth for the generated invoice
// document, rendered on demand from data (api + web + mobile), never stored.
export { buildInvoiceDoc, DEFAULT_TERMS, type PdfData } from "./invoice-pdf.js";
