# Best Practices — Sri Aparajita Distribution Management System

A living, stack-specific checklist for this repo. Rules are phrased as **DO / DON'T** and tailored to
our actual architecture (Hono on Cloudflare Workers + Neon Postgres, Next.js web, React Native/Expo mobile,
single-client deployment). `✓` = we already do this; `→ audit` = a current gap tracked in
[CODE-AUDIT-2026-07-22.md](./CODE-AUDIT-2026-07-22.md).

> This complements the enforced conventions in the `AGENTS.md` files — those are the rules; this is the
> reasoning + broader guidance. When they conflict, `AGENTS.md` wins.

---

## Cloudflare Workers (`apps/api`)

- **DO** use only Web-standard APIs (`fetch`, `crypto.subtle`, `Request`/`Response`, `URL`, `TextEncoder`). **DON'T** import `node:*`, `Buffer`, or `require`. ✓ (verify `nodejs_compat` is still needed — `→ audit P3`)
- **DON'T** keep request state in module-level mutable variables — isolates are reused across requests. Module-level **immutable** caches (e.g. JWKS keyed by URL) are fine. ✓
- **DO** create the Neon client **per request** (`getSqlClient(c)`); never a shared global connection. ✓
- **DO** `await`, `return`, or `ctx.waitUntil()` every promise — no floating promises. Use `ctx.waitUntil()` for post-response work (reconciliation, alerts, logging). ✓ handlers; `→ audit` move heavy collection-reconcile off the response path
- **MIND the subrequest cap** (50 base / up to 1000). **DON'T** issue one DB round-trip per row in a loop — batch into a single set-based statement. `→ audit P0/P1` (GPS batch, order items, collection allocations)
- **DO** keep secrets in `c.env.*`; never hardcode or log them. ✓
- **DO** keep `compatibility_date` current and observability enabled. ✓
- **DO** cache hot reference reads (settings, catalogue) in the Cache API / KV, purge on write. `→ audit P2`

## Hono (`apps/api`)

- **DO** gate every route with `requireRole(c, [...])` / `requireAuth(c)` — scope to the narrowest role set. Mostly ✓; **DON'T** leave a by-id read on bare `requireAuth` when the list variant is role-scoped. `→ audit P1` (collection detail)
- **DO** validate every input with `requiredString`/`optionalNumber`/enum checks before it reaches SQL. ✓
- **DO** enforce SE data scoping (`assertCustomerVisible`) on **every** customer-touching path, including raw byte streams (photos/files). ✓ except two streams `→ audit P2`
- **DO** register the `/paged` route **before** `/:id`, throw `ApiError` for known cases, let the rest hit `errorHandler`. ✓
- **DO** add per-IP/email throttling on `/auth/login`. `→ audit P2`

## PostgreSQL / NeonDB (`apps/api` + `packages/db`)

