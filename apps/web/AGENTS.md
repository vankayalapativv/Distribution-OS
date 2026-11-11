<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web App Conventions (`apps/web`)

## Feature Folder Structure

Each feature lives in `src/features/<name>/` with this layout:

```
src/features/<name>/
  <name>-api.ts        Server-side fetch functions + type definitions
  <name>-list.tsx      "use client" list/table component (main page view)
  <name>-detail.tsx    "use client" detail/single-item view
```

Page files in `src/app/dashboard/<name>/page.tsx` are **server components** that:
1. Call `requireSessionRole()` to get the current user's role
2. Redirect if the role is not allowed
3. Fetch initial data via the `*-api.ts` functions
4. Render the client component with `initialData` + `role` + `actionConfig` props

Always export `dynamic = "force-dynamic"` from dashboard pages (no caching).

## Server vs Client Split

**Server components** (`src/app/**`, `src/features/**/*-api.ts`):
- Fetch data from the API using `getApiAuthHeaders()`
- No `useState`, no `onClick`, no browser APIs
- Pass data down as props to client components

**Client components** (`"use client"` at top):
- Handle all interaction (forms, dialogs, optimistic updates)
- Make API calls via `fetch()` using `actionConfig.authToken`
- Never import from `server-session.ts` or call `cookies()`

The `actionConfig` pattern passes `{ apiBaseUrl, authToken }` from server to client so client components can call the API without touching server-only session utilities.

## Auth Pattern

```typescript
// In any server component / page.tsx:
const auth = await requireSessionRole();   // redirects to /login if not authenticated
const authToken = await requireAuthToken(); // the raw JWT string

// Role check:
if (auth.role !== "SUPER_ADMIN" && auth.role !== "MANAGER") {
  redirect(dashboardForRole(auth.role));
}
```

Two auth paths exist:
- **SUPER_ADMIN**: Neon Auth RS256 JWT (cookie from Neon Auth provider)
- **MANAGER / ACCOUNTANT**: Our own HS256 JWT stored in `beyond_auth` cookie

Both are handled transparently by `requireAuthToken()` / `getApiAuthHeaders()`.

## API Response Shape

All API responses follow:
```typescript
// Success:
{ success: true, data: { ... }, meta: { requestId: string } }

// Failure:
{ success: false, error: { code: string, message: string }, meta: { requestId: string } }
```

In client components, parse errors by reading `err.error.message` from the failure body.

## Dashboard Chrome — shared `<DashboardShell>` (from 2026-07-22)

The dashboard "chrome" (top bar with the BEYOND brand + avatar, and the role-aware
sidebar) lives in **one** place: `src/features/shell/`. Do **not** re-create it per page.

- `src/features/shell/dashboard-shell.tsx` — `<DashboardShell role active? contentClassName?>`
  renders the outer wrapper, top bar, sidebar, and a `<main>` that receives your page
  content as `children`. It's a presentational component (no hooks), so it works in both
  client and server pages.
- `src/features/shell/dashboard-nav.tsx` — the **single source of truth** for the sidebar:
  `buildNavSections(role, activeKey)` plus the `NavKey` union. All three role navs
  (SUPER_ADMIN / MANAGER / ACCOUNTANT) are defined here, once.

Every dashboard page renders:
```tsx
import { DashboardShell } from "@/features/shell/dashboard-shell";
return (
  <DashboardShell role={role} active="customers">
    {/* breadcrumb + page content that used to live inside <main> */}
  </DashboardShell>
);
// If the page has sibling <Dialog>s after the chrome, wrap both in a fragment:
//   <> <DashboardShell …>…</DashboardShell> <Dialog …/> </>
```
- `active` is a `NavKey` (e.g. `"customers"`, `"orders"`); omit it for pages not in the nav
  (Settings, Setup). The shell highlights the matching item with `bg-primary text-primary-foreground`.
- `contentClassName` overrides the `<main>` class (default `flex flex-1 flex-col gap-6 px-8 py-7`);
  a few pages pass `flex-1 px-8 py-7` or an `overflow-y-auto` variant.
