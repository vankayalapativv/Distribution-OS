"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { withQueryClient } from "@/components/data-table/query-provider";
import { buildNavSections, type DashboardRole, type NavKey } from "./dashboard-nav";
import { useServerPermissions } from "./permissions-context";
import { useSidebarCollapsed } from "./sidebar-state";
import { BADGE_REFRESH_EVENT } from "./badge-refresh";
import { fetchBadgeCounts } from "./badge-fetch";

interface BadgeCounts {
  tasksActive: number;
  alertsOpen: number;
  ordersNew: number;
  collectionsNew: number;
}

/**
 * Sidebar with live notification badges. It polls the same-origin
 * `/api/badge-counts` proxy every 60s (session-cookie auth, no token needed)
 * and shows a count pill on the Alerts + Tasks items. Rendered as a client
 * island inside the presentational DashboardShell.
 */
function SidebarNavInner({
  role,
  active,
  open = false,
  onClose,
}: {
  readonly role: DashboardRole;
  readonly active?: NavKey;
  /** Mobile drawer open state (ignored ≥lg, where the sidebar is always shown). */
  readonly open?: boolean;
  /** Close the mobile drawer (on link click, close button, or backdrop). */
  readonly onClose?: () => void;
}) {
  const allSections = buildNavSections(role, active);

  // Permissions come from the server (root layout) via context, so the nav is
  // correct on the FIRST render with no flash. But the root layout does NOT
  // re-run on client navigations, so that context can be stale right after login
  // (client-navigated from a page that rendered before the auth cookie existed).
  // So we ALSO fetch fresh permissions on the client and self-correct — the
  // context seeds initialData so there's no flash when it's already right, and
  // the fetch guarantees a not-granted section can never linger in the sidebar.
  const serverPerms = useServerPermissions();
  const { data: perms } = useQuery<Record<string, boolean>>({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/my-permissions", { cache: "no-store" });
      if (!res.ok) return serverPerms;
      return ((await res.json()) as { permissions?: Record<string, boolean> }).permissions ?? serverPerms;
    },
    initialData: serverPerms,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const sections =
    role === "SUPER_ADMIN"
      ? allSections
      : allSections
          .map((section) => ({
            ...section,
            // Hide a section only when its permission is explicitly false.
            items: section.items.filter((item) => perms[`section:${item.key}`] !== false),
          }))
          .filter((section) => section.items.length > 0);

  const { data, refetch } = useQuery<BadgeCounts>({
    queryKey: ["badge-counts"],
    // Shared fetcher: de-duplicates against the sound notifier's poll so the page
    // hits /api/badge-counts once when both fire together (e.g. on load).
    queryFn: () => fetchBadgeCounts(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // A mutation elsewhere (alert close, task create/status change) fires this
  // window event so the badge re-pulls its counts immediately, rather than
  // waiting for the 60s poll — it lives in its own QueryClient, unreachable by
  // the pages' invalidateQueries.
  useEffect(() => {
    const onRefresh = () => void refetch();
    window.addEventListener(BADGE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(BADGE_REFRESH_EVENT, onRefresh);
  }, [refetch]);

  const countFor = (key: NavKey): number => {
    if (!data) return 0;
    if (key === "alerts") return data.alertsOpen;
    if (key === "tasks") return data.tasksActive;
    if (key === "orders") return data.ordersNew;
    if (key === "collections") return data.collectionsNew;
    return 0;
  };

  // Desktop-only collapse to an icon rail. The state lives in the persistent
  // root-layout provider (this component remounts on every navigation), seeded
  // from the cookie for a correct first paint. Below lg the sidebar is the
  // off-canvas drawer and ALWAYS renders full labels — the collapsed presentation
  // is scoped to `lg:` utilities throughout.
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const toggleCollapsed = () => setCollapsed(!collapsed);
  // Clicking a nav item only closes the mobile drawer. The collapsed rail STAYS
  // collapsed across navigation (the persistent provider holds the state); only
  // the toggle button changes it.

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-[264px] shrink-0 flex-col border-r border-border bg-white shadow-xl transition-[transform,width] duration-200 ease-out lg:sticky lg:top-[calc(3.5rem_+_var(--billing-banner-h,0px))] lg:z-auto lg:h-[calc(100vh_-_3.5rem_-_var(--billing-banner-h,0px))] lg:translate-x-0 lg:shadow-none ${
        collapsed ? "lg:w-[68px]" : "lg:w-[240px]"
      } ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* Collapse/expand toggle — a circular button straddling the right border,
          aligned with the first (OVERVIEW) row. Desktop only. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="absolute right-0 top-4 z-10 hidden size-6 translate-x-1/2 place-items-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:grid"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Mobile-only drawer header with a close button (hidden on desktop). */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:hidden">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Menu</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>
      {/* Scrollable but with the scrollbar hidden (still scrolls via wheel/trackpad). */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section, si) => (
          <div key={section.title} className="mb-5">
            {/* Section label — hidden on lg when collapsed; a thin divider stands
                in for it between groups (never above the first group). */}
            <p
              className={`mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              {section.title}
            </p>
            {collapsed && si > 0 ? (
              <div className="mx-auto mb-2 hidden h-px w-7 bg-border lg:block" aria-hidden />
            ) : null}
            {section.items.map((item) => {
              const count = countFor(item.key);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={`relative flex items-center gap-2.5 overflow-hidden rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""
                  } ${
                    item.active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className={`relative ${item.active ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>
                    {item.icon}
                    {/* Collapsed: the count becomes a small dot on the icon. */}
                    {count > 0 ? (
                      <span
                        className={`absolute -right-1 -top-1 hidden size-2 rounded-full ring-2 ring-white ${
                          collapsed ? "lg:block" : ""
                        } ${item.active ? "bg-primary-foreground" : "bg-primary"}`}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  {/* Label — hidden on lg when collapsed (still shown in the mobile drawer). */}
                  <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  {count > 0 ? (
                    <span
                      className={`ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                        collapsed ? "lg:hidden" : ""
                      } ${
                        item.active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export const SidebarNav = withQueryClient(SidebarNavInner);
