# Offline-First Removal Plan — mobile app goes online-required

**Status:** planned (2026-09-15). Companion to [NEON-AUTH-MIGRATION-PLAN.md](NEON-AUTH-MIGRATION-PLAN.md). Scoped to the mobile **data-sync** architecture (separate from auth).
**Driver:** user decision — "we don't need offline-first architecture in the mobile." The app assumes connectivity (consistent with pure Neon Auth online login).

> ✅ **KEY SCOPE (RESOLVED 2026-09-15):** "no offline-first" covers user-facing **data** (orders / collections / deliveries reads + writes, and ALL read/list caches). **GPS ping buffering is KEPT** — the native tracking service captures a fix every 3 min into local SQLite and uploads it later, which keeps live tracking continuous through dead zones; making GPS online-only would turn every dead zone into a route gap and could mark a present rep untracked (attendance keys off the session/pings). GPS buffering is telemetry reliability, not offline UX. So: **keep GPS local buffering + self-upload; remove everything else offline.**

---

## Current offline architecture (inventory, from the mobile read)

- **Local SQLite** `beyond.db` (`apps/mobile/src/lib/local-db*.ts`, `db.ts`), schema **v18**, ~23 tables split across `local-db-schema-1..4.ts` + idempotent `local-db-migrate.ts`.
- **Write queue** `sync_queue` (`lib/sync-core-*`): `enqueue`, `flushOnce` (FIFO + exponential backoff), entity types `visit_checkin`, `visit_checkout`, `order`, `collection`, `delivery_start`, `delivery_stop`, `delivery_end`, `task_done`; server-id mapping in `sync-core-apply-result.ts`.
- **Runtime engine** (`sync-engine.ts`, `sync-kick.ts`, `sync-pull.ts`): Network + AppState listeners + a 3-min heartbeat; drains the queue, flushes GPS, then a pull phase (`/collections`, prefetch customer orders, catalogue, assigned tasks) with delta cursors in `sync_meta`.
- **Read caches (offline display)**: `offline-cache.ts` `cachedFetch` over `performance_cache`; plus `cached_orders`, `cached_collections`, `customer_detail_cache`, `cached_ledger`, `order_detail_cache`; prefetched on sync so customer detail / Last-5 / ledger render offline. `OfflineBanner` component.
- **GPS pings** `gps_pings` table + native `ForegroundLocationService.kt` self-upload (KEEP — see scope note).
- **Already online-only (dead code):** order create (`order/api.ts`), collection (`collection/submit.ts`), check-in (`customer/checkin.ts`) were rewritten to online-only, so the `record*` functions (`sync-core-orders.ts`/`-collections.ts`/`-visits.ts`) and their queue entity types are **already unreachable** — this plan finishes deleting them.
- **Still offline-first writes:** Logistics **delivery** runs/stops/end (`online-first.ts` try-server-then-queue) and `task_done`.

---

## Target: online-required app (GPS buffering excepted)

