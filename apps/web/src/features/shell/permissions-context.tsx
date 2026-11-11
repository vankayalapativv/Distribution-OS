"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Effective permissions (key → allowed) for the signed-in user, provided by the
 * server (dashboard layout) so client islands like the sidebar can filter the
 * nav on FIRST paint — no client fetch, no flash of not-yet-filtered items.
 * SUPER_ADMIN receives an all-true map; other roles their effective set.
 */
const PermissionsContext = createContext<Record<string, boolean>>({});

export function PermissionsProvider({
  value,
  children,
}: {
  readonly value: Record<string, boolean>;
  readonly children: ReactNode;
}) {
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function useServerPermissions(): Record<string, boolean> {
  return useContext(PermissionsContext);
}
