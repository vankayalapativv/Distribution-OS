import type { Context, MiddlewareHandler } from "hono";
import { ApiError } from "./errors";
import { getSqlClient } from "./db";
import {
  effectivePermissionsForRole,
  isConfigurableRole,
} from "../services/permissions";
import type { ApiEnv, AuthContext, Role } from "../types";

export function requireAuth(c: Context<ApiEnv>): AuthContext {
  const auth = c.var.auth;

  if (!auth.isAuthenticated || !auth.userId) {
    throw new ApiError(
      "UNAUTHORIZED",
      "Authentication context is required.",
      401,
    );
  }

  return auth;
}

export function requireRole(c: Context<ApiEnv>, roles: Role[]): AuthContext {
  const auth = requireAuth(c);

  if (!auth.role || !roles.includes(auth.role)) {
    throw new ApiError(
      "FORBIDDEN",
      `This endpoint requires one of these roles: ${roles.join(", ")}.`,
      403,
    );
  }

  return auth;
}

/**
 * Role gate + configurable-permission gate (migration 0073). First applies the
 * static base-role restriction (`baseRoles`), then — only for the two
 * configurable roles (MANAGER / ACCOUNTANT) — checks the effective permission
 * for `key`. SUPER_ADMIN always passes; SALES_EXECUTIVE / LOGISTICS pass
 * ungoverned (this catalog doesn't apply to them). To make an action *grantable*
 * to a role that lacks it by default, include that role in `baseRoles` and set
 * the catalog default to false — the permission check (not requireRole) then
 * governs it.
 */
export async function requireCapability(
  c: Context<ApiEnv>,
  key: string,
  baseRoles: Role[],
): Promise<AuthContext> {
  const auth = requireRole(c, baseRoles);
  if (isConfigurableRole(auth.role)) {
    const perms = await effectivePermissionsForRole(getSqlClient(c), auth.role);
    if (perms[key] !== true) {
      throw new ApiError(
        "FORBIDDEN",
        "Your role doesn't have permission for this action.",
        403,
      );
    }
  }
  return auth;
}

/**
 * Mount-level middleware that blocks a whole section (nav area) for a
 * configurable role whose `section:<sectionKey>` permission is off. Only ever
 * DENIES the two configurable roles; SUPER_ADMIN, SALES_EXECUTIVE, LOGISTICS and
 * unauthenticated requests pass straight through (their own route guards still
 * apply). Apply via `v1.use("/<path>/*", sectionGuard("<sectionKey>"))`.
 */
export function sectionGuard(sectionKey: string): MiddlewareHandler<ApiEnv> {
  const key = `section:${sectionKey}`;
  return async (c, next) => {
    const auth = c.var.auth;
    if (auth?.isAuthenticated && isConfigurableRole(auth.role)) {
      const perms = await effectivePermissionsForRole(getSqlClient(c), auth.role);
      if (perms[key] !== true) {
        throw new ApiError(
          "FORBIDDEN",
          `Access to this section is disabled for your role.`,
          403,
        );
      }
    }
    await next();
  };
}
