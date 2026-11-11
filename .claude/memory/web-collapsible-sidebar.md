---
name: web-collapsible-sidebar
description: "Web dashboard sidebar is collapsible (desktop ≥lg) to a 68px icon rail; toggle on right border; cookie-persisted via root-layout provider; ⚠️ cookie-name const must NOT live in a \"use client\" module. COMMITTED 2026-11-05"
metadata:
  node_type: memory
  type: project
  originSessionId: dca6a78c-d107-4ed8-971e-085a2787a64d
  modified: 2026-11-06T07:40:43.216Z
---

**Collapsible sidebar** on the web `DashboardShell` (desktop `≥lg` only; the `<lg` off-canvas hamburger drawer is unchanged). Collapsed = **~68px icon-only rail**: labels hidden, native `title` tooltips, section headers (OVERVIEW/MANAGEMENT/CONFIGURE) become thin dividers, Alerts/Tasks count badges shrink to a dot. A **circular chevron toggle straddles the right border**, aligned with the OVERVIEW row. The top-bar **brand header is untouched** (it lives in the top bar, not the sidebar). Transition is 200ms ease-out (tried 500ms, reverted).

**Behaviour (final, user-chosen):** the toggle button is the ONLY thing that changes collapsed/expanded. Clicking a nav item just navigates and **keeps the rail as-is** (collapsed stays collapsed). We first shipped "auto-expand on navigate" and reverted it — it read as "won't stay collapsed."

**Architecture / the bug that bit us:** `DashboardShell` (and `SidebarNav`) is rendered **per page, not in the layout**, so it **remounts on every navigation**. State held in its local `useState` reset to the first-load value on each nav (collapse wouldn't stick, cookie/UI drifted). Fix: the collapsed state lives in a **client `SidebarCollapsedProvider` rendered in the ROOT layout** (`app/layout.tsx`), which stays mounted across client navigations; the remounting sidebar just consumes it. Seeded from a `sidebar_collapsed` cookie read server-side in the root layout → correct first paint, no hydration flash (verified: SSR HTML carries `lg:w-[68px]`).

**⚠️ Reusable gotcha:** the cookie-name constant must live in a **plain module, NOT a `"use client"` module**. Importing a const from a `"use client"` file into a **Server Component** (the root layout) hands back a client-reference proxy, not the string — so `cookies().get(SIDEBAR_COLLAPSED_COOKIE)` silently looks up `undefined` while `getAll()` still shows the cookie. Hence `sidebar-cookie.ts` (no directive) holds `SIDEBAR_COLLAPSED_COOKIE`; `sidebar-state.tsx` (`"use client"`) holds the provider/hook.

**⚠️ Expand-flicker gotcha (fixed 2026-11-06, UNCOMMITTED):** the rail **width animates** 68px→240px (200ms) but the labels' `lg:hidden` flips off **instantly** on expand, so the full label text dropped into the still-narrow row and **wrapped to 2 lines then snapped back** → visible flicker every expand. Fix = keep labels one line + clip: `whitespace-nowrap` on the label `<span>` **and** `overflow-hidden` on each nav `<Link>` row, so labels are revealed by the growing edge with no reflow. Don't put `overflow-hidden` on the `<aside>` — the toggle button straddles its right border (`translate-x-1/2`) and would be clipped. Collapsed state, mobile drawer, and the badge dot/pill are unaffected.

**Files:** `apps/web/src/features/shell/sidebar-nav.tsx`, `sidebar-state.tsx`, `sidebar-cookie.ts` (new), `app/layout.tsx`. SonarQube cleaned (useState pair naming S6754 + `useMemo` the context value S6481). **COMMITTED 2026-11-05** (user); web-only, not separately deployed by me. See [[local-dev-uses-live-prod]].
