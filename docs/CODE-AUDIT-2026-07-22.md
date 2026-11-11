# Code Audit — Sri Aparajita Distribution Management System

**Date:** 2026-07-22   **Scope:** `apps/web` (Next.js/React), `apps/api` (Hono/Workers/Neon), `apps/mobile` (React Native/Expo), `packages/db`
**Dimensions:** Security & auth · Data integrity · Frontend correctness · Performance & cost
**Status:** Findings only — **no code was changed**. Work items are ranked; tackle P0/P1 first.

Severity: **P0** = fails or corrupts under real use · **P1** = high impact / latent corruption · **P2** = should fix · **P3** = polish.

---

## P0 — Fix first

### [P0][perf/data] GPS batch insert is a per-point round-trip loop
`apps/api/src/services/visits.ts:281-301`, `apps/api/src/services/tracking-sessions.ts:244-293`
`/visits/gps/batch` and the tracking-session ingest loop do **one `await sql\`insert\`` per point**. Each is a separate Neon HTTP subrequest. A phone offline for an hour flushes a backlog **over the Workers subrequest cap (50 on base plan)** → the request throws partway and the queue never drains. This is the highest-frequency write path in the system.
**Fix:** one multi-row INSERT via array `unnest`, e.g. `insert into gps_points (…) select * from unnest(${lats}::float8[], …) on conflict (user_id, recorded_at) do nothing`. Pattern already used well in `market-intelligence.ts:151-171`.

---

## P1 — High

### [P1][data/perf] Collection verify + reconcile is non-atomic **and** N+1
`apps/api/src/services/collections.ts:448-662` (`verifyCollection` → `reconcileCollection` → `applyHeldCreditToOpenInvoices`)
There are **no transactions anywhere** in the service layer. `verifyCollection` sets `status='verified'` (commits), then applies allocations to invoices across many independent `await`s. If any later step fails, the collection is already verified but invoices are only partially updated — and the retry guard `and accountant_approval_status='pending'` returns no row, so reconcile **never re-runs**. Result: a permanent mismatch between verified money and invoice `outstanding_amount` (which the mobile credit gate reads). Also N+1 (2 round-trips per invoice), so it can approach the subrequest cap for a heavy customer.
**Fix:** make it atomic + idempotent — either a Postgres stored function called in one round-trip, or the Neon `Pool`/WebSocket driver with `BEGIN…COMMIT`, or drive reconcile off a separate `reconciled_at is null` flag so a retry re-attempts. Batch the allocation inserts + collapse per-invoice updates into one set-based `UPDATE … FROM (VALUES …)`.

### [P1][data/perf] Order + order_items insert is non-atomic and N+1
`apps/api/src/services/orders.ts:547-640`
Header inserted, then each line item in its own `await`. A mid-loop failure leaves an `approved` order with a partial item set, and `total_litres` was stored on the header before items persisted. 20-line order = 20+ sequential round-trips.
**Fix:** insert header + all items atomically (Neon `sql.transaction([...])` accepts an array of tagged-template queries) with multi-row INSERTs.

### [P1][security] Collection-detail endpoint has no SE scoping (IDOR)
`apps/api/src/routes/collections.ts:79-84`, `services/collections.ts` `getCollectionById`
`GET /collections/:id` only calls `requireAuth` (any role incl. SALES_EXECUTIVE) and the service ignores its context — no `assertCustomerVisible`, no `collected_by` check. Any authenticated user who guesses a collection UUID reads another SE's collection (customer, amount, bank/cheque details). Contradicts the scoping enforced on the list endpoint directly above it.
**Fix:** pass `{userId, role}` into `getCollectionById`; for SALES_EXECUTIVE restrict to `collected_by_user_id = userId` (or visible customer); 404 otherwise.

### [P1][perf] Auth middleware runs an uncached DB lookup on every request
`apps/api/src/middleware/auth.ts:39-132` (wired `app.use("*")`)
Every bearer request spins a fresh `neon()` and runs `users ⨝ user_roles ⨝ roles` **before** the handler. The dashboard fires ~5 parallel calls per load, each re-resolving the same user.
**Fix:** cache resolved `{userId, role}` by token subject in Cache API / short-TTL KV (~60s), fall through on miss.

### [P1][frontend] No route error / not-found / loading boundaries — ✅ RESOLVED 2026-07-22
`apps/web/src/app/**` — zero `error.tsx`, `not-found.tsx`, `loading.tsx`, `global-error.tsx`.
Detail pages call `notFound()` but fall back to Next's bare default; a throw during a client component's render has no boundary to land in and shows the framework error screen.
**Fixed:** added `app/dashboard/error.tsx` (client, `reset()`) + `not-found.tsx`. `loading.tsx` intentionally deferred (would flash the per-page chrome on every nav until the shell moves into a `dashboard/layout.tsx`).

---

## P2 — Should fix

