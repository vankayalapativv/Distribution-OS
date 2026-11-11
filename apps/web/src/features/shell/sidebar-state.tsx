"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SIDEBAR_COLLAPSED_COOKIE } from "./sidebar-cookie";

interface SidebarCollapsedValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarCollapsedContext = createContext<SidebarCollapsedValue>({
  collapsed: false,
  setCollapsed: () => {},
});

/** Persist the collapsed choice (~1 year) so it survives reloads and sessions. */
function persist(collapsed: boolean) {
  try {
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* private mode / blocked cookies — collapse still works for this view */
  }
}

/**
 * Holds the desktop sidebar collapsed state. Rendered in the ROOT layout, which
 * stays mounted across client navigations — so the choice SURVIVES navigating
 * between pages. The per-page DashboardShell/SidebarNav remounts on every
 * navigation, so it must NOT own this state; it reads this persistent source
 * instead. Seeded from the `sidebar_collapsed` cookie server-side for a correct
 * first paint with no hydration flash; the setter also writes the cookie back.
 */
export function SidebarCollapsedProvider({
  initial,
  children,
}: {
  readonly initial: boolean;
  readonly children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initial);
  const value = useMemo<SidebarCollapsedValue>(
    () => ({
      collapsed,
      setCollapsed: (v: boolean) => {
        setCollapsed(v);
        persist(v);
      },
    }),
    [collapsed],
  );
  return <SidebarCollapsedContext.Provider value={value}>{children}</SidebarCollapsedContext.Provider>;
}

export function useSidebarCollapsed(): SidebarCollapsedValue {
  return useContext(SidebarCollapsedContext);
}