- To add/rename/reorder a nav item **or change what a role sees**, edit ONLY
  `dashboard-nav.tsx` — it changes everywhere at once. Never fork the nav back into a page.

Current nav (canonical, in `dashboard-nav.tsx`):
- SUPER_ADMIN — Overview[Dashboard] / Management[Customers, Orders, Products, Invoices, Collections, Alerts, Tasks, Live Tracking, Logistics, Market Intelligence, Reports, Audit Logs] / Configure[Targets, Expenditure, **Users & Teams**, Incentives]
- MANAGER — Overview[Dashboard] / Management[Customers, Orders, Products, Collections, Alerts, Tasks, Live Tracking, Logistics, Market Intelligence, Reports] / Configure[Targets, Expenditure]
- ACCOUNTANT — Overview[Dashboard] / Finance[Customers, Orders, Invoices, Collections, Outstanding, Logistics, Tasks] / Audit[Pending Verification, Reconciliation, Aging, Reports]

(Settings is reached via the avatar, not the sidebar.)

**Users & Teams** (`/dashboard/super-admin/setup`, SUPER_ADMIN only) moved INTO the
sidebar under Configure on 2026-07-24 — it used to be reachable only from a shortcut
card on the Settings page, which has been removed. It manages users (add / edit /
set password), teams and territories. The route path was left unchanged.

## Shared Feature Kit & File Size (from 2026-07-22)

Features are split into small, cohesive files (**strong target ≤100 lines**; a cohesive
dialog/form/hook/column-def may run to ~150–185). Do NOT re-inline the duplicated
machinery — compose these shared pieces instead:

| Need | Import |
|------|--------|
| Client API call | `apiRequest` / `apiGet` / `errorMessage` / `ActionConfig` from `@/lib/api-client` |
| Formatting | `rupees`/`rupeesExact`/`litres`/`formatDate`/… from `@/lib/format` |
| Form field extraction | `nullableFormValue`/`indianPhone`/… from `@/lib/form` |
| Paged table | `usePagedTable` + `<DataTable>` (+ `<PaginationBar>`) from `@/components/data-table/*` |
| Query provider wrapper | `withQueryClient(Inner)` from `@/components/data-table/query-provider` |
| Status pill | `<StatusBadge status tones>` from `@/components/status-badge` |
| Page top | `<PageHeader crumbs title subtitle action>` from `@/components/page-header` |
| Form inputs | `<TextField>` / `<PhoneField>` / `<CodeField>` from `@/components/form/*` |

**Feature layout pattern** (see `features/customers/*`, `features/orders/*` as references):
`<name>-list.tsx` (thin: `usePagedTable` + `DataTable`, wrapped in `withQueryClient`),
`<name>-columns.tsx` (`ColumnDef[]` + skeleton), `<name>-create-dialog.tsx` /
`<name>-*-dialog.tsx` (forms), plus small sub-components for complex dialogs. A right-aligned
column uses `meta: { className: "text-right" }` on its `ColumnDef` (DataTable reads it).
Skeleton cell arrays hold render functions (`Array<() => ReactNode>`) — see the jsx-key note above.

## Route Boundaries & Code Splitting (from 2026-07-22)

- **Route boundaries live under `src/app/dashboard/`**: `error.tsx` (client, with `reset()`)
  catches render throws in any dashboard segment; `not-found.tsx` renders for `notFound()`
  calls (detail pages for missing/forbidden records). Do **not** put JSX inside a
  `try/catch` in a server page — the catch guards the `await` fetch, not render; fetch in
  the `try`, then `return` the JSX after it (`app/dashboard/orders/[id]/page.tsx` is the model).
- **Code-split heavy, non-critical UI** with `next/dynamic` (`ssr: false` + a `loading`
  skeleton). Routes are already split by Next; add manual splits for (a) below-the-fold
  heavy sections (e.g. `AnalyticsTables` on the dashboard) and (b) heavy libs behind
  interaction. The **shadcn `Calendar` (react-day-picker) is only used via `LazyCalendar`**
  (`components/ui/lazy-calendar.tsx`) so date pickers load the library on first open — use
  `LazyCalendar`, not the raw `Calendar`, in new date-filter popovers.