### Security
- **[P2] Photo-stream IDOR** — `routes/photos.ts:62-78`, `services/photos.ts:110-131` `getPhotoStream` reads bytes by `photoId` with no customer scoping (upload/list/delete all scope; this doesn't). Mirror `deletePhoto`'s creator check.
- **[P2] Delivery-photo stream unscoped** — `services/logistics.ts:297-317` same shape, smaller blast radius.
- **[P2] No login rate limiting** — `routes/auth.ts:22`; add per-email/IP throttle (Cloudflare Rate Limiting rule or KV/DO counter) + optional lockout.

### Data integrity
- **[P2] Idempotency check-then-insert races** — `collections.ts:314-345`, `orders.ts:388-445`, `visits.ts:53-93`: `SELECT` then `INSERT` with no `ON CONFLICT`; concurrent offline replays both pass the SELECT, second hits the unique index → 500 instead of `existing:true`. GPS ingest (`visits.ts:299`) does it right — copy that.
- **[P2] Sequence-code generation is race-prone** — `orders.ts:538-545`, `collections.ts:364-372`: `max(substring)+1` with no lock → duplicate `ORD-####` → unique violation 500. Use a Postgres sequence or catch-and-retry.
- **[P2] Float money math in reconciliation** — `collections.ts:559-581,642-661`: amounts pulled into JS `Number`, repeated subtraction can drift sub-cent and misclassify `paid`. Do the math in SQL `numeric`, or integer paise, round to 2dp before comparisons. (Storage is correctly `numeric(14,2)`.)
- **[P2] Tracking daily query can't use an index** — `tracking.ts:171-173,289-292`: filter `(recorded_at at time zone 'Asia/Kolkata')::date = …` has no expression index and no `user_id` predicate; `/dashboard/tracking` polls it every 60s → growing full scan. Add an expression index or a stored IST `recorded_on` date column + btree.
- **[P2] Leading-wildcard search can't use btree** — `customers.ts:284`, `orders.ts:276`, `collections.ts:224`, `bearings.ts:86`, `logistics.ts:69`: `ILIKE '%x%'` seq-scans despite the 0028-0031 btree indexes (those help sort only). Add `pg_trgm` GIN indexes if search latency matters, or document btree = sort-only.
- **[P2] Destructive migration `0007` is unguarded + non-transactional** — `0007_simplify_products.sql:4-5,29` unconditional `delete from …` + drops, no `begin/commit`. Already applied; mark immutable in the ledger and guard future destructive migrations.

### Performance
- **[P2] Cacheable reference GETs re-query every call** — `system_settings['credit_overdue_days']` read on every customer-detail (`customers.ts:340`); products/bearings catalogue re-queried each load. Cache in KV/Cache API, purge on write.
- **[P2] `/tracking/route` returns up to 2000 points every 60s** — `tracking.ts:296`, polled by `tracking-view.tsx:261`. Return delta (points newer than last-seen) or decimate the polyline.
- **[P2] Dashboard correlated EXISTS/LATERAL need composite indexes** — `dashboard-metrics.ts:91-116,184-254`, `dashboard-analytics.ts:225-270`. Confirm/add: `visits(executive_id, visit_date)`, `orders(customer_id, sales_executive_id, order_date)`, `collections(customer_id, collected_by_user_id, collection_date)`, `customer_photos(customer_id, uploaded_by, category, created_at)`, `gps_points(session_id, recorded_at)`.

### Frontend — ✅ ALL RESOLVED 2026-07-22
- **[P2] JSX inside try/catch** — ✅ `orders/[id]/page.tsx` split into fetch-in-`try` + render after. (`customers/[id]`, `collections/[id]` already correct.)
- **[P2] Component defined during render** — ✅ `SortTh` hoisted to module scope in `analytics-tables.tsx`, `sort`/`onSort` passed as props (8 `static-components` errors cleared).
- **[P2] Dashboard trio fetches in `useEffect`** — ✅ `analytics-tables.tsx`, `metrics-dashboard.tsx`, `tracking-view.tsx` migrated to `useQuery` (scoped `QueryClientProvider` per tree, `initialData` seeds first paint, `refetchInterval` for the 60s polling, derived selection/`lastUpdated` instead of effects). All 4 `set-state-in-effect` errors and the redundant on-mount refetch gone.
- **Also fixed:** all 8 `react/jsx-key` errors (skeleton render-function pattern), all 8 `no-unescaped-entities` (curly quotes), segment-row keyboard a11y, and 3 dead-var warnings. **`apps/web` now lints with 0 errors.**
- **Code splitting added:** `AnalyticsTables` (below-fold) and `LazyCalendar` (react-day-picker) via `next/dynamic`.

### Mobile (release-readiness)
- **[P2] `production` EAS profile has no API URL** — `eas.json:19-21`; `src/lib/api.ts:8-9` then defaults to `http://localhost` → a production build ships non-functional over cleartext. Add `env.EXPO_PUBLIC_API_URL` (https); throw at startup if it resolves to localhost in release.
- **[P2] Expired token → silent infinite retry, no re-login** — `sync-core.ts:55-61` treats 401 as retryable and there's no global 401→logout. Once the SE token expires, the queue never drains and they're never prompted. Route to login on 401 (or refresh).
- **[P2] Placeholder Android package id `com.anonymous.mobile`** — `app.json:31`; immutable after first publish. Set a real id (e.g. `in.vardhansystems.beyond`) before any Play upload.
- **[P2] `USE_EXACT_ALARM` is Play-policy restricted** — `app.json:27-29`; Google restricts it to alarm/clock apps. The native code already falls back to `setAndAllowWhileIdle`, so drop `USE_EXACT_ALARM`, keep user-grantable `SCHEDULE_EXACT_ALARM`.

---

## P3 — Polish

- **[P3][security]** HS256 accepts a token with no `exp` (`jwt-issue.ts:84`); require `typeof exp === 'number'`. · Login message enables user enumeration (`auth.ts:58-64`). · Non-constant-time hash compare (`password.ts:50`). · `.dev.vars` not in `.gitignore`.
- **[P3][data]** Missing sort indexes for whitelisted sortable cols (customers `customer_code/customer_type`, orders `order_code/total_litres`, collections `collection_code/collection_amount`) — add only where the table is large. · `getOrderById` missing `::uuid` cast (`orders.ts:334`) → 500 instead of 404. · Single-invoice mobile allocation can over-allocate (`collections.ts:431-443`) — cap at outstanding.
- **[P3][perf]** `nodejs_compat` flag looks unused in `wrangler.jsonc` (no `node:`/`Buffer`/`require`) — verify with `--dry-run` and drop. · R2 `<img>` without `loading="lazy"`/dimensions (`market-intelligence-view.tsx:142`, `logistics-list.tsx:119`). · `jwksCache` never expires (`jwt-auth.ts:35`) — safe, but add a TTL/`kid`-miss refetch for key rotation.
- **[P3][frontend]** ✅ RESOLVED — unescaped quotes replaced with curly quotes; analytics segment row now keyboard-operable (`role=button` + `tabIndex` + `onKeyDown`).
- **[P3][mobile]** Permanently-failed causal parent orphans children in a retry loop (`sync-core.ts:648-681` + `sync.ts:165-232`) — cascade dependents to `failed`. · Customer search list non-virtualized (`customers.tsx:107-139`) — use `FlatList`. · Inline `renderItem` + unmemoized rows in the 1,829-row catalogue (`order/new.tsx:708-759`). · GPS watchdog can double-register on Fast Refresh (`gps.ts:278-295`) — add an `installed` guard.

---

## What's already solid

- **Auth crypto:** RS256/HS256 algorithms are pinned (no downgrade-confusion), RS256 verifies signature + iss/aud/exp/nbf, PBKDF2-SHA256 100k iterations with random salt, secrets only from `c.env.*`, no secret logging.
- **SQL safety:** everything parameterized; dynamic sort/filter via a **whitelist** (`lib/pagination.ts`) with clamped direction and `limit ≤ 100`.
- **SE scoping** is consistent everywhere except the two streaming reads called out above.
- **Neon Date quirk** handled in every mapper (`v instanceof Date`). **Money stored `numeric(14,2)`** (no float columns). **FK deletes** caught → 409.
- **Workers hygiene:** `neon()` per-request (no global connection), `scheduled()` bounded + `ctx.waitUntil()`, no floating promises, current `compatibility_date`, CORS locked to an allowlist.
- **Paged table endpoints** are textbook (server-side filter+count+limit/offset, whitelisted sort, pageSize 8).
- **Web:** TanStack Query setup is textbook in the 5 list views; clean server/client boundary; skeleton render-function convention followed; `tsc` fully clean.
- **Mobile** is genuinely mature: `expo-secure-store` tokens, `clientUuid` idempotency + `insert or ignore` (exactly-once on replay), FIFO causal sync ordering, idempotent local migrations, correct foreground-service + `setExactAndAllowWhileIdle` background GPS with graceful fallback, pnpm-only integrity, arm64 ABI pinning, real error/empty/offline states.

---

## Suggested order of attack
1. **P0 GPS batch** + **P1 order/collection atomicity** — same `unnest`/transaction technique, highest correctness leverage on live-trial data.
2. **P1 collection-detail IDOR** + **P2 photo IDOR** + **login rate-limit** — close the scoping gaps.
3. **P1 auth-middleware cache** + **P1 route boundaries** — latency + resilience.
4. **P2** data indexes (tracking date, trigram search, dashboard composites) and the frontend `useQuery` migration.
5. **Mobile P2** release-readiness before any production/Play build.
6. **P3** polish.

See [BEST-PRACTICES.md](./BEST-PRACTICES.md) for the forward-looking per-technology checklist these findings map to.
