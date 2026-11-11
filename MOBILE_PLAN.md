# Sri Aparajita Distribution — Mobile App Plan (Sales Executive)

**Created:** 2026-07-09 (restored to original scope) · **Owner:** Vishnu (solo, with Claude)
**Platform:** React Native + Expo · **Roles:** SALES_EXECUTIVE (LOGISTICS later, own plan)

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | React Native + Expo SDK (latest) | Managed workflow |
| Repo | **`apps/mobile` in this monorepo, pnpm ONLY** (decided 2026-07-09) | The old build died from **npm-inside-pnpm** package duplication — the fix is a single package manager, not a separate repo. Never run `npm install` in this workspace. Share types/API contracts/business rules via `packages/shared`; web UI components are not reusable in RN regardless of repo layout |
| Navigation | Expo Router | File-based routing, same mental model as Next.js web app |
| UI / Styling | NativeWind (Tailwind classes) | Consistent with web codebase |
| UI components | **react-native-reusables** | shadcn-style components for RN (shadcn/ui itself is web-only); CLI-installed, copied into repo, styled with NativeWind |
| Server state | TanStack Query | Caching, background refetch, same library as web |
| Client state | Zustand | Auth token, offline queue status, current visit state |
| Offline storage | expo-sqlite | Local DB for offline queue (orders, collections, visits, GPS pings) |
| Forms | React Hook Form | Consistent with web, lightweight |
| GPS / Location | expo-location + expo-task-manager | Foreground + continuous background tracking |
| Token storage | expo-secure-store | Encrypted keychain/keystore — non-negotiable for JWTs |
| Build / CI | EAS Build — **dev build from day 1** | Background GPS does not work in Expo Go |

> **Future:** migrate offline storage to WatermelonDB if sync complexity grows.

## Lessons from the removed build (2026-07-09)

