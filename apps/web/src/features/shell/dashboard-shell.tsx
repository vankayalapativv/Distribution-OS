"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import type { DashboardRole, NavKey } from "./dashboard-nav";
import { ConnectivityBanner } from "./connectivity-banner";
import { SidebarNav } from "./sidebar-nav";
import { SoundNotifier } from "./sound-notifier";

/**
 * Shared dashboard chrome: top bar (brand + avatar) and the role-aware sidebar.
 * Every dashboard page renders its content as the children of this component so
 * the chrome lives in exactly one place. Server pages pass their (server-rendered)
 * content as `children`; this shell only owns the responsive chrome.
 *
 * Responsive: ≥1024px (lg) the sidebar is a static column as before; below that
 * it collapses into an off-canvas drawer toggled by the top-bar hamburger (with
 * a backdrop, a close button, and auto-close on navigation), so the content gets
 * the full width on phones, folds and iPad portrait.
 */

const ROLE_INITIALS: Record<DashboardRole, string> = {
  SUPER_ADMIN: "SA",
  MANAGER: "MG",
  ACCOUNTANT: "AC",
};

/** Where the brand click sends each role — the role-neutral home. */
const ROLE_HOME: Record<DashboardRole, string> = {
  SUPER_ADMIN: "/",
  MANAGER: "/",
  ACCOUNTANT: "/",
};

const DEFAULT_CONTENT_CLASS = "flex flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7";

interface DashboardShellProps {
  readonly role: DashboardRole;
  /** Which sidebar item to highlight. Omit for pages that aren't in the nav (e.g. Settings, Setup). */
  readonly active?: NavKey;
  /** Override the <main> className when a page needs a non-standard content layout. */
  readonly contentClassName?: string;
  readonly children: ReactNode;
}

export function DashboardShell({
  role,
  active,
  contentClassName = DEFAULT_CONTENT_CLASS,
  children,
}: DashboardShellProps) {
  const initials = ROLE_INITIALS[role];
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The drawer closes on link tap (SidebarNav onClose), the close button, and the
  // backdrop; body scroll is locked while it's open.

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-foreground">
      {/* ── Full-width top bar ── */}
      <header className="sticky top-[var(--billing-banner-h,0px)] z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
        <div className="flex items-center gap-1.5">
          {/* Hamburger — only below lg, where the sidebar is a drawer. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="-ml-1 grid size-9 place-items-center rounded-md text-foreground hover:bg-accent lg:hidden"
          >
            <Menu size={20} />
          </button>
          {/* Plain <a>, NOT next/link — clicking the brand does a full-document
              reload to home (fresh app state), a deliberate "hard refresh" the
              user asked for. Do not convert this to <Link> (which soft-navigates). */}
          <a
            href={ROLE_HOME[role]}
            aria-label="Distribution OS — reload dashboard"
            className="flex flex-col leading-none transition-opacity hover:opacity-80"
          >
            <span className="text-base font-extrabold tracking-tight text-primary sm:text-lg">Distribution OS</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Enterprise
            </span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          {/* App-wide audio alerts for new orders / collections (client island). */}
          <SoundNotifier />
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-80"
          >
            {initials}
          </Link>
        </div>
      </header>

      {/* Offline warning (client island) — shows only when the browser is offline. */}
      <ConnectivityBanner />

      {/* ── Body ── */}
      <div className="flex flex-1">
        {/* Backdrop behind the mobile drawer (below lg only). */}
        {drawerOpen ? (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            aria-hidden
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        {/* ── Sidebar (client island: live badges; drawer <lg, static ≥lg) ── */}
        <SidebarNav role={role} active={active} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className={contentClassName}>{children}</main>
        </div>
      </div>
    </div>
  );
}
