"use client";

import { useServerPermissions } from "./permissions-context";

/**
 * Whether the signed-in user holds a capability (e.g. "action:products.manage"),
 * read from the server-provided permissions context (seeded in the root layout,
 * flash-free on first paint). Use it to hide action buttons/controls a role
 * can't use — the API still enforces independently, and an empty/stale context
 * fails safe (the control stays hidden). SUPER_ADMIN's map is all-true.
 *
 * Context-only (no client fetch) so it is safe in any component, including those
 * not wrapped in a React-Query provider. The sidebar additionally self-corrects
 * its section list via /api/my-permissions; action controls don't need that.
 */
export function useCan(permissionKey: string): boolean {
  return useServerPermissions()[permissionKey] === true;
}