- **Data views use TanStack Query, never `fetch`-in-`useEffect`** (see Data Tables below).
  This also keeps the `react-hooks/set-state-in-effect` lint clean.
- **Don't define components inside another component's render** (remount + focus loss) —
  hoist to module scope and pass props.

## Styling

- Tailwind CSS with shadcn/ui components
- Color tokens: `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `bg-accent`
- Spacing: sidebar is `w-[240px]`, top bar is `h-14`, content padding is `px-8 py-7`
- Monospace text for codes (product codes, customer codes): `font-mono text-xs`

## Neon Date Quirk (critical)

Neon's serverless driver returns PostgreSQL `date` columns as JS `Date` objects, not strings. Any `str()` helper must handle both:

```typescript
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}
```

Forgetting this causes "Invalid Date" in date display.

## Radix Select with UUIDs (critical)

Radix `Select` cannot auto-resolve a UUID `value` to display text. Always pass explicit children to `SelectValue`:

```tsx
<SelectValue placeholder="Select customer">
  {customers.find((c) => c.id === selectedId)?.legalName}
</SelectValue>
```

## Data Tables — REQUIRED stack (from 2026-07-22)

Any **new data table / list view** MUST use this stack. Do not hand-roll `<table>`
markup or `fetch()` loops for tables anymore.

| Layer | Library | Responsibility |
|-------|---------|----------------|
| Visual table | **shadcn/ui** `components/ui/table.tsx` (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`) | Markup + styling only |
| Table logic | **TanStack Table** (`@tanstack/react-table`) | Column definitions (`ColumnDef`), sorting/pagination/selection interaction state (`useReactTable`) |
| Data | **TanStack Query** (`@tanstack/react-query`) | Client-side fetching, caching, refetch, mutations. Wrap the feature in a scoped `QueryClientProvider` (see `features/logistics`) — do NOT server-fetch table data in `page.tsx`; the server component only passes `actionConfig` (`{ apiBaseUrl, authToken }`) |
| API | **Hono** (`apps/api`) | Server-side **filtering, sorting, pagination**, validation, and role authz — never sort/paginate large sets in the browser |
| DB | **Neon Postgres** | Back every list endpoint with **indexed** queries (add indexes in a migration for the columns you filter/sort/paginate on) |

Rules of thumb:
- Client sends `?q=&from=&to=&sort=&dir=&page=&pageSize=`; the Hono endpoint validates
  and returns `{ rows, total }` (or a `nextCursor`). Sorting/paging is the **server's** job.
- Keep column definitions (`ColumnDef[]`) beside the feature; give the query a stable
  `queryKey` that includes every filter/sort/page param so caching invalidates correctly.
- **Page size is 8 rows** — the request fetches **8 rows only** per page (`pageSize: 8`);
  users page through with Prev/Next. Do not fetch large pages and paginate in the browser.
- **Every table MUST have a context-aware loading skeleton** (shadcn `Skeleton`,
  `components/ui/skeleton.tsx`). The skeleton's cell shapes must **mirror the current
  view's columns** — a name+code stack where a name+code cell goes, a pill where a badge
  goes, etc. — not a generic block, and render **exactly `pageSize` (8) skeleton rows**
  while the query has no data (`isLoading`). Keep the column headers visible so it reads
  as the same table loading. On refetch with existing data, keep the rows (don't flash
  skeletons).
  - **Skeleton cell arrays hold render functions, not JSX** — to satisfy `react/jsx-key`,
    declare `const cells: Array<() => React.ReactNode> = [() => <Skeleton … />, …]` and
    invoke them in the map: `{cells.map((c, i) => <TableCell key={i}>{c()}</TableCell>)}`.
    A bare array of JSX elements (`React.ReactNode[]`) trips the lint rule even though the
    `TableCell` is keyed.
- Reference implementation: `src/features/logistics/*` + `apps/api/src/routes/logistics.ts`
  (see `SkeletonRows` and the `pageSize: 8` default).