1. Never mix package managers — the app lives at `apps/mobile` inside the pnpm workspace and is installed with **pnpm only** (Expo's monorepo support + Metro configured for the workspace; consider `node-linker=hoisted` in `.npmrc` if Metro struggles with symlinked modules).
2. Prove the toolchain first: Phase 1 gates on a **styled screen in an EAS dev build on a real device** before any feature work.
3. Version-pin; no `node_modules` stubs, no custom Metro transformers. If NativeWind misbehaves in the clean repo, fall back to plain StyleSheet immediately rather than patching Metro.

---

## Business Rules

1. **Check-in is mandatory** — SE must check in at a customer before taking an order or recording a collection.
2. **Beat list is pre-assigned** — SE sees only their assigned customers for the day.
3. **Credit block on orders** — any invoice overdue > 60 days hard-blocks order creation with a clear message.
4. **Visit actions are independent** — a visit may include an order, a collection, both, or neither.
5. **Partial collections supported** — free-entry amount against a selected invoice.
6. **Offline-first** — all actions (check-in, orders, collections, GPS pings) stored locally, synced on reconnect.
7. **GPS runs all day** — continuous background tracking every 5 minutes from Start Day to End Day/logout.

## Sync Policy

- Client-generated UUIDs on all writes → idempotent retries, no duplicates.
- Conflicts: **last-write-wins for collections; server-authoritative for orders.**
- Retry with exponential backoff; failed items surfaced in Settings with manual retry.

---

## Screens (FINAL) — 3 tabs: Home · Customers · Settings

### Auth
| # | Screen | Notes |
|---|--------|-------|
| S1 | Splash / auth gate | Token check → Login or Home |
| S2 | Login | Email + password; SE role guard; errors surfaced clearly |

### Home tab (Dashboard)
| # | Screen | Notes |
|---|--------|-------|
| S3 | Home / Dashboard | **Start Day / End Day button** (work session + GPS on/off), day-summary card (visits done/total, orders taken, ₹ collected), **alerts strip** (rejected collections, overdue customers on today's route), today's beat list with status badges (pending / checked-in / done), **today's activity list** (orders & collections recorded today with sync status), offline banner |
| S4 | Stop detail / visit | Customer card (tap-to-call, address, outstanding); **check-in (mandatory gate)** with GPS fix; actions → New Order / Record Collection; visit notes; check-out |
| S5 | Order creation | Product list (cached) → quantities → review; credit-block check (>60d overdue → hard block) |
| S6 | Order confirmation | Order code, items summary, sync status |
| S7 | Record collection | Outstanding invoices for the customer → select invoice → amount (partial OK) → mode (cash/cheque) |
| S8 | Collection confirmation | Reference number, sync status |

### Customers tab
| # | Screen | Notes |
|---|--------|-------|
| S9 | Customer list | Assigned customers, search; outstanding shown per customer |
| S10 | Customer detail | Info + contacts, outstanding invoices, order history, collection history (with verified/rejected status), visit history |

### Settings tab
| # | Screen | Notes |
|---|--------|-------|
| S11 | Settings | Profile info, logout, sync queue status (pending items, errors, manual retry, last-synced), GPS & permission health with fix-it links, app version |

**Cross-cutting components (not screens):** offline banner, sync-state chips, loading skeletons, empty states, error states.

**Total: 11 screens.**

---

## Phase-by-Phase Plan

### Phase 1 — Foundation
**Goal:** EAS dev build on device with a styled screen; SE logs in and sees today's beat.

- [x] `apps/mobile` init in this monorepo (2026-07-09): Expo SDK 57 + TypeScript, Expo Router, NativeWind 4 (tailwindcss pinned 3.4.18), expo-secure-store, expo-sqlite, TanStack Query, Zustand — pnpm only. Metro bundles clean (`expo export` verified); the one pnpm-strictness fix was adding `react-native-css-interop` as a direct dependency (NativeWind's JSX runtime) — no hoisting, no Metro hacks. react-native-reusables to be added when the first shared component is needed
- [ ] **Toolchain gate:** styled hello screen verified in an EAS dev build on a physical Android device before proceeding (local bundling verified; device build needs the Expo account)
- [x] Login screen (S1, S2) → `POST /auth/login` → JWT in secure store; SALES_EXECUTIVE role guard (`src/app/login.tsx`, `src/lib/auth.ts`)
- [x] SQLite schema (2026-07-09): `customers`, `beat_stops`, `visits`, `orders`, `order_items`, `collections`, `gps_pings`, `sync_queue` — `src/lib/local-db.ts`, versioned via `pragma user_version`. Pure module (no RN imports), unit-tested in vitest against Node's built-in `node:sqlite`; expo-sqlite adapts to the same `LocalDb` interface at runtime (`src/lib/db.ts`)
- [x] Sync engine (2026-07-09): `src/lib/sync-core.ts` (pure, 20 unit tests) + `src/lib/sync.ts` (runtime). FIFO flush — retryable failures (network/5xx/401/429) back off exponentially (5s→5min cap) and STOP the flush to preserve causal order (check-in before its order); permanent 4xx failures park as `failed` for manual retry and let later items continue. GPS pings batch to `/visits/gps/batch` separately. Flush triggers: network restore (expo-network listener), app foreground, engine start, and `kickSync()` after each write. Sync status (pending/failed/syncing) surfaced on Home with a Retry action
- [x] Home with today's beat list from `GET /beats/today` (S3, list only; `src/app/index.tsx`) — network-first with SQLite fallback + "Offline — showing your last synced beat" banner. Fixed a real API bug found on the way: beats service selected nonexistent `customers.contact_phone`/`address_line1` (now `phone`/`address_street`)

### Phase 2 — Check-in + GPS
**Goal:** SE checks in at a customer; GPS tracks all day. **DONE 2026-07-09** — verified end-to-end on the Pixel 8 emulator (check-in/check-out synced to Neon with client UUIDs; GPS point recorded server-side).

- [x] Start Day / End Day on Home: starts/stops GPS tracking (`src/lib/gps.ts`); the server auto-creates the GPS session on first batch upload
- [x] Stop detail (S4, `src/app/stop/[stopId].tsx`): mandatory GPS check-in → local `visits` + sync queue; permission denial → explain + settings deep-link
- [x] GPS via expo-task-manager: point every 5 min → `gps_pings`, batch-synced to `/visits/gps/batch`. In Expo Go, background tasks are unavailable (Android) so it falls back to a foreground watcher — the EAS dev build gets true background tracking + foreground-service notification (config in `app.json`)
- [x] Foreground-service notification config + permission UX (deny → explain → settings deep-link)
- [x] Visit status flow `pending → checked_in → completed`, with local-over-server status overlay so offline check-ins/outs never regress when the server cache refreshes (`src/lib/beat-cache.ts`)

**Expo Go dev caveat (2026-07-09):** fast refresh/deep-link reloads served stale bundles several times during verification — when a code change doesn't appear, reload via the in-app dev menu (keyevent 82 → Reload), not the exp:// deep link.

### Phase 3 — Orders
**Goal:** SE creates an order inside a checked-in visit. **DONE 2026-07-09** — verified end-to-end on the Pixel 8 emulator (blocked path + happy path; ORD-0005 synced to Neon with client UUID, salesExecutiveId forced to self, item snapshot correct).

- [x] Order creation (S5, `src/app/order/new.tsx`): searchable product list (cached in SQLite, offline fallback) → qty stepper + pack-size litres + segment chips → sticky submit with live litre total
- [x] Credit gate: `GET /customers/:id/invoices` cached per customer (`src/lib/order-cache.ts`); hard-block screen shows threshold + outstanding. Gate query uses `staleTime: 0` — it must re-check on every order attempt. Offline with no cache → warning banner, server stays authoritative
- [x] Offline queue with client UUIDs (existing sync engine); order confirmation (S6) shows the server order code when the sync completes in-flow, else "will sync automatically"
- [x] Order history per customer (S10 partial): "Recent orders" on the stop screen from local SQLite with Synced/Pending chips; local schema bumped to v2 (products + customer_credit caches)

Found & fixed during verification: `invoices.net_invoice_value` → the real column is `invoice_net_value` (the API's mocked tests can't catch column names); stop screen now refreshes local state via `useFocusEffect` when returning from order creation.

### Phase 4 — Collections
**Goal:** SE records a payment during a visit. **Core flow DONE 2026-07-09** — verified on the Pixel 8 emulator: COLL-0002 (₹5,000 partial, cash, allocated to a specific invoice) synced to Neon with `collection_allocations` row, pending accountant verification.

- [x] Outstanding invoices per customer, cached (S7): `customer_invoices` table (local schema v3), network-first with offline fallback, most-overdue first
- [x] Record collection (`src/app/collection/new.tsx`): invoice picker (or general payment) → amount prefilled from outstanding, partial OK → cash/cheque/UPI/NEFT chips, reference required for non-cash → submit; confirmation (S8) with server code + "pending accountant verification"
- [x] Offline queue with client UUIDs (existing engine); "Recent collections" with Synced/Pending chips on the stop screen. **API addition (TDD):** `POST /collections` now accepts optional `invoiceId` → validates it belongs to the customer (422 otherwise) and writes a `collection_allocations` row; invoice outstanding is NOT touched at capture — reconciliation stays with accountant verification per COLLECTION-RULES.md
- [ ] Verified/rejected status pulled into customer detail + Home activity list — moved to Phase 5 (needs the server-status delta pull that Phase 5's sync polish adds)
- [ ] Customers tab complete: list (S9) + detail (S10 full) — moved to Phase 5 (tab navigation restructure)

### Phase 5 — Sync, Polish & Build
**Goal:** Reliable sync, production-quality UX, testable APK. **DONE 2026-07-09 except the EAS build** (needs Vishnu's Expo account).

- [x] Conflict policy: server-authoritative orders (idempotent clientUuid replays), LWW collection statuses — accountant verified/rejected verdicts pulled after every flush and overwrite local state (`applyServerCollectionStatuses`); exponential backoff retries (Phase 1 engine)
- [x] 3-tab navigation (`(tabs)/`): Home · Customers · Settings. Settings (S11): profile, sync-queue inspector (pending count, failed items with error text, Retry all, Sync now, last-synced). Customers tab: S9 list (cached, searchable) + S10 detail (outstanding invoices, collections with verified/rejected chips, order history). Day summary card on Home (visits / orders·litres / ₹ collected from local SQLite). Alerts strip NOT built — `GET /alerts` is SUPER_ADMIN/MANAGER-only; needs an SE-scoped alerts endpoint first (API gap)
- [x] Offline banners on Home/collection/customers, empty states, sync chips (Pending/Synced/verified/rejected) throughout
- [x] Chaos test on emulator: API killed → collection recorded offline ("saved on device" confirmation, amber Pending chip, "1 item waiting" in Settings) → API restored → Sync now double-tapped → exactly ONE COLL-0003 in Neon (in-flight guard + server idempotency). Migration hardened along the way: `migrateLocalDb` no longer early-returns on user_version — every step is idempotent, so partially-applied states (dev fast-refresh stamping the version early) self-heal
- [ ] EAS internal APK + OEM battery-saver check — blocked on Expo account: `cd apps/mobile && npx eas build --profile development --platform android`

---

## UI restructure (2026-07-09, post-Phase-5)

Per Vishnu's review of the working app:

- **Home = field dashboard**: Start/End Day, day-summary tiles, today's activity feed (orders + collections with sync/accountant-status chips). Log out removed from the header — a tappable sync-status chip sits there instead; Log out lives only in Settings.
- **Customers tab hosts the beat**: "Today's beat" section on top (tap a stop → visit screen), full searchable directory below, "+ Add" button in the header.
- **Add customer** (`src/app/customer/new.tsx`): all web-form fields + one-tap geo-location capture; SALES_EXECUTIVE now allowed on `POST /customers` (active immediately, per decision); `latitude`/`longitude` persisted. Photos deferred until the R2 upload endpoint exists.
- **Visit screen title**: customer name + "Stop N of M · today's beat" (was "Stop N").
- **Customers = search-first** (2026-07-10, emulator-verified): no directory listed by default — pill search bar (live as-you-type over the server-fetched, offline-cached directory) + rounded "+ Add" button; empty state shows a "Find a customer" prompt; matches open customer detail.
- **Skeleton loading states** (2026-07-10, emulator-verified): `src/components/skeleton.tsx` — pulse skeletons (RN Animated opacity loop, native driver, no new deps) with context-aware shapes (beat-stop card, customer/product row, invoice row) shown on first load in every network-backed section: Customers (beat + directory), order screen (credit gate + products), collection screen (invoices), customer detail (outstanding). First-load only — refetches keep existing content.

## Beat plan hidden (2026-07-10)

Beat plans must be assigned per-SE, per-day by Manager/Super-Admin — that web
feature doesn't exist yet (until now beats were seeded via SQL). Decision:
**hide the beat plan in the mobile UI** until assignment ships.

- "Today's beat" section removed from the Customers screen; Home's visits tile
  counts today's visits directly and no longer references beat progress.
- Dormant but intact: `/beats/today` API, `src/lib/today-beat.ts`,
  `src/lib/beat-cache.ts`, the visit screen (`src/app/stop/`), and the
  check-in/checkout sync flow. Re-enable by restoring the beat section in
  `src/app/(tabs)/customers.tsx` (see the comment there).
- **Backlog (web dashboard):** beat-planning UI for MANAGER/SUPER_ADMIN —
  create/edit `beat_plans` + ordered `beat_plan_stops` per SE per day; the
  mobile app already consumes them.
- Note: with the beat hidden there is currently no check-in entry point, so
  orders/collections can't be recorded in the field until either beat
  assignment ships or an unplanned-visit flow (VISIT-RULES.md allows it) is
  added from customer detail.

## Customer workspace (2026-07-10, emulator-verified)

The customer page is now the SE's main workspace (beat plans stay hidden):

- **Add Sale / Add Collection** per customer. First action of the day auto-records an **unplanned visit** with a GPS fix (VISIT-RULES.md) — `ensureTodayVisit` in sync-core, one per customer per day; API `POST /visits/checkin` now accepts `customerId` without a beat stop.
- **Credit gate**: outstanding shown in the hero card; overdue beyond `credit_overdue_days` → red alert band + "🔒 Sale blocked" (Add Collection stays enabled). Server-computed.
- **Last 5 sales / last 5 collections** from the server (SE now allowed on `GET /orders?customerId=`), with queued-local items overlaid, skeletons, and per-section error states with Retry. Fixed a real API bug found on the way: `listCollections` accepted customerId/fromDate/toDate filters but never applied them (returned all collections org-wide).
- **Market intelligence = photos**: multi-select upload (expo-image-picker) → `POST /customers/:id/photos` (multipart) → **Cloudflare R2** (`sri-aparajita-photos` bucket, binding `PHOTOS`; local dev simulated by wrangler — for prod run `wrangler r2 bucket create sri-aparajita-photos`). Authenticated streaming via `GET /photos/:id`; thumbnails via **expo-image** (RN core Image fails on authenticated URIs on Android). Migration `0010` dropped the unused competitor_* tables and added `customer_photos`.

## Customer ownership & SE edit (2026-07-10, verified live)

- **Visibility**: SUPER_ADMIN/MANAGER/ACCOUNTANT see all customers; each SALES_EXECUTIVE sees only customers they created (`customers.created_by`). Enforced at every endpoint via `assertCustomerVisible` — a foreign customer 404s on detail/invoices/photos/orders/collections/check-in. Collections list without a customer filter is scoped to the SE's own submissions (`collected_by_user_id`), which is what the mobile sync status-pull needs.
- **All pre-existing customer data was wiped** (strict fresh start, decided 2026-07-10); the mobile customer cache is now replace-on-fetch so server-side deletions/reassignments propagate.
- **SE edit** (`src/app/customer/edit.tsx`, ✎ Edit on the customer page): address fields + GPS re-capture only; the API ignores other fields for SEs and 404s on customers they don't own. Web roles keep full-field PATCH.
- **Photos**: SE add-only; `DELETE /photos/:id` exists for SUPER_ADMIN/MANAGER only (removes R2 object + row).
- **DB cleanup** (migration `0011`): dropped `customer_contacts`, `customer_addresses`, `customer_documents`, `customer_credit_profiles` (zero references, zero rows). `customer_assignments` kept only because the legacy `/executive-day` flow reads it — candidate for removal when that flow is deleted.

## Risk Flag

If background GPS proves painful on OEM devices, the safe cut is:
> **Drop continuous GPS to check-in/check-out capture only** — removes the background-task complexity; add continuous tracking in a follow-up sprint. Everything else ships.

If NativeWind misbehaves in the pnpm-only setup, the safe cut is:
> **Swap to plain StyleSheet + theme tokens** — react-native-reusables components are copied into the repo, so restyling them is mechanical, not a rewrite.

## API Status

Already in `apps/api` (verified 2026-07-09): `POST /auth/login`, `GET /me`, `GET /beats/today`, `POST /visits/checkin`, `POST /visits/:id/checkout`, `POST /visits/gps`, `GET/POST /orders`, `GET /orders/products`, `GET/POST /collections`, `GET /customers`.

Mobile-gap endpoints built 2026-07-09 (TDD, `apps/api/src/routes/mobile-sync.test.ts`; migration `0009_mobile_sync.sql` applied):

| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET` | `/customers/:id/invoices` | Outstanding invoices with `daysOverdue` per invoice, plus `creditBlocked` computed server-side from the `credit_overdue_days` system setting (don't hardcode 60 in the app) |
| `POST` | `/visits/gps/batch` | Alias of `POST /visits/gps`; both accept a `points` array |
| — | Client-UUID idempotency | `clientUuid` accepted on `POST /visits/checkin`, `POST /orders`, `POST /collections`; replay returns the existing record with HTTP 200 (create returns 201) and `existing: true` |
| `GET` | `?since=` delta pulls | Supported on `GET /customers` and `GET /orders/products` (filters `updated_at > since`); `GET /beats/today` is a daily snapshot, no delta needed |

Also unblocked for SALES_EXECUTIVE (previously web-roles only): `GET /customers`, `GET /orders/products`, `POST /orders` (salesExecutiveId is forced to the authenticated SE).

## Reference docs

- `beyond-distribution-docs/docs/workflows/EXECUTIVE-DAILY-WORKFLOW.md`, `GPS-TRACKING.md`, `SALES-ENTRY.md`, `COLLECTION-RECOVERY.md`, `BEAT-PLANNING.md`
- `AGENTS.md` (root) — API conventions, hard rules, DB quirks