- All user-facing reads/writes go straight to the API; a clear "you're offline" error state replaces the queue + cached fallback. No `sync_queue` for business writes, no cached reads.
- **Keep:** GPS capture→local→upload (tracking must survive signal gaps); `expo-secure-store` session (that's auth, not data-sync); personal reminders (local OS notifications, not a network cache).
- Net effect: the app behaves like the SUPER_ADMIN area already does (online-only), extended to SE + LOGISTICS.

---

## Phase 1 — Delete the already-dead write path ✅ DONE (2026-09-16)

Zero behavior change (these are unreachable today): remove `record*` in `sync-core-orders.ts`/`-collections.ts`/`-visits.ts`, the `order`/`collection`/`visit_checkin`/`visit_checkout` entity types + their `sendItem` dispatchers + `applyServerResult` branches, and fix the stale `ENTITY_LABELS` in `components/settings/sync-status.tsx`. Keep tests that still apply; delete the dead ones.

**Done + emulator-verified (uncommitted).** Deleted `sync-core-orders.ts`, `sync-core-collections.ts`, `sync-core-visits.ts`, `sync-core-ensure-visit.ts` (`ensureTodayVisit` was also dead), `sync-send-collection.ts`, and — a bonus, also fully dead (0 live consumers, screens already fetch online) — the local-order READ modules `order-cache-activity.ts` (`getTodayActivity`), `order-cache-orders.ts` (`getLocalOrdersForCustomer`), `order-cache-home.ts` (`getTodaySummary`/`getTodaySegmentLitres`), `order-cache-credit.ts` (`cacheCreditStatus`/`getCachedCreditStatus`). Trimmed `SyncEntityType` to the live `delivery_*`/`task_done`; removed their `sendItem`/`applyServerResult` branches; fixed `ENTITY_LABELS`; updated the `sync-core.ts` + `order-cache.ts` barrels. Kept `applyServerCollectionStatuses` (live, used by `sync-pull`) — trimmed its dead sibling `getLocalCollectionsForCustomer` out of `order-cache-collections.ts`. Rewired `sync-core.test-support.ts` (`seedCheckIn`→`seedQueuedItem`, a live `task_done` seed); deleted 8 dead test files; edited the flush/queue/delivery/collections/bearings/catalogue tests to cover the LIVE code without the deleted producers. Left the now-unwritten local tables (`orders`/`order_items`/`collections`/`visits`) in the schema — dropping them is Phase 5. Result: mobile tsc 0, **214 tests pass** (was 237; 23 dead tests gone), app rebundles + Home loads on the emulator with no errors.

## Phase 2 — Convert delivery writes to online-only ✅ DONE (2026-09-16)

`(logistics)/delivery.tsx` + `add-delivery.tsx` currently use `online-first.ts` (try server, else queue). Drop the queue fallback → direct API calls with an online-required error/retry UX (mirror the order/collection screens' `submitOrder`/`submitCollection` pattern). Remove `online-first.ts`, `deliver-run.ts`, `deliver-stop.ts`, `delivery-remote.ts` queue paths, and the `delivery_start`/`delivery_stop`/`delivery_end` entity types. Keep the direct senders.

**Done + emulator-verified (uncommitted).** Deleted `online-first.ts`, `deliver-run.ts`, `deliver-stop.ts`, `sync-send-delivery.ts`, `sync-send-delivery-stop.ts`, `sync-core-apply-result.ts`. Rewrote `delivery-run-actions.ts` / `deliver-stop-actions.ts` to send straight to the server and THROW on failure (screens catch → retryable error via `use-delivery-run-form.ts` / `use-save-delivery-stop.ts`); reordered end-run so tracking stops only after a successful server end. Dropped `record*`/`enqueue` from `sync-core-delivery-start/stop/end.ts` (kept the `mirror*` for local display), trimmed `SyncEntityType` to just `task_done`, removed the delivery `sendItem` branches, removed `getDeliveryPendingCount` + the "waiting to upload" UI (PendingBanner + threading through use-delivery-run-data / delivery-screen-view / active-run-view / delivery-states) and the logout "unsynced deliveries" warning. Kept the local delivery-run/stop mirror tables (the screen's data source) — table drops are Phase 5. tsc 0, tests green.

## Phase 3 — Remove read caches + cached fallbacks ✅ READ-SIDE DONE (2026-09-16)

- Delete `offline-cache.ts` (`cachedFetch`/`cachedInitial`) and switch its consumers (performance/home cards, customer detail, Last-5 orders/collections, ledger) to plain `apiFetch` with loading/error states (the shimmer system stays for loading; the "show cached on failure" branch goes).
- Drop cache tables from the schema: `cached_orders`, `cached_collections`, `customer_detail_cache`, `cached_ledger`, `order_detail_cache`, `performance_cache`, and the customer/beat/product/bearing directory caches used only for offline display — **audit each** for a non-offline consumer first (e.g. beat-cache / delivery-cache may back a picker that should just fetch).
- Remove `OfflineBanner` and the `navigator`/NetInfo offline-state wiring in `auth-gate.tsx`/`use-auth-gate.ts` and screens.

**Done + emulator-verified (uncommitted).** There was NO NetInfo/`navigator.onLine` — "offline" was purely `cachedFetch`'s `fromCache` flag. Deleted `offline-cache.ts` (+ test) and `components/offline-banner.tsx`; converted every network-first-with-SQLite-fallback read to plain online `apiFetch` (React Query loading skeleton + existing error/retry states, which already existed): customer detail (`lib/customer/queries.ts` — dropped the `Cached<T>` wrapper + `offline` flag; `orders-section`/`collections-section`/`app/customer/[id]` read `.data` directly), ledger (`ledger-fetch.ts` + `app/ledger/[id]`), dues drill-down (`dues.ts` + `app/dues/[bucket]`), order-detail sheet (`order-detail.ts` now online-only; removed the dead `getQueuedOrderDetail` + `queued`/`fromCache` fields + badges — orders are online-only so there are no queued orders), customer-edit (`app/customer/edit.tsx`). Deleted the superseded dead `lib/today-beat.ts` (screens already use `lib/beat/today-beat-online.ts`). tsc 0, 177 tests, app bundles + Home loads clean. **AUDIT RESULT — the remaining "directory" caches (`cached_orders`/`cached_collections` via `order-cache-server-*`, `cached_products`/`cached_bearings`, `delivery_customers`, `beat_stops` via `beat-cache`) have ZERO live readers already** (pickers/beat/customer-detail all fetch online): they are now WRITE-ONLY, populated by the sync prefetch. Removing those writers + the prefetch is **Phase 4** (sync-engine trim), and dropping the tables is **Phase 5** — both left for later per the "phases 2+3 only" scope.

## Phase 4 — Trim the sync engine to GPS only ✅ DONE (2026-09-16)

- `sync-engine.ts`: remove the write-queue drain + the pull phase; **keep** the GPS flush + heartbeat (tracking). Rename/refocus to a "tracking uploader," not a general sync engine.
- Delete `sync-kick.ts` queue loop, `sync-pull.ts`, `sync-core-*` queue modules, `sync_meta` cursors — **except** the GPS ping flush path used by the native service fallback.
- Keep `gps_pings` + the native `ForegroundLocationService` upload untouched.

**Done + emulator-verified (uncommitted).** `kickSync` is now GPS-flush + heartbeat only (single-flight kept); `sync-engine` keeps the network/foreground/heartbeat triggers (dropped the queue backoff/stats); `sync-store` holds just `{syncing,lastSyncedAt}`. The LAST queued write, `task_done` (office-task completion), went online-only: `markAssignedTaskDone(db, task, token)` POSTs `/me/tasks/:id/done` first (404 = already-done) then mirrors locally, throwing on failure so the Reminders screen shows a retry dialog; the assigned-task cache + OS alarms + on-focus pull (`refreshAssignedTasksNow`) stay. **Deleted** `sync-pull.ts`, `sync-pull-collections.ts`, `sync-prefetch-orders.ts`, `sync-prefetch-catalogue.ts`, `sync-core-queue.ts`, `sync-core-flush.ts`, `sync-send.ts`, `sync-core-types.ts`, `sync-core-apply-result.ts`, and the entire now-dead `order-cache*` set (7 files), `delivery-cache.ts`, `beat-cache.ts`, `beat-cache-status.ts` (+ their tests). Stripped the queue-based Sync/Failed cards from the SE Settings screen. GPS kept fully intact (`sync-core-gps*`, `sync-tracking-session`, heartbeat, native service) — verified running on the emulator (ForegroundLocationService active, 12 GPS tests pass).

## Phase 5 — Schema + cleanup ✅ DONE (2026-09-16)

- New local schema version (v19) dropping the removed tables (idempotent `local-db-migrate.ts` adds the `drop table if exists` steps; it re-runs every launch, so legacy installs self-clean).
- Update `settings` "Data & storage" screen (it lists cached data + "clear cache" / sync status) — strip the offline/sync sections (mirror the SA online-only settings variant already in the app).
- Update `apps/mobile/AGENTS.md` + `BUILD_GUIDE.md` (both stale) to state: online-required app, GPS buffering the only local-persistence exception.

**Done + emulator-verified (uncommitted).** `LOCAL_SCHEMA_VERSION` → **19**. The lean schema keeps only `gps_pings`, `delivery_runs`, `delivery_stops`, `reminders`, `performance_cache` (now backs the error buffer), `assigned_tasks`; `local-db-schema-2` reduced to `gps_pings`, `sync_meta` removed from `-4`, emptied `local-db-schema-1`/`-3` deleted. `migrateLocalDb` drops all 18 removed tables (children before parents) and its alters are trimmed to the two kept tables. `ALL_LOCAL_TABLES` (logout wipe) trimmed to the six survivors. Removed the dead local-`customers` mirror-write from `save-customer-edit`. Rewrote the schema test (kept-present / removed-absent + a legacy-install drop test). **The v19 migration ran on the existing v18 DB with no crash / no "no such table" errors; Home + dues load; native GPS still tracking.** Mobile tsc 0, **152 tests pass**. (`apps/mobile/AGENTS.md` only says "read the Expo docs" — no offline architecture to correct; no stale `BUILD_GUIDE.md` was found.)

---

## Risks & notes

- **Field reality:** shops with weak signal will now show errors where the app used to queue silently. This is the user's explicit choice, but worth a heads-up to the client — the previous design existed *because* reps work in low-signal shops (per project memory).
- **GPS is the one thing that must not regress** — verify tracking continuity through an airplane-mode window after the change (native capture→buffer→upload on reconnect).
- **Sequencing vs auth:** independent of the Neon Auth migration, but both touch mobile — do them in separate branches/builds to keep blast radius small.
- **Big test churn:** the offline modules carry substantial tests (sync-core, delivery, offline-cache, ledger). Expect large test deletions; keep GPS/native-tracking tests.

## Open items

1. ~~GPS buffering keep/remove~~ **RESOLVED: KEEP** GPS local buffering + upload (tracking continuity). Everything else offline is removed.
2. ~~Directory/picker caches~~ **RESOLVED: fetch-on-demand** — remove ALL caches, including the near-static catalogue/customer/beat/bearing directory caches; a brief loading state on those lists is accepted.
3. **Personal reminders** (local OS notifications) — keep (not a network cache), assumed yes; flag if not.
4. **Client sign-off** on the "errors instead of silent queue in low-signal shops" behavior change (still worth telling the client — the old design existed *because* reps work in low-signal shops).
5. ~~Sequencing~~ **RESOLVED: web auth first**, then mobile auth **together with** this offline removal (both touch mobile → one mobile branch/build). See [NEON-AUTH-MIGRATION-PLAN.md](NEON-AUTH-MIGRATION-PLAN.md).