- **DO** parameterize all SQL (tagged template or `sql.query(text, params)`); whitelist dynamic `ORDER BY`/columns (`lib/pagination.ts`). Never interpolate user input into SQL text. ✓
- **DO** store money as `numeric`, never float — **and do the arithmetic in SQL `numeric`**, not JS `Number`. ✓ storage; `→ audit P2` JS math in reconcile
- **DO** wrap multi-statement writes that must be all-or-nothing in a transaction. The Neon **HTTP** driver supports `sql.transaction([queries])` for independent statements; use the **Pool/WebSocket** driver or a **stored function** when a later write depends on an earlier read. **DON'T** rely on a sequence of independent `await`s for financial writes. `→ audit P1` (collection reconcile, order+items)
- **DO** `Promise.all` independent **reads** in a handler — endpoint latency is dominated by the **~50ms Neon HTTP round-trip paid once per query**, NOT execution (every query here runs sub-millisecond; indexes are already in place). Serial `await sql`…`await sql` costs ~50ms × N; batching collapses it to ~1 round-trip. **MIND** Neon query promises are **lazy** (they only run when awaited) — an "eager" `const p = sql`…`` left unawaited does NOT run concurrently; the independent reads must share one `Promise.all([...])`. The count+rows pattern on every paged list is the canonical case. ✓ (2026-10-29: dashboard/metrics 338→60ms, targets 205→105ms, setup 154→52ms)
- **DO** make idempotent writes race-safe with `INSERT … ON CONFLICT` (not check-then-insert). `→ audit P2`; GPS ingest is the reference ✓
- **DO** generate human codes (`ORD-####`) from a Postgres **sequence**, not `max()+1`. `→ audit P2`
- **DO** back every filtered/sorted/paginated column with an index; for `ILIKE '%x%'` search use a `pg_trgm` GIN index (btree can't serve a leading wildcard). `→ audit P2/P3`
- **DO** remember the **Neon Date quirk**: `date` columns come back as JS `Date` — every mapper checks `v instanceof Date`. ✓
- **DO** keep migrations idempotent and ordered; wrap destructive migrations in `begin/commit` and guard data-deletes; mark applied migrations immutable. `→ audit P2` (0007)
- **DON'T** reintroduce `organization_id` — the multi-tenant scaffolding was removed in migrations `0034`/`0035`; single-client deployment. ✓
- **MIND** Neon scale-to-zero cold starts; keep the auth/user lookup cheap and cached. `→ audit P1`

## Neon Auth / JWT (`apps/api`)

- **DO** pin the algorithm on each verify path (RS256 for Neon Auth via JWKS, HS256 for our cookie) so RS256→HS256 downgrade is impossible. ✓
- **DO** require `exp` (and check `iss`/`aud`/`nbf`) on **both** paths — don't accept a token that lacks `exp`. RS256 ✓; HS256 `→ audit P3`
- **DO** add a TTL / `kid`-miss refetch to the JWKS cache so provider key rotation is picked up. `→ audit P3`
- **DO** return an identical generic error for "bad password" and "no such user" (no enumeration). `→ audit P3`
- **DO** hash passwords with PBKDF2/scrypt + random salt and compare in constant time. ✓ (constant-time `→ audit P3`)

## React / Next.js (`apps/web`)

> This is a heavily-updated Next.js — read `node_modules/next/dist/docs/` before using an API you're unsure of. React Compiler + `react-hooks` lint are on.

- **DO** keep data fetching in **server components** (`*-api.ts` + `getApiAuthHeaders`); pass `actionConfig` down to client components. **DON'T** import server-only code (`server-session`, `cookies()`) into a `"use client"` file. ✓
- **DO** use the mandated table stack (shadcn + TanStack Table + **TanStack Query** + Hono + indexed Neon) for every list view. **DON'T** `fetch`-in-`useEffect` for data — use `useQuery` (with `initialData`, `refetchInterval` for polling). ✓ (5 list views + the dashboard trio migrated 2026-07-22)
- **DON'T** call `setState` synchronously inside an effect; derive during render, `useMemo`, or set in an event handler. (Post-`await` setState is OK but still prefer `useQuery`.) ✓ (0 `set-state-in-effect` lint)
- **DON'T** define components inside another component's render — hoist to module scope and pass props. ✓ (`SortTh` hoisted)
- **DON'T** put JSX inside a `try/catch` — the catch won't cover render. Fetch in the `try`, return JSX after. ✓
- **DO** add route boundaries under `app/dashboard/`: `error.tsx` (client, with `reset()`) + `not-found.tsx`. ✓ (a `loading.tsx` is deferred until the shell moves into a `dashboard/layout.tsx`, else it flashes the chrome on every nav)
- **DO** code-split heavy/non-critical UI with `next/dynamic` (`ssr: false` + `loading` skeleton): below-the-fold sections (`AnalyticsTables`) and heavy libs behind interaction (`LazyCalendar` wraps react-day-picker). ✓
- **DO** give every list item a stable `key`; skeleton cell arrays hold **render functions**, not bare JSX (satisfies `react/jsx-key`). ✓
- **DO** share chrome via `<DashboardShell>` + the single `dashboard-nav.tsx`; never re-create the sidebar per page. ✓
- **DO** `Promise.all` independent server fetches; keep `export const dynamic = "force-dynamic"` on dashboard pages. ✓
- **DO** keep heavy, interaction-only code OUT of a route's initial bundle — load chart libs (recharts), framer-motion animations, the Leaflet/maplibre map, and pdf/xlsx export via `next/dynamic` / dynamic `import()`, so framer et al. ship only when the feature is actually used. ✓ (2026-10-30: drill-down dialogs lazy-loaded + the dashboard map's framer cross-fade replaced with a CSS keyframe → framer-motion gone from the dashboard's initial load). **Split a lazy component's hook into its own file** so importing the hook doesn't statically pull the heavy dialog back in. To latch "mount once opened", set state **during render** (`if (open && !mounted) setMounted(true)`) — the React-compiler lint forbids both setState-in-effect and reading a ref during render.
- **DO** basic a11y: real `<button>` for click targets (keyboard + `aria-label`), `alt` on images, escape literal quotes in JSX. ✓ (segment-row keyboard toggle + curly quotes fixed 2026-07-22)
- **MIND** when verifying console errors in the in-app (MCP) browser: its console buffer does **not** clear on navigation, so an old error looks like it recurs on every page. Check whether a page truly throws by loading it in a **fresh tab** (empty buffer) and reading that tab's console. (2026-10-30: phantom hydration `#441`/`#418` chased this way turned out to be stale — the live app hydrates clean.)

## React Native / Expo (`apps/mobile`)

- **DO** install with **pnpm only** — never `npm`/`yarn` in this workspace. Keep `android/` gitignored (EAS regenerates from config plugins). ✓
- **DO** store the auth token in `expo-secure-store` (Keychain/Keystore), never AsyncStorage; send it as a Bearer header, never in a URL. ✓
- **DO** set a real API URL per EAS profile (**incl. `production`**) over https; fail fast if it resolves to localhost in a release build. `→ audit P2`
- **DO** handle `401` globally → route to login / refresh; **DON'T** classify 401 as a retryable sync error (it stalls the outbox forever). `→ audit P2`
- **DO** carry a `clientUuid` on every offline write and dedupe server-side with `ON CONFLICT`; preserve FIFO causal ordering; cascade a permanently-failed parent's dependents to `failed`. ✓ (cascade `→ audit P3`)
- **DO** render long lists with `FlatList`/`FlashList` + `keyExtractor` + a memoized row + stable `renderItem`; **DON'T** `.map` big arrays in a `ScrollView`. Mostly ✓; `→ audit P3` (customer search, catalogue rows)
- **DO** clean up every subscription/timer/watcher in effects; guard module-load side effects against Fast-Refresh double-registration. ✓ (watchdog guard `→ audit P3`)
- **DO** set a real reverse-domain package id before first publish; request the **minimum** permissions (drop `USE_EXACT_ALARM`, keep `SCHEDULE_EXACT_ALARM` + inexact fallback). `→ audit P2`
- **DO** keep background GPS correct: foreground service with `FOREGROUND_SERVICE_TYPE_LOCATION`, `setExactAndAllowWhileIdle` wake-up (not a `Handler`), graceful inexact fallback, boot-restart + watchdog. ✓
- **DO** honor the offline-first rule: cache everything, always show skeleton/offline/empty states — never a bare "Couldn't load". ✓

---

## How to use this doc
- Before building a feature in an area, skim its section.
- When you fix an audit item, flip its `→ audit` marker to `✓` here and check it off in the audit doc.
- New recurring lessons go here (the *why*); hard rules that must never break go in the relevant `AGENTS.md`.
