# Project Memory — Beyond Distribution Management System

> Consolidated export of Claude Code's project memory, generated 2026-09-15.
> Claude Code keys memory to a directory path, so this snapshot is committed into the
> repo itself and copied into the Sri-Aparajita-Distribution-OS fork so the accumulated
> context (decisions, gotchas, work log) travels with the code. Facts reflect what was
> true when each note was written; verify against current code before relying on a detail.

---

## Index (MEMORY.md)

# Memory Index

## Preferences, rules & environment (durable)

- [Git Rules](feedback-git-rules.md) — never `git add -A/.`; never push/deploy without asking; never `--no-verify`
- [New Order / UI taste](project-neworder-redesign.md) — user dislikes colorful/toy UI + grids; wants clean-minimal flat lists (applies web + mobile)
- [Field Trial](project-field-trial.md) — live since 2026-07-17; data may be REAL, never bulk-delete without asking (DB was wiped to zero then; users/catalogue kept)
- [Mobile Offline Vision](project-mobile-offline-vision.md) — SE app must work fully offline; cache ALL data; never a bare "Couldn't load"
- [Paged-Table Shimmer](project-paged-table-shimmer.md) — lists skeleton only on SLOW (>200ms) refetch, fast swaps instant; supersedes AGENTS "don't flash"
- [NativeWind Shadow Crash](feedback-nativewind-shadow-crash.md) — toggling `shadow-sm` between renders crashes debug app (misleading "navigation context"); use bg-only
- [Dialog System](project-dialog-system.md) — unified kit (sticky header/body/footer, 500/640/880/1080 tiers, DialogSection) across ~30 dialogs
- [URL List State](project-url-list-state.md) — useTableUrlState keeps list filters/sort/page in URL so Back restores the view (web)
- [TextSelect Dropdown](reference-text-select-dropdown.md) — shared compact text-only dropdown for fixed-list filters; prefer over raw shadcn Select
- [Project Overview](project-overview.md) — tech stack, roles, implemented vs placeholder routes (baseline 2026-07-11)
- [Deployment](project-deploy.md) — frontend on Cloudflare Worker (not Pages); deploy command, secrets
- [Local Web → Deployed API](project-local-web-uses-deployed-api.md) — SRI_APARAJITA_API_BASE_URL points local web at PROD API; apps/api edits invisible locally until deployed (or repoint 8787)
- [Dev Server](project-dev-server.md) — root `pnpm dev` = turbo api+web only (mcp excluded, inspector 9229 clash); `dev:mcp` standalone
- [pnpm dedupe / tsc gotcha](reference-pnpm-dedupe-tsc-gotcha.md) — after a dep bump, `pnpm install` can un-dedupe → phantom test-file `toBeInTheDocument` tsc errors (masked by incremental cache); fix with `pnpm dedupe`, don't `git checkout pnpm-lock.yaml`
- [Leaflet overlay z-index](reference-leaflet-overlay-zindex.md) — popovers/selects/dialogs render BEHIND a Leaflet map (its z-indexes ~1000 escape a non-stacking .leaflet-container); fix = global `.leaflet-container { isolation: isolate }`
- [MCP run_sql](project-mcp-server-discussion.md) — live remote read-only MCP (Neon replica) at sri-aparajita-mcp.vardhansystems.workers.dev/mcp; use for prod DB reads
- [Neon backups + privacy](neon-backups-and-privacy.md) — proj `odd-pine-20025067` (Launch, Singapore, 1 member, single `production` branch = dev hits prod); backups 2026-11-06: 7-day PITR + daily snapshots (35d) + manual baseline; off-Neon pg_dump deferred; honest "can you see my data?" answer + hardening gaps (upgrade Scale for stronger promises)
- [Sales-return restock + activity fix](sales-return-restock.md) — returns were LEDGER-ONLY → fixed 2026-11-08 to restock the original sale's lots (migration 0020 APPLIED + Phases 1-3) + fixes "edited invoice shows 2× units" display bug; 1299 tests 100% lines, live-verified, ⚠️UNCOMMITTED+UNDEPLOYED (deployed API still OLD); over-return blocked by UI + API 422; ⚠️prod transactional data WIPED 2026-11-08 (invoices/returns/stock-journal/ORD-0019 gone, series reset, stock zero; collections/customers/SKUs/godowns kept)
- [SaaS → Distribution OS plan](saas-distribution-os-plan.md) — turn this single-company app into a multi-ENTERPRISE SaaS (full spec `docs/SAAS-PLAN.md`); Phase 0 PLANNING ONLY, no code; CLONE repo → new "Distribution OS" project (Sri Aparajita untouched), reverses Hard Rule #6; ⚠️ isolation model (shared-DB+RLS vs DB-per-enterprise) re-opened 2026-11-06 vs the per-DB backup/privacy story — OPEN
- [Test Web Accounts](project-test-web-accounts.md) — Manager/Accountant test logins for role verification
- [App Package ID](project-app-package-id.md) — Android com.vardhansystems.sriaparajita (permanent, Indus store); old com.anonymous.mobile is a separate app
- [Mobile APK Size](project-mobile-apk-size.md) — pin arm64-v8a via config plugin (android/ gitignored, EAS regenerates); else ~120MB all-ABI
- [Mobile Rebuild](project-mobile-rebuild.md) — apps/mobile in monorepo pnpm-ONLY (never npm); planned vs unplanned visit semantics
- [Org-ID Removal](project-org-id-removed.md) — organization_id + 28 dead tables dropped (migr 0034/0035); single-client, never reintroduce

## Separate projects

- [vardhan-maps](project-vardhan-maps.md) — open-source India-map npm package (NOT the Beyond monorepo); ~/Desktop/vardhan-maps + github.com/Vardhan-Systems/vardhan-maps + PUBLISHED on npm (0.7.0 live; **0.8.0 built, unpublished**). 36 states + 787 districts (OSM, GoI-patched) + SVG/Leaflet/React + self-hosted grey vector basemap (pmtiles). Both Beyond WEB maps use it. **0.8.0 adds `vardhan-maps/react-native` (`IndiaMapNative`, MapLibre RN, native pmtiles) — full web parity, for the mobile SA maps.**

## Work log (newest first)

- [Mobile error handling + offline UX + tracking overlays](mobile-error-offline-ux.md) — 2026-11-09: a multi-part mobile pass, **committed (4 commits) + pushed to `main`** (`0ec679e`, `5db4234`, `4a340ed`, `d32d2a2`; all JS-only/native-safe so OTA-able, **not yet OTA'd** to the field APK). (1) **Severity-aware error handling app-wide**: `humanize-error` gained `severity` (error/warning — 402/404/408/429/offline/network→warning amber, 401/403/5xx→error red); new shared `FeedbackBanner` + `toast` host; `ErrorBanner` delegates to it; `ErrorState` is offline+severity aware; wired into dashboards/login/order/collection/customer-edit/profile/ledger/invoice/notes/order-detail/lists. (2) **Offline/stale UX**: global bar now **"No internet connection"** (was over-promising "changes are saved and will sync") + inline **"Showing last synced data"** (dedupes the double-"Offline"); the `fromCache` strip was REMOVED from customer+ledger (it flashed during normal online revalidation); **NOTES have no offline queue** → Save gated on connectivity with an honest hint; **credit-gated action tiles DECOUPLED** — Collect/Ledger/Notes always render, Order is tri-state fail-open (previously a slow/failed credit query left the whole 4-tile row stuck in a skeleton on a poor network). (3) **Web-parity live-tracking overlays** on the Super Admin map: customer markers (bucket-coloured, tap→native card matching the web popup — name·city·salesperson·₹due·bucket + last-order/collection chips, name opens the customer) from `/dashboard/map`; selected rep's **check-in markers** (green planned/orange unplanned, tap→visit card: customer·time·orders litres·collections ₹) from `/tracking/checkins`; GPS trail restyled to the web (slate line + slate beads, rep markers green/grey, no blue). ⚠️ **GOTCHA**: field APK runs `vardhan-maps@0.15.0` (web = **0.19.0**) which does NOT paint marker `icon` divIcons → check-ins render as **circles, not the web's flag glyph** (colours match); real flags/white-bead-ping need 0.19.0 = a NATIVE change (`@maplibre/maplibre-react-native` peer), **not OTA-able**, so a fresh APK — user chose circles for now. Also cleared the LogBox require-cycle (moved pure gps key helpers to import-free `gps-config`) + calendar duplicate-key warnings, and **all 40 SonarQube findings** on the touched files (IIFE render blocks S3972/S2681, inline component S6478, nested ternaries S3358, index-as-key S6479, ReDoS login regex S8786). tsc + eslint clean, 225 mobile tests green, import-cycle gate green. Verified live on the Android emulator incl. throttled 3G/4G/GPRS (graceful degradation). See also [mobile-tracking-map-overlays.md](mobile-tracking-map-overlays.md). ⚠️ [[local-dev-uses-live-prod]].
- [Low-stock reorder alerts](low-stock-reorder-alerts.md) — 2026-11-08: when a stock movement drops a `(godown, product, pack)` balance to or below its `reorder_level`, raise an OPEN `low_stock` **web Alert** (`/alerts`) AND send an **Expo mobile push to every SUPER_ADMIN** with a registered device — the same `push_tokens` + `sendExpoPush` channel SEs get invoice notifications on. **Once per downward crossing** (`stock_reorder_state`, migration **0021** applied to prod — PK godown/product/pack + `open_alert_id`), stays silent while already low, **auto-closes** the alert + re-arms on restock above reorder (`<=` semantics). Code: `services/stock-reorder.ts` (`checkReorder` + `reorderRowActions` helper + `superAdminPushTokens` + `keysForInvoice`), `lib/reorder-notify.ts`; wired real-time into GRN/transfer/adjustment/opening, generate/edit/cancel invoice, sales-return create/edit. 18 tests, full suite green, all SonarQube findings cleared. **⚠️ CHANNEL LESSON:** "notify super admin **mobile**" meant the **Expo app push** (like SEs), NOT browser/PWA **web push** — the first cut wrongly used Web Push (VAPID/`notifyOfficeWebPush`) and it FAILED on phones (diagnostics proved the server side perfect — FCM returned **201** — but the device never displayed it; browser/PWA push on phones depends on OS notification settings + iOS Add-to-Home-Screen PWA). Switched to Expo and it worked immediately. VAPID keys + the test `web_push_subscriptions` were then **removed** (web push back to dormant, as before). Committed `a24a7a9` (first cut) + `2808137` (Expo switch), **DEPLOYED api + web** 2026-11-08. ⚠️ [[local-dev-uses-live-prod]].
- [Stock home cards — Design A](stock-home-cards-design-a.md) — 2026-11-08: the three **/stock home** cards (Expiring soon / On hand / Recent activity) redesigned to dense "Design A" data-tables sharing **one 6-column grid** (`HOME_COLS` + `HomeColGroup` + `table-fixed`) so columns line up vertically across all three cards. **Home-only** new/rewritten components (`ExpiringList`, `HomeBalances`, `HomeActivityTable`) — the "View all" drill-downs still use the ORIGINAL shared `BalancesTable` / `ActivityFeed` / `NearExpiryTable` (home cards only). `useActivity` now emits `detail`/`locationName`/`amount` with `secondary` **derived byte-identically** so the drill-down feed is unchanged. Decisions: **amber on Expiring soon ONLY**; **number columns centered** (Qty/Litres/Reorder, Days/On hand, Value/Date — "let's see", revert = right-align); **On-hand home shows BRAND only** (segment chip removed, home card only — drill-down keeps brand+segment); **reorder pencil hover-only** at the row's right edge, vertically centered, opens the reorder-level input dialog; **days-left dot removed** (text colour still signals urgency). Expiry **MonthYearField now current-month-onward** (past months disabled, `‹` blocked at current year; shared by stock-in + opening). Gotcha: `HOME_COLS` repeats width classes → key `<col>` by **index** not class, else a duplicate-key warning fires every render. Committed `4df7fa3` (redesign+picker) + `50df974` (key fix); lint+typecheck clean, live-verified. **NOT deployed** (committed only; local web hits prod API/data). ⚠️ [[local-dev-uses-live-prod]].
- [Stock Journal — shipped](stock-entry-pages-redesign.md) — 2026-11-05: the Stock module went live. Full-page **/stock/entry** (sectioned spreadsheet grid, no switcher/back-nav; brand-filtered SKU search gated by supplier; mandatory supplier invoice no; batch/expiry/rack/shelf/bin on stock-in + opening). **/stock = "Stock home"** dashboard (KPI cards, FEFO Expiring-soon, On-hand top movers, Recent activity). **Stock lookup** popup + **stat-card drill-downs** (per-godown breakdown, low-stock list). New **MonthYearField** (future-month expiry). **Context-aware shimmers** app-wide (shared `Shimmer` sweep; godown-switch forces a brief shimmer). Sentence-case labels. New API: `balancesByGodown`, `lookupProductStock`; routes `/stock/summary/by-godown`, `/stock/lookup`, `/stock/near-expiry` (UNION GRN+opening) — **100% line+branch tests** (service + route layers, 48 stock tests). All SonarQube findings on touched files fixed. **COMMITTED (user) → api + web DEPLOYED to prod** (API `sri-aparajita-api`, web `sriaparajita.vardhansystems.in`); migrations **0012/0013/0014 all APPLIED** (0014 = product names Title-cased, 228/230; `schema_migrations` up to date). Deploy also carried the earlier **invoice transport-charge + PDF** (351efa7) live. E2E dummy data (2 GRNs, 1 transfer, 1 adjustment, 3 opening items, 11 movements, 8 balances) **wiped** afterward — stock back to zero; godowns (Bachupally, Hayatnagar) + 230 products kept. Deferred Phase 2: batch-level inventory for Transfer/Adjust. ⚠️ local dev = live prod DB ([[local-dev-uses-live-prod]]).

- [Tracking Customers + Visit Flags](project-tracking-customers-visits.md) — 2026-09-10: web Live Tracking map now plots all customers (faint dots→customer page) + selected exec's check-ins as flag markers (green planned/orange unplanned) with tap-popup (customer, time, planned/unplanned, order/collection deep-links, View customer). New GET /tracking/checkins. Needed vardhan-maps 0.9.0 (Leaflet MapMarker.icon/iconSize/iconAnchor/popup — PUBLISHED). Fixed flag-click-navigates bug (onMarkerClick guards m.icon). Verified live. Needs commit + api/web deploy.

- [Order Short-Close](project-order-short-close.md) — 2026-09-10: Cancel on a partially-invoiced order now short-closes the un-invoiced remainder (shrink qty + `order_items.cancelled_units`, new `partially_cancelled` stage) instead of voiding all; fully-invoiced → blocked. Migr 0075 APPLIED to prod+verified. Needs commit + api/web deploy.

- [Mobile Collections Perf + Beat Due](project-mobile-collections-beat-due.md) — 2026-09-10: SE app — collection performance (total+verified, day/week/month, actuals-only) in My Performance card (/targets/me getCollectionActuals); per-customer collection due (outstanding + ageing bucket chip) on beat-plan stops (/beats/today lateral + bucketFromAge). TDD (bucketFromAge/dueBucketMeta/collectionsForTab), ≤100 lines/file, tsc clean. Also fixed dashboard-metrics.test I'd broken with Sold Oil work. UNCOMMITTED, needs api deploy + APK.

- [Order Fulfillment Status](project-order-fulfillment-status.md) — 2026-09-09: stored orders.fulfillment_status (migr 0074) — 8-stage ladder (ordered→partially_invoiced→invoiced→partially_delivered→delivered + partially_returned/returned/cancelled) persisted from the live FULFILLMENT_CASE, backfilled, recomputed on every order/invoice/delivery/return change via services/fulfillment.ts. api tsc clean. Migr 0074 APPLIED to prod (UPDATE 371, verified). NEEDS: deploy api. Follow-up: Sold Oil → delivered-based. (I have writable prod psql access via root .env DATABASE_URL.)

- [Self-hosted Vector Basemap](project-selfhosted-vector-basemap.md) — 2026-09-09: replaced Esri raster tiles on BOTH web maps with a self-hosted OSM VECTOR basemap (Planetiler pmtiles from daily OSM-France TG/AP extracts + Noto glyphs, MapLibre-under-Leaflet via vardhan-maps 0.5.0 file-linked). Light-grey, roads+labels, no POI, state-bold/customer-district-faint borders. KEY GOTCHA: maplibre-gl v6 silently fails pmtiles source (blank roads) → pin ^4.7.1. Verified live on localhost (TG tiles). REMAINING: R2 hosting, full TG+AP build, CI auto-refresh, publish 0.5.0.

- [Privacy Policy Page](project-privacy-policy-page.md) — 2026-09-09: public /privacy-policy Next route (apps/web) naming app "Beyond Automobile" (com.vardhansystems.sriaparajita) + entity "Beyond Distribution Systems" + support@vardhansystems.in, to fix Play Console "app/developer details don't match" rejection. Documents bg-location/camera/etc. UNCOMMITTED; needs web deploy + Play URL update to bdms.vardhansystems.in/privacy-policy

- [Dashboard OSM Customer Map](project-dashboard-osm-map.md) — 2026-09-07: new "Customer map" section on Dashboard home (SA+MGR) — OpenStreetMap/Leaflet + markercluster, all 337 customers coloured by dues-ageing bucket, exec/city filters, today-live activity overlay (SE positions/check-ins/routes), "Fit" button. New api /dashboard/map + /map/activity + services/dashboard-map.ts. Leaflet deps added. Hit a nasty Leaflet+StrictMode auto-fit bug (deferred-teardown + time-bounded fit loop; Fit button is the reliable fallback). UNCOMMITTED, needs api+web deploy.

- [Dashboard Productivity Pill](project-dashboard-productivity-pill.md) — 2026-09-07: ported mobile's colour-graded "Productivity N%" pill (productive÷visits, red→amber→green HSL) to the web SA/Manager dashboard drill-downs — on BOTH the Visits and Productive Visits per-SE lists (metrics-drilldown-agents.tsx). tsc/lint clean, verified in-browser. UNCOMMITTED, needs web deploy.

- [Error Monitor Dup-Key Merge](project-error-monitor-dupkey-merge.md) — 2026-09-07: Error Monitor fingerprint normalizes quoted constraint names → ALL duplicate-key NeonDbErrors merge into ONE mislabeled group (query error_events per-group for truth). Fixed the live half: startTrackingSession made idempotent on client_session_id (on-conflict-do-nothing + replay lookup + race catch), mirrors visits/orders/collections. UNCOMMITTED, needs api deploy.

- [Animated Swap (drill-down transitions)](project-animated-swap.md) — 2026-09-07: added framer-motion ^13 + reusable `AnimatedSwap` (components/ui/animated-swap.tsx) — cross-fade + ResizeObserver-measured height ease (~450ms) for shimmer→data in dashboard drill-down dialogs (metric cards + Collection Dues). Fixes size-snap. UNCOMMITTED, web deploy.

- [Dashboard Finance Cards + KPIs Removed](project-dashboard-finance-cards.md) — 2026-09-07: dashboard = 6 activity cards + Collection Dues card (cross layout, /dues/summary, clickable buckets). ALL finance stat cards (Outstanding/New customers/Revenue/Expenditure) removed + finance backend (dashboard-finance.ts, /dashboard/finance*) DELETED; KPIs page+feature+endpoint DELETED, Accountant home now placeholder; collections heatmap added then removed. UNCOMMITTED, needs api+web deploy.

- [Check-in Beat Race Fix](project-checkin-beat-race-fix.md) — 2026-08-24: fixed same-day new-customer check-in recorded 'unplanned' + 7PM cron adding duplicate 'missed'. Root: enroll adds to beat_customer_days template, stop materializes later (race). Fix: check-in calls materializeTodayPlan first (→planned+completed, e2e verified); markMissedBeatStops guards on existing visit; backfilled 12 affected customers on prod. api UNCOMMITTED, needs deploy.

- [Error Monitoring (in-house)](project-error-monitoring.md) — 2026-08-23: built Sentry-replacement error monitor. migr 0071 (error_groups/events/notes, APPLIED to prod). API: captureError (atomic CTE + fingerprint dedup) hooked into errorHandler (5xx only, waitUntil) + POST /errors/ingest (web/mobile) + SA-only list/detail/triage + 90d retention cron. Web: SA-only /errors page (summary+tabs+table+detail drawer w/ resolve·ignore·reopen·assign·notes) + nav item. VERIFIED live (dedup, 403 gate, triage SQL, regression-reopen); tsc clean, 7 new tests. UNCOMMITTED, needs api+web deploy. REMAINING: wire web error.tsx + mobile [BeyondCrash] to /ingest (endpoint ready).

- [Offline Cache: Ledger + Customer Detail](project-offline-cache-ledger-customer.md) — 2026-08-22: fixed offline "Couldn't load" on ledger + customer-detail (balance was ₹0). NEW offline-cache.ts (cachedFetch over performance_cache, instant-cache+revalidate) + OfflineBanner; removed fetchCredit try/catch; dues.ts DRY'd. VERIFIED live (debug build vs localhost worker, before/after). Photos not cached (data-only). UNCOMMITTED, tsc+208 tests pass. .env restored to prod.

- [Mobile Stress/Perf Findings](project-mobile-stress-findings.md) — 2026-08-22: release-APK stress test (emulator, SE Sandeep, read-only). Perf healthy (cold ~1.3s, no leak, survives kill/Doze/fuzz). FINDINGS: (1) offline gaps — Ledger/customer-detail orders+collections+MI/Leaderboard NOT cached (bare "Couldn't load"), balance→₹0; (2) transient client-only role slip — SE briefly rendered SA dashboard shell before AuthGate redirect (no data leak, server 403s SE). Env: emulator now on RELEASE build (no Metro); gitignored babel symlink added.

- [Customer Phone Uniqueness](project-customer-phone-uniqueness.md) — 2026-08-22: dup phone on create blocks w/ named 409 (global, not SE-scoped — can name an unseen customer; user kept it). Hardened: partial UNIQUE index active-only (migr 0070, applied prod) + assertPhoneAvailable helper + both edit paths guarded (were dead/absent). Also fixed mobile ErrorBanner black-border bug → `border-destructive` (NativeWind /opacity on destructive token silently falls back). Needs api deploy.

- [Dues = Ledger Truth](project-dues-ledger-truth.md) — 2026-08-22: Collection Dues/outstanding now = stateless ledger Total Debit Balance (opening_amount + non-rejected invoices − non-rejected collections − returns), can't drift. Layer 1 DONE (customers list + KPI + leaderboard; owes=red/credit=green Cr) + Layer 2 DONE (recompute-recompute.ts engine wired into 8 mutations; prod repair ran, verified). Needs api+web deploy. 14 api route-test fails are PRE-EXISTING (not this work).

- [Visit Outcomes](project-visit-outcomes.md) — 2026-08-22: dashboard Visits drill-down now shows Planned/Unplanned badge + clickable order (litres/pcs) & collection (₹) chips linking to detail pages; outcomes inferred by same SE+customer+date (no stored FK); dashboard-metrics.ts + metrics-drilldown-customers.tsx; UNCOMMITTED, needs api+web deploy

- [Srikanth Tracking Stall](project-srikanth-tracking-stall.md) — 2026-08-22: missing from map = device CAPTURE-STALL not a bug; session active + attendance-present but 0 gps_points (heartbeats/perms green, queued 0); alert TRACKING_COMMUNICATION_INTERRUPTED chronic; diagnosis-only
- [KPIs Load Optimization](project-kpis-load-optimization.md) — 2026-08-22: /dashboard/kpis p50 8s→2.9s under 15-concurrent by parallelizing 8 sequential aggregates into one Promise.all (services/kpis.ts); DEPLOYED. sku-analytics had same bug, also fixed
- [URL Flatten](project-url-flatten.md) — 2026-08-21: removed `/dashboard` URL prefix via route group `app/(dashboard)/`; role-neutral `/` home; Users&Teams→/settings/users; next.config redirects; UNCOMMITTED
- [Incentives Page](project-incentives.md) — 2026-08-21: /incentives (SA+Mgr+Acct) monthly per-SE Collections% + Targets reward; migr 0067; display-only; UNCOMMITTED
- [Web Resilience Hardening](project-web-resilience-hardening.md) — 2026-08-21: apiRequest timeout, offline banner, serverApiFetch retry, auth DB-blip cache/503, never-drop-writes draft hook, self-hosted /status+monitor cron; UNCOMMITTED; #4 → /security-review
- [Invoice Parse Audit](project-invoice-parse-audit.md) — 2026-08-20: audited 228 invoices' line_items vs PDFs; parser sometimes mis-reads a line qty/price (totals OK); 3 fixed live; detect via sum(lines)≠net
- [Mobile Super Admin area](project-mobile-super-admin.md) — 2026-08-17: IN PROGRESS SA area in Expo app; 5 tabs; P0-P2 done+live on emulator (not committed); P3-P5 pending
- [Web Push](project-web-push.md) — 2026-08-17: browser Web Push for office (tab-closed); VAPID/RFC8291 on Workers, migr 0063, public/sw.js; LIVE
- [Tracking Capture Reliability (specced)](../../docs/PENDING-TRACKING-CAPTURE-RELIABILITY.md) — 2026-08-15: SE moving-gaps ~70% in-code capture-stall + ~30% OEM kill; fix SPECCED not built; client wants continuity>accuracy
- [FCM Credential Fix](project-fcm-credential-fix.md) — 2026-08-15: ROOT CAUSE all app pushes silently failed (no FCM V1 cred after package rename); fixed via `eas credentials`; verified
- [Location Health Guard](project-location-health-guard.md) — 2026-08-15: mid-day full-screen blocker on any location degradation (SE+Logistics) + server FCM "turn on location" nag; DEPLOYED
- [Logistics Online-First](project-logistics-online-first.md) — 2026-08-15: fixed readonly-SQLite lost-delivery; all 4 logistics writes online-first w/ queue fallback; deployed, needs APK
- [Sound Notifications](project-sound-notifications.md) — 2026-08-14: web audio alerts for new orders/collections/visits; DEPLOYED; audio blocked till a click; use Next <Link> not <a>
- [Audit Coverage](project-audit-coverage.md) — 2026-08-13: audit_logs (migr 0051) expanded to ~20 more endpoints; BUILT+E2E local, not deployed
- [Attendance Manual Grid](project-attendance-manual.md) — 2026-08-13: SA monthly grid (SEs×days, GPS-prefilled), migr 0061; BUILT+E2E, not deployed
- [Orders Search + Download](project-orders-search-download.md) — 2026-08-12: Orders live debounced search + instant filters + PDF/Excel download; BUILT, needs API deploy
- [Margin Simulator](project-margin-simulator.md) — 2026-08-11: SA oils margin sim (1:1 xlsx), save/reopen (migr 0060); BUILT+9 tests, not committed
- [BUSY Integration — ABANDONED](project-busy-integration-pending.md) — 2026-08-11: BusyWin dropped; build native Stock Journal (migr 0055) + GST instead
- [Photo Dark Watermark Fix](project-photo-dark-watermark-fix.md) — 2026-08-10: all-dark stamped photos = view-shot capture race; fix 2 rAFs+120ms before captureRef; needs APK
- [Cron Cost Window](project-cron-cost-window.md) — 2026-08-09: Neon ~$30→$12/mo by gating */3 cron to IST Mon-Sat 08:55-21:05; not committed
- [Offline Ledger (bulk)](project-offline-ledger-bulk.md) — 2026-08-09: Phase1 offline-first ledger (bulk /customers/ledgers/bulk + on-device slice); not committed; Phase2 = bulk orders
- [Customer Notes](project-customer-notes.md) — 2026-08-09: append-only notes per customer (SE+office add, SA edit/del); migr 0058; API deployed, needs APK
- [Customers Contacts List](project-customers-contacts-list.md) — 2026-08-08: Customers tab → A–Z contacts list w/ live search; app-only
- [Mobile Shimmer](project-mobile-shimmer.md) — 2026-08-08: context-aware skeleton, 5 presets, cache-only; not committed, needs APK
- [Logistics Location Pin](project-logistics-location-pin.md) — 2026-08-08: map pin on each Pick-invoice card; not committed, needs APK+deploy
- [Photo Watermark/Size/R2-Cold](project-photo-watermark-size-r2cold.md) — 2026-08-08: stamp title→customer name, output 1080px/q0.6, R2 puts→Infrequent Access; not committed
- [Optional MOP](project-optional-mop.md) — 2026-08-08: MOP optional in price master (MRP required); migr 0057; invoicing treats null-MOP as unpriced; not committed
- [Ledger FIFO Unpaid](project-ledger-fifo-unpaid.md) — 2026-08-08: Sale status FIFO: only oldest partial invoice shows "Partially paid"; not committed
- [SE Leaderboard](project-se-leaderboard.md) — 2026-08-08: mobile peer leaderboard by oil litres (Today/Week/Month); GET /leaderboard; not committed, needs deploy+APK
- [Live-Tracking Upload Fix](project-tracking-live-upload.md) — 2026-08-08: live map lag fixed (native self-POST, heartbeat bug, watchdog, apiFetch timeout wedge); needs APK A/B
- [Ledger Entry Editing](project-ledger-edit.md) — 2026-08-07: SA edit of all ledger entry types w/ auto-recompute; BUILT+UI-verified, save paths untested live
- [Stock / Inventory](project-stock-inventory.md) — 2026-08-07/11: own /stock Stock Journal (Products=pure catalogue); 5 add-types (migr 0059); BUILT, not committed
- [Walk-in Invoicing (pending)](project-walkin-invoicing-pending.md) — 2026-08-06 DEFERRED: manual invoicing → walk_in_customers; SPECCED → docs/PENDING-WALKIN-INVOICING.md
- [Invoicing Build](project-invoicing-build.md) — 2026-08-05: in-app invoicing to replace BusyWin (Phase1 oils); migr 0053; price master 57/74 SKUs; ≤100 lines/file
- [Invoice PDF Tab Title](project-invoice-pdf-tab-title.md) — 2026-08-05: blob URL removed (same-origin proxy); DEFERRED: viewer header still "Invoice" (needs pdf-lib /Title)
- [Shared-Account Logout Bug](project-shared-account-logout-bug.md) — 2026-08-05: logout on shared field account killed live GPS; fixed (server refuses to end a pinging session + mobile local-only logout)
- [Reports + Emails](project-reports-emails.md) — 2026-08-28: 9PM email DELETED (react-email later); reports page = from–to picker (default today) + per-report Excel/PDF download; every reports file split <100 lines; verified live, UNCOMMITTED needs api+web deploy
- [Section Badges](project-section-badges.md) — 2026-08-01: "new since you last looked" sidebar counters for Orders+Collections (section_seen, migr 0048); DEPLOYED
- [Assign Tasks to SE](project-assign-tasks-to-se.md) — 2026-08-01: office assigns tasks to SE w/ date+time → SE Reminders; migr 0047; DEPLOYED, needs commit+APK
- [Customer Reassignment (pending)](project-customer-reassignment-pending.md) — 2026-07-31 SPECCED: SA move customer ownership to another SE → docs/PENDING-CUSTOMER-REASSIGNMENT.md; CUST-0006 already moved
- [Fuchs Catalogue & Segments](project-fuchs-catalogue-segments.md) — 2026-07-26: oils→58 Fuchs (7 segments, per-product packs); bearings→1830 Texspin+searchable; orders wiped
- [Photo Stamping (pending)](project-photo-stamping-pending.md) — 2026-07-25 SPECCED: burn address+date/time onto SE/Logistics photos → docs/PENDING-PHOTO-STAMPING.md
- [User Management](project-user-management.md) — 2026-07-24: SA edit users + SET (never show) passwords; no delete; account-reuse handover
- [Expenditures](project-expenditures.md) — 2026-07-24: Expenditure section (migr 0040): compulsory-vs-variable by category, bills, per-person fuel/food; 3 office roles r+w
- [Expenditure Analytics (pending)](project-expenditure-analytics-pending.md) — 2026-07-24 SPECCED: charts + period comparison → docs/PENDING-EXPENDITURE-ANALYTICS.md
- [Dues Buckets](project-dues-buckets.md) — 2026-07-24: collection-dues ageing 0-30/30-45/45-60/60+ by oldest unpaid invoice; daily 9AM IST cron → SE push
- [Collection Receipts](project-collection-receipts.md) — 2026-07-24: SE receipt photos on web Collections detail (Accountant+SA only, big-image dialog)
- [Invoices Section](project-invoices-section.md) — 2026-07-23: upload+parse BAL invoice PDFs (web pdf.js); outstanding driven by invoices; SE notif + WhatsApp share
- [SKU Analytics](project-sku-analytics.md) — 2026-07-23: billed-SKU dashboard analytics (from invoices); DEPLOYED; brand roll-up empty until product brands filled
- [Brands & Filters](project-brands-and-filters.md) — 2026-07-23: mandatory per-category Brand + Filters category + order snapshots (migr 0033); deployed
- [Admin Dashboard](project-admin-dashboard.md) — 2026-07-20: SA/Mgr live metrics + 2-level drill-downs; old dashboard read a dormant table
- [Tracking Screen-Off](project-tracking-screen-off.md) — 2026-07-21: Android bg-GPS: wake-alarm not Handler, BALANCED not HIGH_ACCURACY indoors, bg-perm false-alarm
- [7PM Cutoff & Check-in](project-7pm-cutoff-checkin.md) — SE tracking auto-stops 7PM IST (3-layer, Logistics exempt) + customer Check-in feeds dashboard Visits
- [Fulfillment](project-fulfillment-pending.md) — Order→Invoice→Delivery w/ PARTIAL delivery (migr 0043/0044); Phases 1-3 DEPLOYED; only logistics "Delivered" pick (APK) left
- [SE Targets](project-se-targets.md) — weekly+monthly actual-vs-target (migr 0036); dashboard Targets card + mobile Home; API deployed
- [Logistics Delivery](project-logistics-delivery.md) — LOGISTICS mobile delivery-run (migr 0018) + logistics@test.com; network-first
- [Alerts & Reminders](project-alerts-reminders.md) — SE mobile Reminders tab (local exact-time notif, needs USE_EXACT_ALARM); Alerts bell scaffolded
- [Collection Types](project-collection-types.md) — Advance vs General collections + computed credit-balance (migr 0016); net can go negative
- [Bearings](project-bearings.md) — bearings alongside oils (migr 0019/0020): part_no; qty a plain number. NOTE: MOQ was REMOVED later (2026-08, migr 0068/0069)

---

# Full memory entries

## feedback-git-rules.md

---
name: feedback-git-rules
description: "Git rules for this project — never stage with -A or ., never push without asking"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 034d7518-f6ad-43fb-ac03-18b5dd0aff50
---

Never use `git add -A` or `git add .` — always stage specific files by name.

**Why:** Risk of accidentally committing sensitive files (.env, credentials) or unrelated changes.

**How to apply:** When staging files for commit, always list them explicitly: `git add apps/web/src/features/foo.tsx apps/api/src/routes/bar.ts`.

Never `git push` without first asking the user to confirm.

**Why:** Push affects the shared remote; user wants to review what's being pushed before it goes out.

**How to apply:** After preparing a commit, stop and ask "Ready to push?" before running any push command.

---

## feedback-nativewind-shadow-crash.md

---
name: feedback-nativewind-shadow-crash
description: Mobile gotcha — toggling a NativeWind shadow class on/off between renders crashes the debug app
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-07T18:23:13.451Z
---

In `apps/mobile` (Expo SDK 57, NativeWind 4, React Compiler on, Hermes), applying a **shadow utility class conditionally** so it toggles between renders — e.g. `className={on ? "bg-card shadow-sm" : ""}` on a segmented-control button — sends the **local debug build into an infinite `replace`-recursion → stack overflow**, surfacing as a misleading **"Couldn't find a navigation context. Have you wrapped your app with 'NavigationContainer'?"** Render Error (thrown from `NavigationStateContext.getKey`, blamed on whatever component was rendering). Initial render is fine; the crash fires on the FIRST re-render that flips the shadow class.

**Why:** NativeWind's Android shadow→elevation interop chokes when the shadow class appears/disappears across renders. The nav-context error is a red herring (the stack overflows wherever it happens to be). Cost a very long debug session on 2026-08-07 building the Alerts-tab segment toggle.

**How to apply:** Never put a shadow class (`shadow-sm`/`shadow`/`shadow-md`) in a conditional/toggled `className`. For an active-segment pill, distinguish with background only (`on ? "bg-card" : ""`) — mirrors the working `performance-card.tsx` Today/Week/Month toggle, which has NO shadow. If you see "Couldn't find a navigation context" on a screen that clearly IS inside the navigator and it only appears after a state-driven re-render, suspect a toggled shadow (or other Android-only NativeWind interop) before touching navigation. See [[project-mobile-rebuild]], [[project-alerts-reminders]].

---

## project-7pm-cutoff-checkin.md

---
name: project-7pm-cutoff-checkin
description: SE 7 PM IST tracking cutoff (End-day button removed) + customer-screen Check-in button (2026-07-23)
metadata: 
  node_type: memory
  type: project
  originSessionId: eafa86c5-123e-4b58-8774-68f5e559440d
  modified: 2026-09-11T08:08:53.314Z
---

**UPDATE 2026-09-11: cutoff moved 7 PM → 8 PM (SE only; Logistics unchanged).** Changed 19→20 everywhere (both tracking auto-stop AND beat 'missed' day-end, per user): API `tracking-sessions.ts` `trackingCutoffHour`→20 (central — ingestion `visits.ts` now CALLS it instead of hardcoding; session-start guard + DAY_ENDED msg), `tracking-maintenance.ts` cron `20:00`/`server_8pm_closure`, `location-nag.ts` nag window `20:00`, `beat-missed.ts` `<20`, `customer-visits.ts` missed-settle `interval '20 hours'`/`>=20`. Mobile `gps-config.ts` + `sync-engine.ts` `DAY_END_HOUR_IST=20`, `beat/stop-status.ts` `=20`, `start-day-flow.ts` copy "until 8 PM"; native reads the JS-passed `cutoffHourIst` (no Kotlin recompile of logic needed). Tests updated (tracking-cutoff/maintenance/route) — api 78/78, mobile 45/45, tsc clean. NEEDS: api deploy + mobile new bundle (OTA/APK). Everything below still describes the OLD 7 PM design — read 19 as 20 now.

Two SE mobile features built 2026-07-23:

**7 PM cutoff (SEs only, NOT Logistics):**
- End-day button removed from mobile Home; Start-day kept (blocked after 7 PM with a dialog). Day tile shows "Day on · tracking until 7 PM".
- Enforced in 3 layers: (1) JS `gps.ts` — `isPastDayEnd()` (role-gated to SALES_EXECUTIVE via auth store; Logistics share the module for delivery runs), drops late fixes, watchdog + interval stop tracking; (2) native `ForegroundLocationService.kt` — `cutoffHourIst` intent extra (19 for SE, -1 for Logistics) checked on every alarm wake-up, so it stops even with the app swiped away; (3) server — `trackingCutoffHour(role)` = 19 for SE / 21 others in `tracking-sessions.ts` (start rejected with `DAY_ENDED`, per-point `AFTER_ALLOWED_END_TIME`), same filter in `visits.ts` batchGpsPings, and the */3-min cron (`tracking-maintenance.ts`) closes active SE sessions at 19:00 local (`server_7pm_closure`), others at 21:00.
- `clearAuthOnClosure` flipped to **false** — server closure now stops tracking but keeps the SE logged in (orders/collections still work after 7 PM). NOTE: APKs built before this change log the SE out at closure; the fix ships with the next EAS build.
- Offline backlog is safe: points *recorded* before 19:00 IST sync fine after hours; only points stamped ≥19:00 are dropped.

**Check-in button (customer detail screen):**
- Single-tap, one visit per customer per IST day via existing `ensureTodayVisit` (sync-core) + `getCheckInFix()`; offline-first through the sync queue → `POST /visits/checkin` (unplanned visit). Button flips to "Visited today ✓" (also when a sale auto-recorded the visit). Feeds the SA/Manager dashboard "Visits" tile (dashboard-metrics counts `visits` by `visit_date`) — verified end-to-end on prod.

API deployed 2026-07-23; mobile needs a new EAS APK (native change → full build, not OTA).

**Logistics cutoff REMOVED 2026-08-03** (branch `feat/logistics-no-cutoff-pull-refresh`, uncommitted): Logistics now have NO tracking cutoff — a delivery run ends ONLY when the driver manually ends it, even past midnight. `trackingCutoffHour(role)` now returns 19 for SE / **null** for everyone else (was 21); `isPastTrackingCutoff` + `isAfterAllowedEndTime` treat null as no time/day limit (so cross-midnight points are accepted, not `AFTER_ALLOWED_END_TIME`-rejected). `visits.ts` batchGpsPings: no drop for Logistics + attaches points to the user's ACTIVE session first (cross-midnight = ONE continuous session, not split); `endGpsSession` ends the active session regardless of session_date. Cron (`tracking-maintenance.ts`) auto-closes **only** SE at 19:00 (`server_7pm_closure`); Logistics never auto-close. SE 7 PM behavior unchanged. Client already exempted Logistics (isPastDayEnd false for non-SE, native cutoff -1) so no mobile change needed for this. The 15-min stale-interruption alert still applies to everyone. Needs API deploy.

**Check-in requires day started (2026-08-08):** `onCheckIn` in `app/customer/[id].tsx` now gates on `await isDayTracking()` (active tracking today, pre-7PM) — if off, a "Start your day first" dialog offers **Start day** (runs the flow inline) or **Not now**; check-in blocked until the day is on. Requires an ACTIVE day (post-7PM auto-end also blocks, user's choice). App-side only (visit never created). Extracted `lib/start-day-flow.ts` `runStartDayFlow(confirm)` (past-7PM guard → `runStartDayPermissionSetup` → `startDayTracking` + error dialogs); Home `index.tsx` onStartDay refactored onto it (delivery.tsx left as-is). Updated `android-native-tracking.test.ts` source-assertion (start screen now asserts `runStartDayFlow`; the wizard call moved to start-day-flow.ts). Mobile-only, no API; needs new APK. Note: this is distinct from the older removed gate below (which blocked order/collect/market until check-in — that stays removed).

**Check-in gate — REMOVED 2026-07-24:** the 2026-07-23 gate (Add order / Collect / Market disabled until check-in) was reverted at the user's request — all three actions now work with or without a check-in; only the credit gate can block ordering. The Check in button, its 100 m geofence, and the no-auto-visit rule (visits come ONLY from explicit check-ins) all remain — meaning an SE can sell without a visit counting, visible to managers as orders-without-visits.

**Geofence (2026-07-24):** check-in requires (distance − GPS accuracy) ≤ 100 m from the customer's saved location — `lib/geo.ts` (`checkInFence`, 8 unit tests), enforced in `onCheckIn` on the customer page. App-side only (user's choice, matches the gate). Blocked → "Too far from the shop — you're about X km/m away" dialog with Try again. Customers WITHOUT saved coords: first check-in is allowed and self-heals — saves the fix locally + best-effort PATCH /customers/:id. Data plumbing: `GET /customers` now returns latitude/longitude (deployed), local `customers` table gained latitude/longitude columns (alter in migrateLocalDb), customer-directory sync stores them. Verified on emulator: 181 km → blocked, at-shop → allowed.

---

## project-admin-dashboard.md

---
name: project-admin-dashboard
description: Super-Admin/Manager live metrics dashboard with 2-level drill-downs (built 2026-07-20)
metadata: 
  node_type: memory
  type: project
  originSessionId: 327fa338-d598-4d60-a89b-b1689f48ddbe
  modified: 2026-07-20T09:16:09.711Z
---

**Super-Admin / Manager dashboard rebuilt 2026-07-20** with six live metric cards + two-level drill-down dialogs. Identical for both roles; ACCOUNTANT keeps the old cards.

**Key discovery:** the old dashboard read `daily_executive_performance` — a table only the **dormant** executive-day flow writes, so it showed **zeros for all real trial data**. Everything now computes live from `visits`, `orders`/`order_items`, `collections`, `customer_photos`, `gps_tracking_sessions`.

**Metrics** (definitions decided with user): Active Executives (`live/total` — GPS session today AND last ping <12 min, same rule as Live Tracking) · Visits · **Productive Visits** (visit where the same SE+customer has an order OR collection OR market-intelligence photo that date) · Sales—Oils (litres) · Bearings (quantity as entered; pieces never shown) · Collections (ALL statuses in the total, `verified` shown separately).

**API** (`apps/api/src/services/dashboard-metrics.ts`, routes in `dashboard.ts`, SUPER_ADMIN+MANAGER):
- `GET /dashboard/metrics?from&to` — the six totals
- `GET /dashboard/metrics/:metric/agents?from&to` — level 1, per-SE
- `GET /dashboard/metrics/:metric/agents/:agentId/customers?from&to` — level 2, per-customer
- metric keys: `executives|visits|productive|litres|bearings|collections`; `from`/`to` default to today IST; invalid range or unknown metric → 422. Tests: `dashboard-metrics.test.ts` (10).

**Web** (`apps/web/src/features/dashboard/metrics-dashboard.tsx`, `"use client"`): 6 clickable cards, Today/Week/Month segmented control + shadcn Calendar range popover, 60s auto-refresh, Dialog with agent list → customer breakdown (‹ back). Passed into `DashboardExperience` via an optional `metrics` prop; when absent (ACCOUNTANT) the legacy cards + executive table render instead. NOTE: `PopoverTrigger` here does NOT support `asChild` (Base UI) — style the trigger directly, as `orders-list.tsx` does.

**Verified live** against real trial data (Month range): 739.5 L across 6 orders, 105 bearings, ₹43,000 collections; drill-downs matched exactly (Bhaskar 317 L = 14+50+152.5+100.5; collections Bhaskar ₹23,000 + Vishnu ₹20,000 = ₹43,000).

**Test-suite note:** `apps/web/vitest.config.ts` previously lacked the `@/* → ./src/*` alias, so 3 test files silently failed to load. Added the alias; `dashboard-experience.test.tsx` was rewritten for the current UI (it still asserted a long-removed "Super Admin Control Tower" screen). Remaining **pre-existing** stale failures: `login-experience.test.tsx` + `super-admin-setup.test.tsx` (2 files, 5 assertions) — they also target removed UI and are unrelated to this work. Web went 3 failed files → 2. Non-test-matcher typecheck errors: 0. API 260 tests green.

**Product & Customer Analytics tables (built 2026-07-20, below the metric cards, same period switcher):**
- API: `services/dashboard-analytics.ts` + routes `/dashboard/analytics/oils`, `/analytics/bearings`, `/analytics/customers` (`?from&to`, `&includeInactive=true`). Tests: `dashboard-analytics.test.ts` (8).
- **Oils** roll up by the ORDER-LINE segment (what the SE picked), expandable inline to **product + pack-size SKUs**. That grain matters: "Titan Formula 5W-30 SP" alone sells in 5 pack sizes (3.5/3/1/5/4.5 L) — product-only would hide it. All 7 canonical segments always render; zero ones greyed with "—". Segment totals use their own query (orders/customers must be DISTINCT per segment, not summed from SKUs).
- **Bearings**: flat part list, quantity as entered (never pieces).
- **Customers**: active-only by default (216 exist, ~6 transact; **202 have no owning SE** from a bulk import → SE column "—"), a "Show inactive (N)" toggle, every column client-sortable. **NO dues/outstanding column** — invoices table is empty, invoice upload isn't built, and SE orders carry no price, so any ₹ owed figure would be fabricated. Only Collected ₹ + Pending (awaiting verification).
- Web: `features/dashboard/analytics-tables.tsx`, rendered from `metrics-dashboard.tsx` so it shares `range`.
- Verified live: Cars expands to 7 SKUs summing exactly 532; total 739.5 L reconciles with the metric card; sort flips 415↔7.5; toggle 6→216 rows.
- Gotcha hit: `dashboard-experience.test.tsx` broke because "Bearings" now appears twice (metric card + customer column) — assert on the card's value instead of the label.

Not deployed yet. See [[project-field-trial]].

---

## project-alerts-reminders.md

---
name: project-alerts-reminders
description: SE mobile Alerts (bell) + Reminders (tab) feature — reminders shipped w/ exact local notifications; alerts feeds deferred (2026-07-17/18)
metadata: 
  node_type: memory
  type: project
  originSessionId: eda7d8d0-d4fd-4f51-b3b7-1bae7bfc6978
  modified: 2026-07-24T22:02:49.761Z
---

**Alerts & Reminders** added to the SE mobile app (built 2026-07-17, verified 2026-07-18). Full plan/decisions in `docs/ALERTS-REMINDERS.md`.

**Reminders (SHIPPED):** new bottom tab between Customers and Settings (⏰). Personal, **local-only** reminders — title + exact date/time + optional linked customer. Backed by scheduled OS notifications (`expo-notifications`); rings like an alarm with app closed / no internet. Data in device SQLite `reminders` table (local schema **v12**). Code: `src/lib/reminders.ts` + `src/app/(tabs)/reminders.tsx`. Notification handler + tap→customer routing wired in `src/app/_layout.tsx`. Tapping a reminder notification opens the linked customer. Tests: `src/lib/reminders.test.ts` (3 tests; mock expo-notifications + migrateLocalDb on the node-sqlite test db).

**CRITICAL for exactness (Android 14+):** without an exact-alarm permission, Android downgrades the schedule to an inexact ±5-min window (observed ~5 min late in trial). Fixed by adding `USE_EXACT_ALARM` + `SCHEDULE_EXACT_ALARM` to app.json android.permissions. Verified via `adb shell dumpsys alarm`: alarm now shows `window=0 exactAllowReason=policy_permission` (was `window=+5m27s`). `USE_EXACT_ALARM` auto-grants on install — fine for direct-APK distribution; Google Play would restrict it to alarm/calendar apps. Config plugin: `expo-notifications` block in app.json (monochrome icon + `defaultChannel: "reminders"`). Also installed `@react-native-community/datetimepicker`.

**Alerts (SCAFFOLDED, feeds deferred):** Home header bell (🔔, top-right) **replaced the old "Synced" chip** — amber dot when sync needs attention; opens `src/app/alerts.tsx`. Sync status moved to Settings. Alerts screen shows sync-attention banner + two empty-state feed sections: "Collections due" (ageing) and "New invoices". **Deferred per user (2026-07-17):** (1) accountant invoice upload on web — not designed yet; (2) new-invoice alert on mobile with **share = the invoice PDF/photo** via Android share sheet (expo-sharing) to SE's own WhatsApp; (3) ageing-collection rule — day thresholds NOT decided yet.

**On-time fix round 2 (2026-07-25):** user still saw late reminders on a real device even though the exact-alarm permissions (above) were present — verified via `dumpsys alarm` that the scheduled alarm IS exact (`window=0 exactAllowReason=policy_permission flags=0x9` = ALLOW_WHILE_IDLE). Root cause of remaining lateness = **battery-optimization / OEM Doze** killing background alarms. The reminder-creation flow (`src/app/reminder/new.tsx onSave`) only requested POST_NOTIFICATIONS; it never ensured battery-opt exemption or re-checked exact-alarm (only the Start-day flow did, via native `NativeTracking`). Fix: new `ensureReminderDelivery(confirm)` in `src/lib/permissions.ts` (checks `canScheduleExactAlarms` → `openExactAlarmSettings`, and `isIgnoringBatteryOptimizations` → `requestIgnoreBatteryOptimizations`; auto-skips when granted, non-blocking), called in `new.tsx` after the notification-permission gate. **Logout now wipes local cache too:** `clearAllLocalData(db)` in `src/lib/local-db.ts` (deletes every local table) + cancel/dismiss scheduled notifications, wired into `useAuth.logout()` in `src/lib/auth.ts` — previously logout only cleared the SecureStore token, leaving the prior SE's cached data for the next login (verified: `performance_cache` 2→0 on logout). App uninstall already wipes everything via the OS. Code changes NOT yet in an APK.

**Native modules → needs APK rebuild + dev-client rebuild** (expo-notifications + datetimepicker). Verified on emulator via `npx expo run:android` (needs `JAVA_HOME`=Android Studio jbr + `ANDROID_HOME`=~/Library/Android/sdk since neither is on the shell PATH). All tests green (mobile 65, API 250, web tc clean). See [[project-field-trial]].

**Monochrome icons (2026-07-18):** all colourful emoji icons across the app replaced with monochrome Ionicons via `@expo/vector-icons` (new dep) + a `src/components/icon.tsx` wrapper (`<Icon name size color/>`). Covered: SE + logistics tab bars (home/people/alarm/settings/cube — active tint kept the app blue `#3b82f6`, inactive grey `#9ca3af`), Home 🔔 bell, reminder ⏰, camera/gallery/location/phone/lock/cart, error/warning banners. Remaining ✓ ✕ ✎ ⚠ are monochrome text glyphs (left as-is). Verified live on emulator. API deployed 2026-07-18 (version d27cd6f1) — this deploy finally shipped the earlier-interrupted gps/end endpoint + on-conflict dedupe insert (the 2026-07-17 deploy predated them). New APK built same day with all of it.

---

## project-animated-swap.md

---
name: project-animated-swap
description: framer-motion added to apps/web + reusable AnimatedSwap wrapper for smooth shimmer→data cross-fade + height ease in dashboard drill-down dialogs.
metadata: 
  node_type: memory
  type: project
  modified: 2026-09-07T07:07:50.167Z
  originSessionId: 0f5fcc13-0b06-4233-bc4a-f22ce737e455
---

**2026-09-07 (UNCOMMITTED, needs web deploy).** Fixed the jarring size-snap when a dashboard stat-card drill-down dialog swapped its fixed-size shimmer for shorter fetched data. User chose: **cross-fade + smooth resize (~450ms), keep shimmer rows, apply to all dashboard drill-downs.**

- **Added dependency:** `framer-motion` ^13.2.0 in `apps/web` (React 19 compatible).
- **New reusable component:** `apps/web/src/components/ui/animated-swap.tsx` → `<AnimatedSwap swapKey={...}>`. Cross-fades children via `AnimatePresence mode="popLayout"` (opacity) while easing the container **height measured with a ResizeObserver** (animates CSS `height`, NOT framer layout-scale, so children never distort). Respects `prefers-reduced-motion` (via `useReducedMotion`). `duration` prop defaults 0.45s, ease `[0.22,1,0.36,1]`. Change `swapKey` whenever content meaningfully changes.
- **Wired into:** `metrics-drilldown-dialog.tsx` (the 6 activity cards' agents↔customers + loading states; swapKey encodes level+load/data/error) and `dues-drilldown.tsx` (Collection Dues buckets → customer list; swapKey load/empty/data/error). See [[project-dashboard-finance-cards]] for the dashboard's current card set.
- Verified: tsc/lint clean, drilldown-skeleton test (7) passes. **VISUALLY VERIFIED in-browser** via a throwaway public harness page (`app/anim-check`, since deleted) reproducing the exact tall-shimmer→short-data case: measured the #swap-box height easing 261→170→136→…→106px over ~330ms (ease-out, no snap), and detected the cross-fade as two overlapping elements at opacity 0.46/0.54 mid-transition. Harness deleted after. (Auth is per-page, no middleware, so a page without requireSessionRole is public — usable for future UI verification without login.)

---

## project-app-package-id.md

---
name: project-app-package-id
description: "Mobile Android package id is com.vardhansystems.sriaparajita (permanent store identity, set 2026-08-01 for Indus App Store) — was the Expo default com.anonymous.mobile."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a8263a9-b31c-43d3-becd-1cb8753fd52c
  modified: 2026-08-01T00:50:36.880Z
---

The Beyond SE app's Android **package id = `com.vardhansystems.sriaparajita`** (set 2026-08-01, replacing the Expo default `com.anonymous.mobile`) for the **Indus App Store** release. This is the permanent store identity — do NOT change it again.

Set in only two runtime places (`android/` is gitignored + EAS-regenerated; the `withNativeTracking` plugin is package-agnostic and writes Kotlin under the app package automatically):
- `apps/mobile/app.json` → `expo.android.package`
- `apps/mobile/google-services.json` → must contain a client for `com.vardhansystems.sriaparajita`

**Firebase:** the `beyond-distribution` project (number 404860333067) now has TWO Android apps registered — the old `com.anonymous.mobile` and the new `com.vardhansystems.sriaparajita` — both in `google-services.json`. The gradle Google-Services plugin matches by applicationId, so FCM push works for the new package. Changing the package again would silently break push until a matching Firebase app + google-services.json exist.

**Keystore:** changing the package triggered EAS to generate a NEW cloud keystore for `com.vardhansystems.sriaparajita`. EAS manages it; every future release must keep using it (automatic). It is the signing key the Indus store will pin.

**Consequences:** the old sideloaded `com.anonymous.mobile` APK is a *different app* — it won't update to the new one; SEs must uninstall the old and install the new.

First store build: id 71046d53-1a6e-4ac2-b567-d8e9a7f91e6b, versionCode 2, APK finished 2026-08-01. Build cmd + release steps: [[project-mobile-apk-size]] and apps/mobile/BUILD_GUIDE.md.

---

## project-assign-tasks-to-se.md

---
name: project-assign-tasks-to-se
description: "2026-08-01 — Office (SA/Manager/Accountant) assign tasks to an SE from web New Task dialog → appear in SE mobile Reminders \"Assigned to you\"; built, not yet deployed/APK'd"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a8263a9-b31c-43d3-becd-1cb8753fd52c
  modified: 2026-07-31T23:17:34.838Z
---

Feature: SUPER_ADMIN/MANAGER/ACCOUNTANT assign a task to a Sales Executive from the web **New Task** dialog; it surfaces in the SE mobile **Reminders** tab and rings on their phone at the set time. Reuses the existing office `tasks` table (no new table) + the invoice/dues Expo-push path.

**Decisions (user-approved):** one SE per task · **date + time** (exact-time ring, entered in IST) · **two-way status** (SE marks done → web shows done) · **push on assign** · SE can **mark done but NOT delete** · shown as a separate **"Assigned to you"** section with title + note + customer + priority.

**DB — migration `0047_task_se_assign.sql` (APPLIED to DB):** `tasks.remind_at timestamptz` (null for office to-dos; set = the SE ring instant), index `tasks(assigned_to,status,remind_at)`, `se_notifications.task_id` FK (deep-link the push). Applied via `postgres` driver with `{max:1}` (begin/commit needs a single connection).

**API (`apps/api`) — deployed? NO (user deploys):**
- `listTaskAssignees` now returns office roles **+ active SALES_EXECUTIVE** (role field lets web group/require time).
- `createTask`/`updateTask` take `remindAt`; return `{task, push}`. `notifyAssignedSe` inserts `se_notifications` (type `task_assigned`) + returns Expo tokens when assignee is an SE; route fires `sendExpoPush` via `c.executionCtx.waitUntil`. Update only notifies when `assignedTo` is explicitly (re)assigned.
- New SE endpoints in `routes/me.ts`: `GET /me/tasks` (assigned, remind_at not null, open/in_progress + done<2days), `POST /me/tasks/:id/done` (two-way). 367 API tests pass.

**Web (`apps/web/features/tasks`) — deployed? NO:** `Task.remindAt`; New Task dialog groups assignees (Office / Sales executives), shows a required **Reminder time (IST)** input when an SE is picked, converts date+time→ISO with `+05:30`, sends `remindAt`; detail drawer shows an amber reminder banner (`formatReminder` IST) + "Marked done" time.

**Mobile (`apps/mobile`) — needs a NEW APK:** local-db **v17** + `assigned_tasks` cache table; new `src/lib/assigned-tasks.ts` (reconcile server list ↔ cache ↔ scheduled OS notifications on the `reminders` channel; `markAssignedTaskDone`); `sync-core` entity `task_done` + `enqueueAssignedTaskDone`; `sync.ts` pulls `/me/tasks` in kickSync + `refreshAssignedTasksNow()` (Reminders focus) + `task_done` queue case (404→treat done); Reminders tab "Assigned to you" section (Mark done only, no delete); `_layout` routes `assigned_task`/`task_assigned` notification taps → `/reminders`. `done_synced=0` = offline done pending upload, reconcile won't resurrect it. 111 mobile tests (8 new) pass.

**VERIFIED E2E 2026-08-01** (API+web deployed by user; mobile on emulator dev build, SE=Sandeep): web grouped dropdown + reminder-time field + drawer banner ✓; DB remind_at (IST→UTC) + task_assigned se_notification + push token targeted ✓; mobile Reminders "Assigned to you" card (title/note/time/assigned-by/priority) + Alerts push badge ✓; Mark done → vanishes on device → web Done tab shows it done (two-way) ✓. QA tasks deleted after (se_notifications cascade).

**Follow-up 2026-08-01 (Tasks UI + delete):** New Task dialog rebuilt on the app design system — shadcn `Dialog`/`Select`/`Textarea` + shared `TextField`, grouped assignee Select (Office / Sales executives, `NONE` sentinel since Radix bans empty value), **searchable customer picker** via `features/orders/search-select` `SearchSelect` (+ Clear), and a cohesive SE **reminder block** (bordered, date+time, live IST preview "Rings at …"). Priority `SelectValue` needs explicit capitalized children (Radix shows raw value otherwise). New **DELETE `/tasks/:id`** (`deleteTask`): creator-only + only done/cancelled (404 non-creator, 409 if not finished), deletes R2 attachment blobs then row (comments/attachments/se_notifications cascade). Drawer shows a red "Delete task" → inline confirm → permanent delete (creator + finished only); `onTaskDeleted` removes it from the list. API 370 tests pass; web dialog verified in browser (grouping, search, SE block+preview, submit). NOTE web has 7 PRE-EXISTING failing tests (auth/dashboard/super-admin jest-dom setup) — not mine.

**Remaining:** commit + deploy the API (delete endpoint not deployed yet — delete execution untested E2E) + web; build a new **APK** so production SEs get the mobile side (only the emulator dev build has it). Related: [[project-alerts-reminders]] (personal local reminders, unchanged), [[project-invoices-section]] (push path reused).

---

## project-attendance-manual.md

---
name: project-attendance-manual
description: "Attendance page upgraded — SUPER_ADMIN can manually set per-SE-per-day status on a monthly grid (present/absent/half_day/leave/week_off), pre-filled from GPS tracking"
metadata: 
  node_type: memory
  type: project
  originSessionId: 62e3d7c6-d6a4-498b-9f38-eea58c1f2635
  modified: 2026-08-13T17:34:53.263Z
---

2026-08-13: The Attendance page (`/dashboard/attendance`) gained a **manually-editable monthly grid** on top of the existing read-only GPS-derived view. Client wanted to hand-set attendance per SE.

**Decisions (from user):** statuses = present / absent / half_day / leave / week_off · pre-fill from GPS tracking (tracked day → Present, past untracked day → Absent, future = blank/locked) · monthly grid (SEs × days) · SEs only · **edits SUPER_ADMIN only, view stays all 3 office roles** · past + today only (no future) · optional note per cell.

**Data:** migration `0061_attendance.sql` → `attendance` table (user_id, attendance_date, status check-constraint, note, updated_by, unique(user_id, attendance_date)). **Already applied to the prod Neon DB.** A row = a manual OVERRIDE; no row = use the tracking-derived status. Effective status computed in JS (override wins, else tracked→present / past-untracked→absent / future→null).

**API** (`services/attendance.ts` + `routes/attendance.ts`, both extended, old daily/monthly kept): `GET /attendance/grid?month=` (office roles) returns every active SE × each day {status, manual, tracked, note}; `PUT /attendance` (SA only, body userId/date/status/note, guards future date + active-SE); `DELETE /attendance?userId=&date=` (SA only) clears an override.

**Web** (`features/attendance/`): new `attendance-grid.tsx` (horizontal-scroll grid, sticky SE column, coloured status cells P/A/H/L/W, manual cells get a `ring-inset` indicator, Sundays tinted, today highlighted, per-row totals, month prev/next, legend; click a cell → compact `CellEditDialog` with 5 status buttons + note + Clear-override). `attendance-view.tsx` now shows tabs **Monthly** (the grid, default) + **Daily** (existing roll-call); the old per-SE `attendance-monthly.tsx` is now UNUSED dead code (safe to delete later; `/attendance/monthly` endpoint also now unused).

**Status:** BUILT, tsc-clean, 428 API tests pass, E2E-verified on localhost (create leave+note → persists to DB → clear override → reverts to derived Absent). Migration applied to prod DB; **API + web NOT yet deployed**, not committed.

---

## project-audit-coverage.md

---
name: project-audit-coverage
description: "Audit-log coverage — the existing audit_logs system + the 2026-08-13 expansion that closed the gaps (financial, account, content, SE-field actions)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 62e3d7c6-d6a4-498b-9f38-eea58c1f2635
  modified: 2026-08-13T18:41:22.733Z
---

**Audit infra (pre-existing):** `audit_logs` table (migration `0051`, cols: actor_user_id + snapshotted actor_name/actor_role, action dotted-verb, entity_type/id/label, summary, metadata jsonb, created_at). `logAudit(sql, actorOf(auth), {action, entityType, entityId, entityLabel, summary, metadata})` in `services/audit.ts` — best-effort, inline AFTER the action commits (swallows its own errors). Read-only Audit Logs page (`/dashboard/audit-logs`, SUPER_ADMIN only) — server-paged with filters (search / actor / entityType / action / date range); the action filter auto-derives distinct actions from the table, so NEW action verbs appear automatically — no web change needed when adding audit points.

**2026-08-13 coverage expansion** (client: "audit logs for all pages/functions"). Decided scope: add the meaningful gaps, EXCLUDE high-volume GPS/telemetry (pings/heartbeats/checkin-out/day-start-stop in visits.ts, tracking-sessions.ts, and executive-day's non-business handlers) and UI noise (section-seen, push-token, notification read/clear); NO read/view/download logging. Endpoints wired with logAudit (~20):
- **Financial/settings:** `invoicing-generate.ts` generate → `invoice.generate`; `invoicing-manual.ts` generate → `invoice.generate` (metadata.manual); `invoicing.ts PUT /settings` → `invoice_settings.update`; `system-settings.ts PATCH` → `system_settings.update`. (PDF-store sub-step left unlogged on purpose.)
- **Account/security:** `me.ts` `user.profile_update`, `user.password_change`; `attendance.ts` `attendance.set` / `attendance.clear`.
- **Content:** `customer-notes.ts` `customer_note.create/update/delete` (entity=customer); `photos.ts` `photo.upload` (entity=customer) / `photo.delete` (entity=photo); `margin.ts` `margin_simulation.create/update/delete`; `collections.ts` proof → `collection.proof` (skips on duplicate replay); `deliveries.ts` photos → `delivery.photo`; `reports.ts` send-test → `report.send_test`.
- **SE field actions:** `executive-day.ts` POST /orders + /collections → reuse `order.create` / `collection.create` with metadata `{source:"field_visit"}` (these are the mobile visit-flow paths that bypass the audited /orders,/collections routes).

**Status:** BUILT, API tsc-clean, 428 API tests pass, E2E-verified on localhost (attendance.set flowed to audit_logs with correct actor/entity/summary). NO new migration (audit_logs already exists). **API NOT deployed, not committed.** Web unchanged. Full gap matrix at the time is in the session transcript.

---

## project-bearings.md

---
name: project-bearings
description: "Bearings sold alongside oils in orders (migration 0019, 2026-07-16) — part_no + MOQ only, MOQ-multiple rule, web + mobile pickers"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6831a0d1-b09d-47d7-beb9-a3f42b9d09d3
---

**Bearings feature (built 2026-07-16, TDD):** the distributor also sells bearings. A bearing has ONLY `part_no` (unique, stored trimmed+UPPERCASE) and `moq`. Bearing lines carry **no price and no litres** — order `total_litres` stays oils-only. One order can mix oils + bearings.

**QUANTITY MODEL (changed same day, user decision — supersedes the MOQ-multiples rule):** the user enters a **plain whole quantity** (any integer ≥ 1); the real piece count is `quantity × MOQ` but **pieces are NEVER shown in any UI** ("no need to show the pieces, just quantities"). Migration `0020_bearing_moq_snapshot.sql` added `order_items.bearing_moq` — each line stores `quantity_units` = entered qty + the MOQ snapshot, so pieces stay derivable if a part's MOQ is later edited. API validates integer ≥ 1 only (no multiple rule). MOQ badges remain as info on web pickers only.

**DB (migration `0019_bearings.sql`, applied):** `bearings` table has **NO organization_id** (user decided: standalone client product) — the only table without it; CSV upload is just `part_no, moq`. `order_items`: `product_id`/`pack_size_litres`/`total_litres` now nullable, added `bearing_id` FK (NO cascade → in-use delete 409, like products) + `bearing_part_no` snapshot, and check constraint `order_items_oil_or_bearing` (a line is EITHER oil EITHER bearing).

**API:** `/bearings` CRUD (SUPER_ADMIN/MANAGER; POST/PATCH validate MOQ ≥1 integer, dupe part 409, in-use delete 409), `GET /orders/bearings` picker (+ SALES_EXECUTIVE + ACCOUNTANT, supports `?since=` via `updated_at`), `POST /orders` accepts `{bearingId, quantityUnits}` items (mixed with oil items; item with both/neither ids → 422). `services/bearings.ts` + `routes/bearings.ts`; orders service splits/validates. Tests in `bearings.test.ts` (30) + orders.test.ts bearing block; coverage include updated.

**Web:** Products page = Oils | Bearings tabs (bearings table part_no+MOQ, add/edit/delete dialogs, part-no auto-uppercase). Order-create dialog = Oils | Bearings tabs inside line items; bearing rows have searchable part combobox + ±MOQ stepper that **snaps typed odd values onto the MOQ grid**; red inline hint + blocked Create on invalid. Order detail renders bearing lines with amber "Bearing" chip + "N pcs".

**Mobile SE:** new-order screen gets Oils | Bearings chips (bearings chip hidden until the catalogue has rows); bearing cards say "Min order 10 · steps of 10" with tap-only ± stepper (− below MOQ removes); footer/review/confirmation show "N bearings · X pcs" separately. Offline: `bearings` cache table (local schema **v10**; legacy installs rebuild `order_items` since SQLite can't relax NOT NULL), `cacheBearings/getCachedBearings` in order-cache.ts, `recordOrder` accepts bearing items (litres oils-only; sync payload sends `{bearingId, quantityUnits}`).

**Status:** all layers verified live 2026-07-16 (web via dev servers incl. 409/dupe/MOQ paths; mobile on emulator — mixed order ORD-0017 synced, server rows correct). **Real catalogue loaded 2026-07-16:** 1,829 bearings imported from the user's CSV (`Bearning_DB_new - Order Form.csv`, 1,834 rows; skipped one `#ERROR!` spreadsheet artifact + 4 exact duplicates — TX-6202-BUC, TX-HRCD28-4CP-D, TX-DP11.906, TX-901B). Import path: node script with the `postgres` pkg (trim+UPPERCASE part_no, validate integer MOQ, dedupe, chunked insert). The catalogue size forced raising the `limit 1000` → `limit 5000` in both bearings list queries (services/bearings.ts) — without it ~800 parts were silently truncated. Verified in the SE app: search "6301" returns all TX-6301 variants with correct MOQs. NOT yet committed, NOT deployed (the 2026-07-16 API deploy predates bearings + the limit fix), not in the APK built earlier that day.

---
**MOQ REMOVED (2026-08-21, user decision "remove MOQ everywhere; qty = pieces 1:1; drop everything MOQ"):** bearings are now a FLAT part list (part_no + brand + hsn + application, NO moq). A bearing order quantity is a **plain whole number of PIECES (1:1)** — no minimum-order-qty, no "multiple of MOQ", no qty×MOQ. Removed across API (services/bearings.ts, routes/bearings.ts, orders.ts snapshot+inserts+selects, stock.ts units×moq→units), web (products bearing-dialog/columns/catalogue-export, orders bearing line row/header/api types). **Backward-compat shim:** the API still emits a constant `moq:1` / `bearingMoq:1` in responses so the currently-installed field APK keeps working (old app fetches moq:1 → its qty×1=qty aligns to the new 1:1); remove the shim once all devices update.
**DEPLOY ORDER (2-phase, because bearings.moq was NOT NULL):** `0068_drop_bearing_moq.sql` (relax: drop not null + default 1) — APPLIED to prod DB, safe with old code live. Then deploy new api+web. THEN apply `0069_drop_bearing_moq_columns.sql` (drops bearings.moq + order_items.bearing_moq) — must run only AFTER no deployed code references them. Tests updated (bearings.test.ts, catalogue-paged.test.ts, orders-export.test.ts). tsc clean both apps.
**MOBILE DONE (2026-08-21):** removed moq from order/types.ts (Bearing), order-cache.ts (CachedBearing + insert/select), sync-core.ts comment, and local-db.ts (SCHEMA bearings table drops moq + idempotent `alter table bearings drop column moq` in migrateLocalDb for legacy caches — bearings is a disposable cache, re-fetched). Tests updated (order-cache.test.ts, local-db.test.ts); all 201 mobile tests pass, tsc clean. Needs an APK rebuild to ship. UNCOMMITTED.

---

## project-brands-and-filters.md

---
name: project-brands-and-filters
description: "Brand field on all catalogue items + new Filters category + brand/filter snapshots on orders (migration 0033, 2026-07-22)"
metadata: 
  node_type: memory
  type: project
  originSessionId: de09bd9a-d688-4d95-abab-875313fac328
  modified: 2026-07-22T13:06:04.598Z
---

Migration `0033_brands_and_filters.sql` (2026-07-22, applied to shared Neon DB) added:

- **`brands` table** — per-category brand list (`category` in oils/bearings/filters, `unique(category,name)`), seeded **Fuchs (oils), Texspin (bearings), Mann (filters)**. `GET /brands?category=` feeds a pick-or-type datalist ([BrandField](apps/web/src/features/products/brand-field.tsx)); `ensureBrand()` in `services/brands.ts` validates non-empty + upserts, so typing a new brand auto-adds it. Brand is **mandatory** on create/edit of oils, bearings and filters (422 `INVALID_FIELD`); existing rows stay blank until edited (stored as `products.brand` / `bearings.brand` text columns).
- **`filters` table + Filters catalogue category** — `part_no` (unique, normalized uppercase) + `filter_type` (Oil/Air/AC/Fuel, CHECK) + mandatory `brand`. Full CRUD in `services/filters.ts` + `routes/filters.ts`; web catalogue picker gained a third "Filters" option ([products-catalogue-table.tsx] now handles oils|bearings|filters). Filters are ordered by **part + whole-number quantity in pieces** (no MOQ).
- **Order snapshots** — `order_items` gained `brand` + `filter_id`/`filter_part_no`/`filter_type`. Every order line snapshots the brand (oil→product's brand, bearing→bearing's brand, filter→filter's brand). The `order_items_oil_or_bearing` CHECK was replaced by `order_items_line_kind` allowing exactly one of product/bearing/filter. Order-create dialog now has an **Oils | Bearings | Filters** tab (`use-filter-lines.ts`, `order-filter-line-row.tsx`); `/orders/filters` is the picker endpoint.

**Verified** at API level (local 8787): brand inline-add, 422/409 validations, filter CRUD, and a 3-line order (oil+bearing+filter) all snapshotting brand correctly. Full API suite (318 tests) + web tsc/eslint green. **Deployed 2026-07-22** — both `api` and `sri-aparajita-web` workers shipped (see [[project-deploy]]); `/filters/paged` + `/brands` live, Filters page loads. Relates to [[project-bearings]] and the pack-size work in [[project-neworder-redesign]].

**Build-error gotcha fixed:** a client component (`filter-dialog.tsx`) value-importing a const (`FILTER_TYPES`) from `products-api.ts` (which imports server-only `next/headers` via server-session) breaks the build — "importing a module that depends on next/headers … in the Pages Router". Client components must only `import type` from `products-api.ts`; define runtime consts locally. See [[project-local-web-uses-deployed-api]].

---

## project-busy-integration-pending.md

---
name: project-busy-integration-pending
description: "ABANDONED 2026-08-11 — BusyWin integration dropped; client wants custom native Stock Journal + GST sections in Beyond instead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2563c901-096f-4df1-9034-928922d78a28
  modified: 2026-08-11T05:38:20.399Z
---

**ABANDONED 2026-08-11** — Client decided AGAINST integrating BusyWin. Instead they want **custom "Stock Journal" and "GST" sections built natively inside Beyond** (no BUSY sync). Do NOT resume the connector/schema-discovery work below unless the client reverses this. Native Stock Journal already has groundwork ([[project-stock-inventory]], migration 0055 folded a Stock Journal into the Products page); GST section is new — client has only stated intent, **no spec yet** (requirements TBD). Everything below is kept for historical reference only.

---

**2026-08-10 (historical, not pursued)** — Distributor runs **BusyWin** (Busy Accounting) as book of record. Goal: **mirror** Busy data (invoicing, stock-inward, ledgers, GST) INTO Beyond for viewing/analytics. BUSY shared an "Integration using BUSY Web Service" package (localhost web-service, not a cloud API).

**How BUSY Web Service works:** when enabled, BusyWin itself is a local HTTP server on **`http://localhost:981`** on the office PC; **BusyWin must be OPEN + company logged in**. Plain HTTP GET + headers `SC` (service code), `UserName`, `Pwd`. Response header `Result`=T/F (+`Description` on error), data in body. **Only 9 service codes** — no report/GST/ledger endpoints: SC1=run arbitrary SQL→XML (PRIMARY read path), SC8=GetVchXML by VchCode, SC9=GetMasterXML, SC2-7=add/modify voucher/master (unused, read-only). VchTypes: Sale=9, Purchase=2, Material_Receipt=4, Sale_Return=3, Credit_Note=18, Receipt=14, Payment=19, Journal=16. Account model: `AccDetail` with `AmountType` 1=Debit 2=Credit. MasterTypes: Account=2, Item=6.

**Decisions locked with user:** (1) **ongoing sync**, Busy stays authoritative; (2) **read-only for now** (no write-back); (3) **office hours only 9AM–8PM, Sun off** — no 24/7; (4) **connector app on the office PC is acceptable**; single office desktop. Assumed-defaults (overridable): full **line-item detail**; GST = **in-app summaries** derived from vouchers, actual **filing returns stay in Busy's native export** (do NOT re-derive filing GSTR from raw vouchers).

**Recommended architecture:** small **connector program on the office PC** (scheduled task/service) that during office hours polls Busy via SC=1 SQL (delta by monotonic `VchCode` + trailing-window re-pull for edits), converts XML→JSON, and **POSTs outbound HTTPS** to a new `POST /integrations/busy/sync` (shared secret) → Neon `busy_*` mirror tables → read-only "from BusyWin" screens. **Connector, NOT tunnel** — the service takes Busy user/pwd in plain headers + runs arbitrary SQL, so never expose port 981; outbound-only keeps creds local, no inbound firewall changes.

**BLOCKER — Phase 0 schema discovery:** package documents ONLY table name `Tran1` (no columns, no item-detail table, no ledger/account-entry table, no GST tax columns). Cannot write any real query until we get **Busy's DB schema/data-dictionary** OR a **short session on the office PC** to introspect live (`Select * from Tran1`, find sibling detail/ledger/master tables, GSTIN/HSN/CGST-SGST-IGST columns, a modified-timestamp for delta). **Immediate ask on the user: obtain Busy schema or arrange the PC session.**

Full spec: `docs/PENDING-BUSY-INTEGRATION.md`. Phasing: 0 schema → 1 Sales invoices e2e → 2 Purchases/Material-Receipts + Ledger → 3 GST summaries. Related: this is IN TENSION with the in-app invoicing that was replacing BusyWin ([[project-invoicing-build]], [[project-stock-inventory]], [[project-ledger-fifo-unpaid]]) — coexist for now, merge decision deferred.

---

## project-checkin-beat-race-fix.md

---
name: project-checkin-beat-race-fix
description: "Bug fix: new-customer-same-day check-in recorded 'unplanned' + 7PM cron added duplicate 'missed' (beat materialization race)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4504d879-2ce4-4525-a210-5d429949c9a8
  modified: 2026-08-24T17:33:24.205Z
---

2026-08-24: Fixed a visit-duplication bug. When an SE creates a customer in the field and checks in the SAME day, the check-in was recorded **unplanned** and the 7 PM cron later added a DUPLICATE **missed** visit for the same stop.

**Root cause (race):** `enrollCustomerInTodayBeat` (beat-assign.ts, on customer create) inserts into `beat_customer_days` (weekly TEMPLATE), not today's `beat_plan_stops`. Those materialize separately (`materializeTodayPlan`, on GET /beats/today). If the SE checks in BEFORE the beat re-materializes, `visits.ts` check-in finds no `beat_plan_stops` row → records `unplanned`. The stop materializes later as `pending` (unlinked) → 7 PM `markMissedBeatStops` flips it to `missed`. The customer Visits tab then shows both (missed stop + unplanned visit).

**Fixes (all in apps/api, UNCOMMITTED, needs deploy):**
1. **`services/visits.ts` check-in** — before the beat-stop match, compute IST weekday/date and call `materializeTodayPlan(sql, userId, istDate, weekday)` (weekday 1-6). Idempotent (same op as /beats/today), so a just-created customer's stop exists → the existing match finds it → visit `planned` + stop `completed`. Closes the race. VERIFIED e2e (create customer as SE → check-in → planned + completed + linked).
2. **`services/beat-missed.ts` `markMissedBeatStops`** — added `and not exists (visit for same customer+executive+plan_date)` guard so a customer actually visited that day is NEVER marked missed (defense-in-depth). tsc clean.
3. **Backfill (prod DB, DONE)** — 12 customers hit (CUST-0317..0329 range, over 21–24 Aug): linked each `missed` stop to the SE's actual visit + set `completed`, and upgraded those visits `unplanned`→`planned` (set beat_plan_id). Verified 0 race-affected rows remain; CUST-0328 now = one planned visit, completed stop.

**Note:** timezone edge — check-in match uses SQL `current_date` (UTC) while materialize uses IST date; they align during business hours (the bug scenario) but could differ ~00:00–05:30 IST. Pre-existing (whole check-in already uses current_date); not addressed here. Also re-confirmed the `se_notifications` over-generation on customer create (6 rows per new customer) — separate, still worth a look. See [[project-visit-outcomes]].

---

## project-collection-receipts.md

---
name: project-collection-receipts
description: "SE-uploaded collection receipt photos now viewable on the web Collections detail page (Accountant + Super-admin only), 2026-07-24"
metadata: 
  node_type: memory
  type: project
  originSessionId: f686e535-ba24-4529-89c2-88f359d5400b
  modified: 2026-07-24T05:23:36.194Z
---

SE collection receipt photos are now viewable in the web app (2026-07-24). They were already being uploaded — one per collection to R2 `collections/{id}/…` + `payment_proofs` table via `POST /collections/:id/proof` — but nothing surfaced them.

Added:
- `GET /collections/:id/proof` streams the receipt image; **SUPER_ADMIN + ACCOUNTANT only** (the verify/reject reviewers). Manager sees the collection but NOT the receipt (user-decided). `getCollectionById` now also returns `proof: {id, contentType, createdAt} | null` (null for web-created collections, which have no photo).
- Web: `features/collections/collection-receipt.tsx` — "Payment receipt" section on the detail page (`/dashboard/collections/[id]`), thumbnail → click opens a large-image [[dialog]]. Fetches the authed image as a blob→object URL (same pattern as Market Intelligence `AuthImage`), because `<img src>` can't send the bearer token.

User decisions (all "Recommended"): detail page only (not the list), Accountant+Super-admin only, open in a dialog with a big image.

Verified live: COLL-0005 (Bhaskar, ₹10,000 UPI) receipt renders for the accountant and enlarges; manager view correctly hides it. API deployed. Web deploy pending user commit.

---

## project-collection-types.md

---
name: project-collection-types
description: "Advance vs General collection types + customer credit-balance model (migration 0016, added 2026-07-14)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6da298a3-8e15-40aa-b01f-22bbd9ca0284
---

Collections have two types (migration `0016_collection_type.sql` adds `collections.collection_type` = `general` | `advance`, default `general`). Decided 2026-07-14.

**Both types reconcile identically** — at accountant verify, the money clears the customer's open invoices oldest-due-first; any leftover is held as advance credit. The type is essentially a stored intent label the SE picks. General overpayment behaves like advance (excess → credit).

**Net balance is COMPUTED, not stored** (no running-balance column): `netOutstanding = Σ invoice.outstanding_amount − heldCredit`, where `heldCredit = Σ(verified collection_amount) − Σ(all their allocations)`. Negative net = customer holds credit. Exposed by `GET /customers/:id/invoices` as `totalOutstanding` (can be negative) + `advanceCredit` (≥0). `creditBlocked` only when net > 0 AND an invoice is overdue.

**Auto-apply**: `applyHeldCreditToOpenInvoices(sql, ctx, customerId)` in `services/collections.ts` runs after reconcile at verify — consumes held credit against open invoices oldest-first, recording a `collection_allocations` row per consumption (keeps the heldCredit invariant true). Reusable from a future invoice-creation flow. NOTE: there is currently **no live invoice-creation endpoint** — invoices only exist via the seed script (`packages/db/src/seed-dev.ts`), so auto-apply-on-new-invoice has no trigger yet beyond verify time.

**Why:** the distributor needs to record customers paying ahead (deposits) and have that surface as negative outstanding, e.g. ₹0 owed + ₹10,000 advance → −₹10,000. Verified live end-to-end 2026-07-14 (curl + emulator).

**How to apply:** mobile add-collection screen ([collection/new.tsx](apps/mobile/src/app/collection/new.tsx)) has a General/Advance toggle. Customer detail ([customer/[id].tsx](apps/mobile/src/app/customer/[id].tsx)) shows "Advance / Credit ₹X" in green when net < 0. `CollectionInput.collectionType` threads through sync-core → sync queue → `POST /collections`. Local SQLite bumped to v7 (`collection_type` on collections, `advance_credit` on customer_credit). See [[project-overview]].

**Update 2026-07-14 (same day, second pass):** the "Against invoice" picker was **removed** from the mobile screen — collections no longer allocate to a specific invoice from the app; everything reconciles oldest-due-first at verify (the API still accepts `invoiceId` for back-compat but mobile always sends null). The **reference** field is now shown and **optional for every payment mode** (was required for non-cash). Every collection now requires a **mandatory proof photo** (camera or gallery, exactly one). Offline-first: the photo is copied out of the picker cache into documentDirectory (`persistProofPhoto`), stored on the local `collections` row (`proof_photo_path`, `proof_uploaded`), and uploaded on sync — `sendItem`'s collection case POSTs the collection then `POST /collections/:id/proof` (multipart, R2 + `payment_proofs`). That proof endpoint is **idempotent** (one proof per collection → returns existing on replay), which keeps the create+proof sync pair safe to retry. Migration `0017` adds `content_type`/`size_bytes` to `payment_proofs`; local SQLite bumped to **v8**. NOTE: there is still no live invoice-creation endpoint (invoices only via seed).

---

## project-cron-cost-window.md

---
name: project-cron-cost-window
description: Neon cost cut — gate the */3 maintenance cron to office hours + skip Sunday; skip daily report on Sundays
metadata: 
  node_type: memory
  type: project
  originSessionId: 124893aa-aa85-4d61-ae10-747aa1488594
  modified: 2026-08-09T19:03:23.310Z
---

**2026-08-09** — Neon PostgreSQL was costing ~$1/day (~$30/mo). Root cause: the Worker's `*/3 * * * *` cron hit the DB every 3 min **24/7** (tracking-maintenance + dues + cleanup gate-checks), so Neon compute never scaled to zero. Pings are NOT the cron — they arrive via always-on POST endpoints (`/visits/gps/batch`, `/tracking-sessions/:id/points/batch`); the cron only does the *absence* jobs: interruption ("went dark") alerts + SE 7 PM auto-close. Logistics have NO auto-close (SE-only, confirmed).

**Fix (BUILT, tsc + 421 tests green, boundary-tested; NOT committed; API deploy pending):**
- `apps/api/src/index.ts`: added `inMaintenanceWindow()` (Intl IST) — the 3-min maintenance runs **only IST Mon–Sat 08:55–21:05**; outside that (nights + **all Sunday**, office holiday) the scheduled handler `return`s with NO DB query → Neon sleeps. Gate is placed AFTER the reports-cron branch so reports are unaffected. Verified: 08:55/09:00/19:00(7PM close)/21:05 in-window; 08:50/21:10/night/Sunday out.
- `apps/api/src/services/report-email.ts` `dispatchScheduledReports`: **skip the DAILY report on Sundays** (`dow !== 7`) but **keep weekly/15-day/monthly if their anchor lands on Sunday** (weekly=Mon anyway; 1st/16th can occasionally be Sunday — user wants those kept). Anchors: daily=every day, weekly=Mon, 15-day=1st&16th, monthly=1st.

Office hours = 9 AM–7 PM (SEs); window buffered 08:55–21:05 to cover early start + the 7 PM close + the 9 PM reports edge. Pings still land 24/7 (unchanged). Expected ~$30→~$12/mo (cron-driven compute down ~55-60%). **Needs API deploy** (no APK). Related: [[project-7pm-cutoff-checkin]], [[project-reports-emails]], [[project-tracking-live-upload]].

**Cloudflare billing (Aug 2026, via CF GraphQL + user's billing screen):** the ENTIRE CF bill (~$9.92) was **R2 Infrequent Access** — Class A ops $9.00, Class B $0.90, retrieval/storage $0.02. Workers (447k req, 2.17M CPU-ms) + R2 Standard were all $0 (within free tiers). **IA was the wrong call at this scale** — the bucket (588 MB, ~1k ops/mo) is FREE under Standard's tier (10 GB / 1M Class A / 10M Class B), but IA has NO free op tier + ~2× op rates + retrieval fees. **Fixes done 2026-08-09:** (1) `apps/api/src/lib/r2.ts` reverted to `R2_STORAGE_CLASS="Standard"` (renamed from R2_COLD_STORAGE_CLASS, 8 files sed'd) — new uploads Standard, **needs API deploy**; (2) **one-time live migration DONE + verified** — only 45 of 776 objects were STANDARD_IA; converted all 45 in-place via S3 CopyObject (MetadataDirective=COPY, StorageClass=STANDARD) → all 776 now STANDARD, content-types intact (invoices application/pdf, photos image/jpeg). R2 bill → ~$0. Script in scratchpad/r2mig (uses R2_* S3 creds from .env).

**After-hours heartbeat fix (Neon query driver, mobile — 2026-08-09; tsc+124 tests green; NOT committed):** the JS heartbeat timer (`sync.ts`, every 3 min) guarded only on `dayFlagIsForToday` (date), so it kept `kickSync()`+`sendTrackingHeartbeatNow()` firing **7 PM→midnight** (SEs) and indefinitely (Logistics) = the 8–10:30 PM DB-traffic spike. Fixed: added pure `istHour()` to `day-flag.ts`; heartbeat now fires only if `dayFlagIsForToday(dayOn) && istHour() < 19` — stops at 7 PM for **BOTH** roles (per user). Native GPS service (separate) still tracks a genuinely-active late Logistics run. **Needs new APK.**

---

## project-customer-notes.md

---
name: project-customer-notes
description: Customer-specific notes feature (append-only thread per customer) — mobile button + web tab
metadata: 
  node_type: memory
  type: project
  originSessionId: d04e0a17-7ca2-43db-8983-8f8516c376c6
  modified: 2026-08-09T10:25:04.989Z
---

**2026-08-09** — Client asked for **customer-specific notes**: a running thread on each customer. Decisions (asked, not assumed):
- **Free text only** (no category/title).
- **Add**: SE + all office roles (SUPER_ADMIN/MANAGER/ACCOUNTANT). Everyone is **add-only** — notes can't be edited/deleted by their author, any number of notes allowed. Each carries a **timestamp (date + time)** and author.
- **Visibility**: one shared thread — an SE sees ALL notes on their customer (admins' too), scoped by `assertCustomerVisible` (SE only sees own customers).
- **SUPER_ADMIN only** can **edit in place** (marks it "edited" via `edited_at`/`edited_by`, shows "edited by X · time") or **delete**.

Status **2026-08-09: migration 0058 applied, API DEPLOYED, E2E VERIFIED live on both surfaces** (mobile emulator + web browser as SUPER_ADMIN): SE add×2 newest-first w/ author+timestamp & no SE edit/delete; web shared thread shows the mobile notes; web add (author=admin), super-admin Edit → "edited" badge + "edited by X · time", Delete (window.confirm-guarded) → removed; all changes round-trip to mobile. STILL NOT committed; mobile still needs a new APK.

Build (tsc clean on api+web+mobile):
- **DB** `packages/db/migrations/0058_customer_notes.sql` — `customer_notes` (id, customer_id FK cascade, body, created_by, created_at, edited_at, edited_by), index on (customer_id, created_at desc). **User must apply before API deploy.**
- **API** `services/customer-notes.ts` (list/create/update/delete) + `routes/customer-notes.ts` mounted at `/customers` (before customersRoutes) → `GET/POST /customers/:id/notes`, `PATCH/DELETE /customers/:id/notes/:noteId`. GET/POST = SE+office (assertCustomerVisible); PATCH/DELETE = SUPER_ADMIN only. Registered in `index.ts`.
- **Web** `features/customers/customer-notes-tab.tsx` — new **"Notes" tab** (placed right after Ledger) in `customer-detail.tsx`. Add box (all 3 web roles) + thread; SUPER_ADMIN gets per-note Edit (inline textarea) + Delete (window.confirm). Uses react-query + apiRequest.
- **Mobile** `app/notes/[id].tsx` — new screen (add box + newest-first thread, add-only, no edit/delete for SE, "edited" badge shown). Reached via a **5th action button "Notes"** (document-text icon) added to the customer action row in `app/customer/[id].tsx` — row now fits 5 (Order·Collect·Market·Ledger·Notes; "Add order"→"Order", gap 2.5→2). Verified live on emulator: 5-button row is clean single line; Notes screen scaffold renders (list errors until API deployed).

Remaining: apply migration 0058, deploy API, then web works; new APK for mobile. Mobile is online-only for now (no offline outbox/cache yet — a gap vs [[project-mobile-offline-vision]]). Related: [[project-customers-contacts-list]].

---

## project-customer-phone-uniqueness.md

---
name: project-customer-phone-uniqueness
description: "Duplicate customer phone: create blocks with named 409; hardened with active-only unique index + edit-path guards; mobile ErrorBanner red-border fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81771ad0-d42b-4b51-a8ef-ce7de64a6ce9
  modified: 2026-08-22T15:18:35.224Z
---

2026-08-22: **Duplicate customer phone number** behavior + hardening.

**Current behavior (confirmed on emulator):** `createCustomer` (apps/api/src/services/customers.ts) app-checks the last-10-digits of `phone` against ALL customers (not SE-scoped) and blocks with a 409: **"This phone number already belongs to {legal_name} ({CUST-code})."** Shown in the mobile ErrorBanner above Save. Cross-SE nuance: SEs only see their own customers (created_by), so the error can name a customer they can't see — user chose to KEEP naming it (no message change), and keep the check on the main phone only.

**Hardening shipped (uncommitted; index already applied to prod):**
- **migration 0070_unique_active_customer_phone.sql** — partial UNIQUE index on `right(regexp_replace(coalesce(phone,''),'\D','','g'),10)` WHERE `status='active'` AND that expr is 10 digits. The old `unique(organization_id, phone)` was dropped with org_id (0034/0035) and never replaced. PARTIAL/active-only because 2 historical pairs share a number across active+inactive/suspended (CUST-0097/0099 = 8790488924; CUST-0148/0275 = 9912616759) — active-only lets them coexist and matches "inactive/suspended don't reserve a number". Applied to prod + verified (no conflict).
- **`assertPhoneAvailable(sql, phone, excludeId)` helper** → named 409 so the index never surfaces as a raw 500.
- **Both edit paths fixed**: `updateCustomerBySE` (its `duplicate key/23505` catch was DEAD — no constraint existed; now live + explicit named pre-check) and office `updateCustomer` (had NO guard). Pre-check runs only when the phone actually CHANGES (compare normalized), so the historical-dup customers stay editable. Create path message/logic unchanged.
- tsc clean; the 4 POST /customers route-test fails are PRE-EXISTING (mock harness), not from this work. Needs apps/api deploy for the edit-path guards (index already live).

**Mobile ErrorBanner red-border fix (same day):** `apps/mobile/src/components/error-banner.tsx` had a BLACK border bug — `border-destructive/40` (NativeWind opacity modifier on the `destructive` token) doesn't resolve → falls back to black (and `bg-destructive/10` → white). Only non-opacity `text-destructive` renders red. Fixed to `border-destructive` + `bg-white` (solid red border matching text, white bg). Fixes all 12 ErrorBanner usages. **Lesson: avoid `/opacity` modifiers on the `destructive` token in this NativeWind setup — they silently fall back.** See [[project-mobile-rebuild]], [[project-neworder-redesign]].

---

## project-customer-reassignment-pending.md

---
name: project-customer-reassignment-pending
description: "Super-Admin customer-ownership reassignment page — fully specced 2026-07-31, deferred, build from docs"
metadata: 
  node_type: memory
  type: project
  originSessionId: b74cc001-8e5a-48f9-8c1f-d1e0b0deb9e8
  modified: 2026-08-12T07:17:56.708Z
---

Super-Admin "Reassign Customers" page under Configure — **SPECCED 2026-07-31, deferred**. Build from `docs/PENDING-CUSTOMER-REASSIGNMENT.md`; don't re-ask the decisions.

Reassign a customer's complete ownership (`customers.created_by`) from one Sales Executive to another. Confirmed choices: **full history** moves (created_by + orders.sales_executive_id/created_by, collections.collected_by_user_id/created_by, invoices.sales_executive_id/created_by, visits.executive_id, customer_photos.uploaded_by — for rows currently attributed to the old owner); **both** single-customer and bulk-by-executive; **SUPER_ADMIN only**; **audit-logged** via the existing unused `customer_assignments` table (no migration); **full impact preview** before applying; **one-click undo last**.

Deliberately NOT moved (factual): GPS/`tracking_customer_dwell_events` and logistics delivery runs. Moving orders/invoices/collections retroactively shifts target actuals + KPI leaderboard + dues — surface this in the preview.

Precedent (manual one-off SQL moves on the live trial DB):
- CUST-0006 (RK Automobiles) Upendar→Murali, 2026-07-31.
- CUST-0182 (Sri Balaji Automobiles), 2026-08-12: ownership (`created_by`) + the 1 visit (`executive_id`) were ALREADY Upendar; only the 2 orders (ORD-0178/0179) + 2 invoices (BAL/26-27/0271, /0269) were still `sales_executive_id`=Murali → moved to Upendar. Lesson: "move X from A to B" may already be partly done — always read the target first; here the request said "from Murali" but the customer was already owned by Upendar.

SE user ids (live): Murali `23f897aa-33d3-413e-9b52-4409f66ba953`, Upendar `32852879-d8c2-4933-9a15-758e23f299af`. Visit SE column is `visits.executive_id` (not sales_executive_id).

See [[project-user-management]] for the created_by ownership model. Related: [[project-overview]], [[project-field-trial]].

---

## project-customers-contacts-list.md

---
name: project-customers-contacts-list
description: Mobile Customers tab redesigned from search-first empty state to an A–Z contacts list
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-07T20:26:03.190Z
---

The SE mobile **Customers tab** (`app/(tabs)/customers.tsx`) was **search-first** by a 2026-07-10 decision ("no directory listed by default"). Reversed 2026-08-08 (user asked): show the full customer list like a **phone contacts app**.

**Agreed design (app-only, no backend):**
- Virtualized **SectionList** grouped **A–Z** by customer name, sticky letter headers + right-side **A–Z fast-scroll index**. Sized for ~118 customers/SE (Sandeep 118, Murali 86).
- Row: round **initials avatar · name · phone · city**. Whole row taps → customer page (no extra buttons).
- Search bar pinned at top, **filters the list live** (replaces the old blank "Find a customer" state).
- Offline from the already-cached customer list — `fetchSeCustomers`/`DirectoryCustomer` already carry name+phone; `addressCity` exposed as `city` (was merged into `address`).

**BUILT + emulator-verified 2026-08-08** (`app/(tabs)/customers.tsx`, plus `city` added to `DirectoryCustomer`/`customer-directory.ts` + `address_city` col in mobile `local-db.ts`). Verified: A–Z jump lands exactly on the letter, live search filters name/phone/code/city, clearing search doesn't crash, row tap → customer page. 111 tests + tsc pass. NOT committed; needs a new APK.

**Implementation gotcha (important):** built on a plain **FlatList over a flattened [header, …rows] array** with `getItemLayout` (fixed `ROW_H=64`/`HEADER_H=32` dp) + `scrollToOffset` for the A–Z jump — NOT a SectionList. Two RN-0.86/Fabric traps hit and avoided:
1. `SectionList.scrollToLocation` **silently no-ops** for a not-yet-measured section on Android and never calls `onScrollToIndexFailed`; `getScrollResponder().scrollTo(farY)` also fails (clamps to the small virtualized contentSize). FlatList `getItemLayout`+`scrollToOffset` is the reliable path.
2. **`stickyHeaderIndices` on FlatList CRASHES on Fabric** when the data/indices change (e.g. clearing search): `addViewAt: failed to insert view … IndexOutOfBoundsException`. Fix: dropped `stickyHeaderIndices` — letter headers are inline (non-sticky). Do NOT re-add sticky headers on a FlatList whose data changes.

**Deliberately deferred (user chose app-only, no API change):**
- **Dues indicator** per row — needs the SE `/customers` endpoint to return each customer's outstanding (no local source; dues come from invoices server-side). Bring back with one small API add + cache.
- **Last visited** — skipped.

No API/DB change; front-end only → needs a new APK for field phones. Related: [[project-mobile-offline-vision]], [[project-neworder-redesign]] (user's clean-minimal UI taste).

---

## project-dashboard-finance-cards.md

---
name: project-dashboard-finance-cards
description: Dashboard = 6 activity cards + Collection Dues card. ALL finance stat cards (Outstanding, New customers, Revenue, Expenditure) and the KPIs page + collections heatmap were removed. Finance backend fully deleted.
metadata: 
  node_type: memory
  type: project
  modified: 2026-09-07T08:59:25.215Z
  originSessionId: 0f5fcc13-0b06-4233-bc4a-f22ce737e455
---

**FINANCE CARDS FULLY REMOVED (2026-09-07).** User: "Remove the Total outstanding due card and new customers card." Those were the last 2 finance cards, so the whole finance feature is gone: deleted web `finance-cards.tsx`/`finance-drilldown.tsx`/`finance-helpers.ts`, removed all finance wiring from `metrics-dashboard.tsx` (financeQuery + financeDrill + both renders), deleted api `services/dashboard-finance.ts`, removed `GET /dashboard/finance` + `/finance/:metric/rows` routes. **Dashboard is now: 6 activity metric cards + the Collection Dues card only.** Verified: /finance + /finance/rows → 404, /metrics + /dues/summary → 401 (kept); tsc/lint clean. UNCOMMITTED, needs api+web deploy. Everything below is now historical.

**Dues CARD filters (2026-09-07, UNCOMMITTED needs api+web deploy):** replaced the top-right caption text ("by age of oldest unpaid invoice · as of today") with TWO `SearchSelect` (searchable combobox, `@/features/orders/search-select`) dropdowns — **Sales Executive + City** — options from `GET /customers/filter-options` (`{cities, salesExecutives}`, SA+MGR+ACCT). Both combine (AND) and re-fetch the buckets+total (`/dues/summary?executiveId=&city=`, keepPreviousData) AND filter the drill (`/dues/customers?...` via `useDuesDrilldown(actionConfig,{executiveId,city})`). Backend: added `city` param to `getAdminDuesSummary`/`listAdminDuesCustomers` (`and (${city}::text is null or c.address_city=${city})`) + both dues routes. SE filter (`executiveId`) already existed. SQL-proven (Khammam→39 cust/₹10.4L). tsc/lint clean, 7 dues tests pass. **SE→city dependency (2026-09-07):** selecting an executive scopes the City dropdown to only THAT SE's cities (all their customers' cities, not dues-only) — `listCustomerFilterOptions(sql, executiveId?)` now scopes the cities query by `created_by` (SEs always full roster); route reads `?executiveId=`; dues-card options query keyed on executiveId (keepPreviousData) + SE onSelect resets city to "". SQL-proven: 65 all → Sandeep 22 / Srikanth 18. Customers page unaffected (calls it with no executiveId). Also: dues drill-down shows **city under the customer name** (`listAdminDuesCustomers` selects `address_city`), and the Total Dues centre tile is **rose-tinted** (bg-rose-50 + ring, ₹ rose-600 extra-bold, 'N owe' rose semibold).

**Dues CARD loading transition (2026-09-07):** `dues-card.tsx` loading→data now uses `[[project-animated-swap]]` AnimatedSwap (cross-fade + smooth resize) with a **context-aware cross skeleton** (`DuesSkeletonCross`: 4 bucket-shaped shimmers on the four sides + centre-total shimmer, same POS grid + DUES_ACCENT colours) replacing the old plain `<Skeleton h-56>` block. Skeleton ≈ data size (~324px both) so the swap barely resizes. Verified in-browser via harness (skeleton shape matches data, height 324↔326), harness deleted.

**Dues drill-down polish (2026-09-07):** the Collection Dues bucket drill-down (`dues-drilldown.tsx`) now has (a) a **context-aware table skeleton** (real 5-col header + shimmer rows shaped per column, row count = clamp(bucket.customers, 1, 6)) replacing the old "Loading…" text, and (b) the **customer name is a `<Link href=/customers/:id>`** (hover underline, like the metric drill-downs' `CustomerName`). Both wrapped in `[[project-animated-swap]]` AnimatedSwap (cross-fade + smooth resize). Verified in-browser via throwaway harness (skeleton shape + link hrefs /customers/c1..c3), harness deleted.

**Collection Dues card added (2026-09-04):** below the finance cards on the SA/Manager dashboard — a "cross" layout (central **Total dues** with the 4 aging buckets on the four sides: 0–30 top, 31–45 right, 46–60 bottom, 61+ left), each showing ₹ outstanding + customer count and **clickable → that bucket's customer list**. Web-only: `features/dashboard/dues-card.tsx` + `dues-drilldown.tsx` + `dues-helpers.ts`, wired in `metrics-dashboard.tsx`. Reuses EXISTING backend (no API change): `GET /dues/summary` + `GET /dues/customers?bucket=` (`getAdminDuesSummary`/`listAdminDuesCustomers` in `services/dues.ts`, SA+MANAGER). Aging is as-of-today by oldest unpaid invoice/opening-balance using `invoices.outstanding_amount` (the mobile SE dues rule) — NOTE this can differ slightly from the Outstanding-receivables card, which uses the stateless ledger balance ([[project-dues-ledger-truth]]); accepted. Pre-existing unrelated: 2 dashboard-experience.test.tsx failures (Manager/Accountant legacy cards) — stash-verified pre-existing, SuperAdmin test (covers DuesCard) passes.

**FINAL STATE (2026-09-04): only 2 finance cards remain — Outstanding receivables + New customers.** Revenue billed + Expenditure cards were added then REMOVED same day (user: "remove the expenditure and revenue stat cards too", full removal). `/dashboard/finance` headline now returns just `{outstandingReceivables, newCustomers}`; `getFinanceRows`/`FINANCE_METRICS` handle only `outstanding`+`newCustomers`; web `FinanceKey`/`FinanceHeadline`/`FinanceRow` trimmed; finance-cards grid now `grid-cols-2`. Original build detail below (Revenue/Expenditure mentions there are historical).

**2026-09-04 (UNCOMMITTED, needs api+web deploy).** Two goals on the SA/Manager dashboard (`/` home → `MetricsDashboard`):

**Added — 4 financial cards** below the existing 6 activity cards (clickable, each a flat drill-down dialog), SUPER_ADMIN + MANAGER:
- **Outstanding receivables** — LIVE ledger balance now (period-independent): Σ over customers of `greatest(balance,0)` where balance = opening + Σ(non-rejected `invoices.invoice_net_value`) − Σ(non-rejected collections) − Σ(sales_returns.gross_amount). Same math as customers-list balance ([[project-dues-ledger-truth]]). Computed **set-based** (grouped joins, not per-customer correlated subqueries) so it's fast (~865ms vs 1.6s).
- **Revenue billed** — Σ `invoice_net_value` (grand total INCL GST; taxable+gst), non-rejected, by invoice_date in range.
- **New customers** — customers created in range (IST date).
- **Expenditure** — Σ `expenditures.amount` in range.
- API: `GET /dashboard/finance` (headline, 4 numbers in ONE query) + `GET /dashboard/finance/:metric/rows` (drill rows: revenue→invoices, outstanding→customers who owe, newCustomers→list, expenditure→by category). Both SA+MANAGER. Service `apps/api/src/services/dashboard-finance.ts`. Kept OUT of the 60s-polled `/dashboard/metrics` (own query, fetched once per range, staleTime 5min) so the heavier outstanding sum doesn't re-run every minute.
- Web: `features/dashboard/finance-cards.tsx`, `finance-drilldown.tsx` (one-level flat dialog, separate from the 2-level activity drilldown), `finance-helpers.ts`. Wired in `metrics-dashboard.tsx`.

**Removed — collections heatmap**: briefly added (executives × days, `/dashboard/collections-heatmap` + `getCollectionsHeatmap` + `collections-heatmap.tsx`) then the user asked to remove it entirely — component, wiring, endpoint, service fn, and type all deleted 2026-09-04. Finance cards stayed.

**Removed — KPIs entirely** (2026-09-04): deleted `services/kpis.ts`, `GET /dashboard/kpis`, `app/(dashboard)/kpis/page.tsx`, `features/kpis/*` (kpis-overview, kpi-range-picker, executive-leaderboard, kpi-card, kpis-api, kpis-skeleton), and the sidebar "KPIs" item + `kpis` NavKey + `Gauge` import. The Accountant home (`app/page.tsx`) WAS `<KpisOverview>` — now a **placeholder** Overview ("A dedicated accountant overview is coming soon…") pending real design. Supersedes [[project-kpis-load-optimization]]. Verified: `/kpis` + `/collections-heatmap` → 404, `/finance` → 401 (kept); web+api tsc/lint clean, 22 api dashboard tests pass. Visual dashboard check still pending (needs login).

---

## project-dashboard-osm-map.md

---
name: project-dashboard-osm-map
description: "Dashboard \"Customer map\" section — OpenStreetMap/Leaflet plotting all customers coloured by dues-ageing bucket, with executive/city filters and a today-live field-activity overlay."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0f5fcc13-0b06-4233-bc4a-f22ce737e455
  modified: 2026-09-09T04:20:44.148Z
---

**STATUS: COMMITTED + DEPLOYED (api+web) as of 2026-09-08.** All the work below (map build, tooltip/table, `active` flag, ageing-coloured dots, viewport lazy-load + shimmer + framer fade + <100-line split) is live in prod — ignore the older "UNCOMMITTED/needs deploy" notes in individual entries.

**Basemap swapped OFF OpenStreetMap → Esri Light Gray Canvas (2026-09-09, UNCOMMITTED on `feat/vardhan-maps-integration`):** user complained about red "+" icons when zooming into cities (Khammam). Root cause: they were **OSM raster-tile POI icons** (medical crosses for clinics/pharmacies baked into the tile image), NOT app markers — our customer markers are the solid dues-coloured circleMarker dots. Since POIs can't be hidden on raster tiles, switched the tile source on BOTH the customers map (`use-osm-map-init.ts`) and Live Tracking (`tracking-map.tsx`) to a clean POI-free basemap. First tried **CARTO Positron** (`{s}.basemaps.cartocdn.com/light_all`) — REJECTED: CARTO retired keyless access, tiles return "API KEY REQUIRED" placeholders. Settled on **Esri Light Gray Canvas** (`server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` — note `{z}/{y}/{x}` order; attribution `Tiles © Esri — Esri, DeLorme, NAVTEQ`) — keyless, no signup, visually near-identical light grey, zero POI icons. Customers map layer sets `maxNativeZoom:16, maxZoom:19` (tiles go soft past z16 but our vector dots stay crisp); the vardhan-maps `IndiaMap` tileUrl path hardcodes `maxZoom:19` with no maxNativeZoom, so the tracking map's Esri tiles 404 past z16 (fine — tracking is viewed zoomed-out). vardhan-maps `IndiaMap` already exposes `tileUrl`/`tileAttribution` props (no package change/republish needed). Verified live on both maps (clean grey, "Tiles © Esri", no crosses). tsc+lint clean. OPEN OFFER to user: 2-min free CARTO key would restore the exact Positron look with full-res zoom.

**2026-09-07 (leaflet deps added).** New **Customer map** section on the Dashboard home (`metrics-dashboard.tsx`, below the Collection Dues card; SUPER_ADMIN + MANAGER). Uses **OpenStreetMap tiles via Leaflet + leaflet.markercluster** (added via pnpm: `leaflet`, `leaflet.markercluster`, `@types/*`). No Google Maps key (that's the Live Tracking page, left untouched).

**Layers** (`apps/web/src/features/dashboard/map/`):
- `dashboard-map-section.tsx` — header (title + `N shown` + executive/city `SearchSelect` filters), dues-age legend, three activity toggles, wraps the dynamic map. Fetches `GET /dashboard/map` (customers), lazily `GET /dashboard/map/activity` only when a toggle is on (auto-refresh 60s). Executive→city dependency + client-side pin filtering (same pattern as the Dues card).
- `osm-map.tsx` — vanilla Leaflet (dynamic `ssr:false`). Customers = clustered `divIcon` dots coloured by **dues ageing bucket** (0-30 emerald / 31-45 yellow / 46-60 orange / 61+ rose / **no-dues = slate**, matching the Dues card). Popup: name, code, city·exec, ₹ due + bucket, "Open customer →" link. Activity overlay: SE live positions (name chips, green if pinging), today's check-ins (violet rings), SE day routes (blue polylines). A **"Fit" button** (top-right) reliably frames all pins.
- `map-helpers.ts` — types + `BUCKET_META` colours + `bucketColor/label`.

**Backend** `apps/api/src/services/dashboard-map.ts` + routes in `dashboard.ts`: `getDashboardMapCustomers` (customers with coords, exec=`created_by`, and dues bucket/amount from the SAME source as the Dues card — `invoices.outstanding_amount` + opening balances, oldest-invoice ageing in IST) and `getDashboardMapActivity` (today's `executive_latest_locations` positions [SE role], `visits` check-ins with coords, `gps_points` routes). 337/342 active customers plot.

**Leaflet + React StrictMode gotcha (cost hours):** the map's auto-fit `fitBounds` on load intermittently framed too far out (zoom 6 vs 8). Causes, all real: (1) an **animated** fit gets interrupted → use `animate:false`; (2) a fit measured while the dashboard width is still settling frames wrong; (3) StrictMode's dev double-mount + HMR churn orphans a second Leaflet map (fit hits the wrong instance). Mitigations in `osm-map.tsx`: **deferred-teardown** (setTimeout(0) in cleanup, cancelled on remount) so ONE map survives the double-mount; a **time-bounded fit loop** (re-fit only while zoom≠target, for ~2s after data/filter change, reading the live map) so the final fit lands at the settled width; RO does invalidateSize ONLY (never re-fit, or it resets a settled zoom). Still occasionally opens zoom-6 in the dev server (StrictMode/HMR) — the **Fit button** and filter-refit are always reliable, and production (single mount, no HMR) is deterministic. Verified live: pins/clusters/colours, popup (Pavan sai CUST-0233 ₹13,506 46-60d), executive filter (Sandeep → 137 shown, map reframes), SE-position chip. tsc/lint clean, 4 dashboard tests pass. Contrast [[project-dashboard-finance-cards]] (the Dues card this sits under).

**Tooltip ageing as a TABLE + ₹ owed per bucket (2026-09-08):** the inline coloured bucket chips in the district hover tooltip were replaced with a proper 3-column `<table>` — header `Ageing | Customers | Owed`, one row per bucket (coloured dot + label · customer count · total ₹ outstanding in that bucket) for **all 4 buckets always** (even 0-count, per user). Per-bucket ₹ = sum of `MapCustomer.outstanding` over customers whose `bucket===b` (each customer's whole outstanding attributed to their oldest-age bucket — same model as the Dues card). `border-collapse`, `font-variant-numeric:tabular-nums`, tooltip min-width 240px. Verified live: Bhadradri Kothagudem 0-30: 4/₹1,61,789 · 31-45: 2/₹28,129 · 46-60: 2/₹1,42,523 · 61+: 12/₹3,20,342 (owed sums to the ₹6,52,783 Total dues line). Builder `districtHoverTooltip()` in `osm-map.tsx`. **NO Total row** (added then removed per user). **"active (30d)" line REMOVED from the header** per user (2026-09-08) — header is now just `Name` + `N customers`; the backend `MapCustomer.active` field is still computed/sent but no longer displayed.

**District hover tooltip (custom card) + `active` 30-day flag (2026-09-08, UNCOMMITTED — needs api+web deploy):** each OVERVIEW customer-district polygon now has a **sticky hover tooltip** (`layer.bindTooltip(html,{sticky:true,direction:'top',offset:[0,-6],className:'district-tip'})`) showing: header `Name · N customers · <b green>N</b> active (30d)`, `Total dues: ₹X`, a **dues-bucket breakdown** (coloured dot + `label: count` per non-empty bucket, via `BUCKET_META`), and `Top exec(s): Name (count)` (top 2 by customer count, `executiveName ?? "Unassigned"`). Builder `districtHoverTooltip(name,list)` in `osm-map.tsx`. **"No dues" chip was REMOVED from the breakdown** per user (2026-09-08) — only the 4 real dues buckets show now. **Custom styling** (`ensureTooltipStyles()` injects a one-time `<style id="district-tip-styles">` into `<head>` — Leaflet builds tooltip DOM outside React so CSS must be global): `.district-tip.leaflet-tooltip` = white bg, 1px `#e2e8f0` border, 10px radius, `box-shadow 0 8px 24px rgba(15,23,42,.16)`, 10px 12px padding, `white-space:normal`; arrow `::before` recoloured white on all 4 directions. **`active` = placed ≥1 order OR made ≥1 collection in last 30 days (IST)** — added to the backend `getDashboardMapCustomers` query (`apps/api/src/services/dashboard-map.ts`) as two `exists(...)` subqueries over `orders.order_date`/`collections.collection_date >= (now() at tz 'Asia/Kolkata')::date - 30` (both indexed by customer_id), surfaced as `MapCustomer.active: boolean` (added to both the api service type and web `map-helpers.ts`). Local web hits LOCAL api :8787 (`.env.local` SRI_APARAJITA_API_BASE_URL), wrangler hot-reloaded. Verified live via real hover: Bhadradri Kothagudem — 33 customers · 11 active (30d) · ₹6,52,783 · 0-30:4 / 31-45:2 / 46-60:2 / 61+:12 · Srikanth (33); Khammam 63 active of 137. Custom card styling confirmed (white/10px/shadow), no "No dues" line. tsc/lint clean both apps. NOTE: mcp synthetic hover is flaky on Leaflet SVG paths (real CDP hover works; verify handler content by dispatching native mouseover on `path.leaflet-interactive`). Count badges stay `pointer-events:none` so hover reaches the polygon.

**Grey district lines only for customer districts + bold selected-district border (2026-09-08):** two related changes in `osm-map.tsx`. (1) REMOVED the two static all-district `L.geoJSON(TELANGANA_DISTRICTS)`/`(ANDHRA_PRADESH_DISTRICTS)` grey-line layers from the init effect — no more 61 lines for every district; dropped the now-unused `ANDHRA_PRADESH_DISTRICTS` import. Grey borders are now drawn ONLY around districts that HAVE customers (the 5 TG districts), inside the district effect. In OVERVIEW, each customer district's heat polygon `base` style gained a light-grey outline (`DISTRICT_LINE={color:'#94a3b8',weight:1,opacity:0.7}`, `stroke:true`) under the blue heat fill; hover still swaps to the bold dark-blue outline, mouseout restores the grey. Every empty district + ALL of AP now have NO line (mask still marks TG/AP). (2) In DETAIL (a district selected), the zoomed district now draws its **entire border as a bold dark-grey outline** — `SELECTED_DISTRICT_LINE={color:'#475569',weight:3,opacity:1}` via a non-interactive `L.geoJSON(feature,{style:{...,fill:false}})` added to the group alongside the dots. User's earlier light-grey `weight:1/0.7` outline read as "not visible" against the tiles; they asked for thicker+darker so the shape is traceable, keeping the current fitBounds framing. Verified live: selecting Mahabubabad shows its whole bold grey outline + 8 blue dots inside, full shape in frame. tsc/lint clean. UNCOMMITTED.

**Lightened the district divider lines (2026-09-08, superseded above for empty districts):** the grey district lines were thinned/lightened to `#94a3b8` weight 1 opacity 0.7 (from `#64748b`/`#475569` weight 1). Now only applies to the 5 customer districts (see entry above).

**Removed the coloured state outlines (2026-09-08):** dropped both `L.geoJSON(TELANGANA_BOUNDARY)` (indigo) and `L.geoJSON(ANDHRA_PRADESH_BOUNDARY)` (teal) outline layers from the init effect. KEPT the dim mask (user's choice) — it still uses the boundary geometry as its holes, so the state shapes still read from the dim edge + the outer grey district lines. TG/AP boundary imports still used (mask). Verified: 0 indigo + 0 teal strokes, 61 grey district lines, mask present.

**Richer dot popup + district heat-map (2026-09-08):** (1) the customer-dot popup now shows name (link to `/customers/:id`) → `City · Executive` → dues line (`₹X due · <bucketLabel>` or green "No dues") via `customerDotPopup()` (re-imported `rupees`/`bucketLabel`). Verified: "Ali Traders / Bhadrachalam · Srikanth / ₹2,439 due · 61+ days". (2) In OVERVIEW, each district-with-customers is now **shaded blue** (`HEAT_COLOR #2563eb`) with `fillOpacity = 0.18 + 0.42*√(count/maxCount)` — a smooth gradient (verified 0.28 for 8 customers → 0.60 for 137, monotonic), badges readable on top. Replaced the old transparent DISTRICT_BASE/HOVER: hover now KEEPS the shade fill and just adds a bold dark-blue outline (`stroke:#1d4ed8 weight:3`), removed on mouseout (`stroke:none`, shade preserved). Both tsc/lint clean.

**Viewport lazy-load + shimmer + framer fade + <100-line split (2026-09-08, UNCOMMITTED):** (1) **Viewport lazy-load** — the section only mounts the Leaflet map AND enables the `/dashboard/map` query once it scrolls into view, via `useInViewport()` (new `use-in-viewport.ts`, IntersectionObserver, `rootMargin:"200px"`, fires once then disconnects; falls back to in-view when IO unsupported, set in the `useState` initializer to avoid the `react-hooks/set-state-in-effect` lint). Query gated with `enabled: inView`. NOTE: on a tall viewport the map can be within the 200px preload margin at scroll 0 and load immediately — correct behaviour. (2) **Context-aware shimmer** — `MapShimmer` (`map-shimmer.tsx`, shadcn `Skeleton`) mirrors the map layout (zoom controls, Fit pill, district blobs + count badges, attribution strip); shown while fetching and as the `dynamic()` loading fallback. (3) **framer-motion fade-in** — the ready map is wrapped in `motion.div` (opacity 0→1 + scale 0.99→1, 0.4s easeOut). framer-motion ^13 already a dep. (4) **File split — ALL code files now <100 lines** (user rule; the huge GeoJSON DATA files `*-boundary.ts`/`*-districts.ts` are EXCLUDED per user). `osm-map.tsx` went 385→35 lines, split into: `map-constants.ts` (consts), `map-tooltip.ts` (escapeHtml+ensureTooltipStyles+districtHoverTooltip), `map-markers.ts` (customerDotPopup+districtCountIcon), `use-osm-map-init.ts` (map creation/tiles/mask/click-return/StrictMode teardown hook, 98), `use-district-layer.ts` (overview+detail draw effect hook, 91), `use-fit-button.ts` (Fit handler hook). Verified live after refactor: overview heat + badges render, detail click still yields bucket-coloured dots (same 4/2/2/12/13 tally). tsc+lint clean.

**Detail-mode dots coloured by ageing bucket (2026-09-08):** in DETAIL (district zoomed in), each customer dot's fill is now `bucketColor(c.bucket)` (from `map-helpers`) instead of the old uniform blue `#2563eb` — 0-30 emerald / 31-45 yellow / 46-60 orange / 61+ rose / **no-dues slate `#94a3b8`** (user's choice), matching the Collection Dues card. `DOT_STYLE` lost its `fillColor` (now set per-marker via `{...DOT_STYLE, fillColor: bucketColor(c.bucket)}`); white stroke + radius unchanged. Verified live (Bhadradri Kothagudem): dot fills tally 0-30:4 / 31-45:2 / 46-60:2 / 61+:12 / no-dues:13 = 33 customers, matching the tooltip.

**District click → zoom + customer dots (2026-09-08):** clicking a district (with customers) zooms to fit its polygon and enters DETAIL mode — shows that district's customers as **plain uniform blue circleMarker dots** (`DOT_STYLE`, `#2563eb`), HIDES all count badges. Click a dot → popup with the customer **name as an `<a href="/customers/:id">`** (plain link, full nav). Return: a click on the map **background outside the current district** (`map.on('click')` → `districtOf(latlng)!==selected` → `setSelected(null)` + `setView(HYDERABAD,7)`); clicks inside the district or on a dot don't return. Impl in `osm-map.tsx`: `selected` state (name|null) + `selectedRef` (synced via effect, NOT during render — lint `react-hooks/refs`), the district effect now branches on `[customers, selected]` (overview: hover polygons w/ click→select+fitBounds + badges; detail: dots), map-click handler bound once in init. All client-side (dots come from the existing `/dashboard/map` customer rows — id/name/lat/lng). Verified live via Leaflet-click dispatch + real click: 33 dots for Bhadradri Kothagudem, badges hidden, popup "Ali Traders"→/customers/…, outside-click restored the 5 badges + zoom 7. NOTE: mcp synthetic click/hover is flaky on Leaflet; real CDP clicks work (as will the user's).

**Stripped the section chrome (2026-09-08):** the whole header/legend row is gone — removed the MapPin icon, the "N shown" count, the exec/city `SearchSelect` dropdowns, the "Dues age" colour legend, and the "Today" activity toggles (SE positions/Check-ins/Routes). Section is now just `<h3>Customers Map</h3>` (renamed from "Customer map") + the map. Consequently REMOVED filtering (`customers` = all `/dashboard/map` rows, no exec/city filter) and the **entire activity overlay** (dropped the `options` + `activityQuery` queries in `dashboard-map-section.tsx`, and in `osm-map.tsx` the activity effect, `activity/showPositions/showCheckins/showRoutes` props, `activityRef`, `chipIcon`/`ringIcon`/`clock`/`IST_TIME`, and the CHECKIN/ROUTE/SE_* colour + `MapActivity` imports). Backend `/dashboard/map/activity` endpoint still exists but is now unused (not removed). Kept: district count badges + hover-highlight + Fit button + region lock + mask + TG/AP boundaries+districts. tsc/lint clean.

**District-only view + hover highlight (2026-09-08, phase 1 — "then we'll expand"):** REMOVED the customer markercluster entirely (no more dues-coloured green/amber/red bubbles + dots; dropped `leaflet.markercluster` import/CSS, `clusterRef`, `dotIcon`, `customerPopup`, and the `bucketColor/bucketLabel/rupees` imports). The map now shows ONLY the per-district total-customer **count badges** (dark slate pills). Added **hover-highlight** for districts that HAVE customers: in the count effect, for each TG district with count>0 draw a transparent-but-interactive `L.geoJSON` polygon (`DISTRICT_BASE={fill:true,fillOpacity:0,stroke:false,weight:0}`) with `mouseover`→`setStyle(DISTRICT_HOVER={fillColor:'#3b82f6',fillOpacity:0.25,color:'#1d4ed8',weight:2.5})` and `mouseout`→base. Badge divIcon got `pointer-events:none` so hover passes through to the polygon. `fitBoundsRef` still set (Fit button). Verified: 5 interactive paths (5 customer districts), handler toggles fill-opacity 0↔0.25 + stroke 0↔2.5, blue highlight visible. NOTE: mcp synthetic hover is flaky (real browser hover works fine). NOTE: map view sometimes resets to the Hyderabad overview on HMR re-mount (dev-only). User said "do till here, then expand" — more coming.

**Mask everything outside TG+AP (2026-09-08):** added a **dimming mask** so only Telangana + Andhra Pradesh read clearly. It's a single `L.geoJSON` Polygon whose OUTER ring is a world-covering rectangle and whose HOLES are the TG + AP outer rings (`[worldRing, TELANGANA_BOUNDARY.coordinates[0], ...ANDHRA_PRADESH_BOUNDARY.coordinates.map(p=>p[0])]`) — Leaflet's default `fillRule:'evenodd'` turns the inner rings into holes automatically (no winding fixups needed). Style `{ stroke:false, weight:0, fillColor:'#cbd5e1', fillOpacity:0.6 }` = neighbours faintly visible but dimmed (user chose "dimmed, light grey" over a solid cover). Added in the init effect right after the tile layer (UNDER the district/state outlines + pins, which stay crisp on top; markers are in a higher pane anyway). Verified: inside TG the tiles are bright, neighbours (Maharashtra/Karnataka/TN/Odisha/sea) are greyed.

**Andhra Pradesh boundary + districts, Hyderabad-centred overview (2026-09-08):** added the **AP state outline in TEAL `#0d9488`** (distinct from Telangana's indigo `#4f46e5`) + AP's **28 districts** (OSM admin_level=5 has 28 — 26 official + Markapuram/Polavaram; all non-overlapping, used as-is) as the same grey `#475569` divider lines. AP has **boundary lines only — NO count badges** (customers are all in Telangana). Data files `andhra-pradesh-boundary.ts` (Nominatim, MultiPolygon, dropped 2 tiny islands, ~22KB) + `andhra-pradesh-districts.ts` (Overpass `out geom`→osmtogeojson→RDP, ~68KB). Draw order in osm-map init: both states' grey districts first, then TG-indigo + AP-teal outlines on top. DOM-verified: 61 grey + 1 indigo + 1 teal paths. Region lock unchanged (already Telangana+AP `[[12.4,76.5],[20.4,85.5]]`, NOT all-India). **Also (2026-09-08):** map now **opens on the region overview centred on Hyderabad** (`HYDERABAD=[17.385,78.4867]`, zoom 7) and **NO LONGER auto-fits to the customer cluster** — the persistent fit-loop was removed; the **"Fit" button** is the only thing that zooms to the customer pins now (`fitBoundsRef` still tracks them). NOTE: true Hyderabad-centring is impossible while region-locked (Hyderabad sits at the region's west edge, so the maxBounds nudges the view east toward Khammam) — user was mid-deciding that trade-off when they pivoted to the AP work; left as overview.

**Telangana districts + per-district customer counts (2026-09-07):** overlaid all **33 Telangana districts** as thin grey divider lines (`#64748b`, weight 1) under the bold indigo state outline. Data: `telangana-districts.ts` (GeoJSON FeatureCollection, OSM via Overpass `admin_level=5` inside Telangana → `osmtogeojson` → Douglas–Peucker to ~2.8k pts, ~52KB; each Feature has `properties.name`). Typed `GeoJSON.FeatureCollection`. Plus a **customer-count badge per district** (dark slate pill at the district's vertex-average centroid, hover title = "District — N customers"), computed client-side by point-in-polygon (`district-helpers.ts`: `districtOf(lng,lat)` ray-casting w/ holes + multipolygon, `districtAnchors()` cached). The count effect keys on `[customers]` so it tracks the executive/city filters. Verified live via DOM read: Khammam 137, Nalgonda 83, Suryapet 75, Bhadradri Kothagudem 33, Mahabubabad 8 → sum 336/337 (1 customer just outside a simplified edge; the other 28 districts show no badge). Note: at region zoom the dark count badges visually overlap the coloured markercluster bubbles near Khammam — accepted. To refetch districts: Overpass `area["name:en"="Telangana"]["admin_level"="4"]; rel["admin_level"="5"]["boundary"="administrative"](area); out geom;` (admin_level=6 is MANDALS, not districts).

**Telangana border highlight + taller map (2026-09-07):** map height raised from `h-[520px]` to `h-[70vh] min-h-[480px]` (fills the screen). Added a **Telangana state boundary overlay** — `apps/web/src/features/dashboard/map/telangana-boundary.ts` (GeoJSON Polygon from OSM/Nominatim, Douglas–Peucker simplified 15,925→752 pts, ~13KB, credited © OSM). Drawn once in the init effect via `L.geoJSON(TELANGANA_BOUNDARY, { interactive:false, style:{ color:'#4f46e5', weight:2, opacity:0.9, fillColor:'#4f46e5', fillOpacity:0.05 } })` — indigo outline + faint fill, under the pins, non-interactive so it doesn't swallow marker clicks. Type it `GeoJSON.Polygon` (the global namespace from @types/leaflet — do NOT `import from "geojson"`, that module isn't resolvable here). Verified: 1 overlay path stroke #4f46e5, outline matches Telangana's real shape. To fetch a boundary: `curl -A "<ua>" "https://nominatim.openstreetmap.org/search.php?state=Telangana&country=India&polygon_geojson=1&format=jsonv2&limit=1"` then RDP-simplify the closed ring (split at farthest point first — a closed ring's identical endpoints break naive RDP).

**Region hard-lock + single-host tiles (2026-09-07):** switched the tile URL to the single host `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (the `{s}` a/b/c subdomains are deprecated under HTTP/2); mandatory `© OpenStreetMap contributors` attribution was already present. **Hard-locked the map to the operating region (Telangana + Andhra Pradesh)** so it can never drift to the whole country/world: `L.map(..., { minZoom: 6, maxBounds: L.latLngBounds([[12.4,76.5],[20.4,85.5]]), maxBoundsViscosity: 1.0 })`. Verified live: 5× zoom-out stays at zoom 6 (no world); a hard drag pans only within the region then clamps. Bonus — this also bounds the framing-race worst case (can't show the globe). REGION_BOUNDS/REGION_MIN_ZOOM consts in osm-map.tsx.

**Dropdown-behind-map z-index fix (2026-09-07):** the exec/city filter `SearchSelect` popovers (portaled at `z-50`) opened BEHIND the map — Leaflet's panes/controls use z-index up to ~1000 and, without their own stacking context, competed at the root and won. Fix: added `isolate` (`isolation:isolate`) to the map container div (`dashboard-map-section.tsx`) so Leaflet's z-indexes stay contained and the portaled dropdowns render above. (Dues-card dropdowns were unaffected — no map there.) Verified both dropdowns now open fully over the map.

**Filters + segment sales analytics (2026-09-09, UNCOMMITTED — needs api+web deploy):** Reintroduced the Customers-Map filter row — **Executive + City + Segment** dropdowns (SearchSelect, same pattern as the Dues card; cities scoped to exec via `/customers/filter-options?executiveId=`). Below the title, `MapStats` shows: **total (filtered) customer count**, the selected **segment's share of ALL oil sales** ("Car is 29.8% of all oil sales (litres, all-time)"), and — when an exec is selected — that **exec's segment mix** (each segment's % of their own litres, sums to 100%, sorted desc: "Srikanth's oil mix: Car 33% · Commercial 29% · Gear Oil 14% · 3W 9% · 2W 8% · Agri 7%"). All three dropdowns filter the map pins (exec=executiveId, city=exact city, segment=customer has net litres in that segment) + the count; the map re-fits to the filtered set (use-osm-map-init fit effect now re-runs on `customers` change, skipped while a district is drilled). New files: `map-filters.tsx`, `map-stats.tsx`, `map-segments.ts` (pure helpers: litresById/boughtSegment/segmentShares/executiveSegmentMix). NEW API: `GET /dashboard/map/segments` → `{ segments: OIL_SEGMENTS, customers: {customerId, litres:{seg:litres}}[] }` = per-customer per-segment ALL-TIME net oil litres (returns netted, cancelled excluded), `getDashboardMapCustomerSegments` in services/dashboard-map.ts (reuses OIL_SEGMENTS from targets.ts — 6 segments: Car/2W/3W/Commercial/Agri/Gear Oil). Client computes all stats from this one dataset. VERIFIED live (exec/city/segment filters, count, share%, exec mix all render + filter + re-fit). tsc+lint clean web+api. NOTE: segments=oil only (bearings excluded per user). Also this session: customers-map now full-viewport-height card (h-[calc(100vh-7rem)], flex col, kept card padding) + Live-Tracking loading overlay (shared MapLoadingOverlay, min 700ms) + smooth drill (flyToBounds in / flyTo→fitBounds out) + framer veil crossfade; deleted map-shimmer.tsx.

---

## project-dashboard-productivity-pill.md

---
name: project-dashboard-productivity-pill
description: "Web SA/Manager dashboard drill-downs now show the mobile-style colour-graded \"Productivity N%\" pill on both the Visits and Productive Visits per-SE lists."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0f5fcc13-0b06-4233-bc4a-f22ce737e455
  modified: 2026-09-07T11:36:45.522Z
---

**2026-09-07 (part 2, UNCOMMITTED, needs api+web deploy).** Extended the pill to the **customer detail → Visits tab** (`apps/web/src/features/customers/customer-visits-tab.tsx`) + added the weekday to that table. Per the user: (a) a colour-graded **Productivity N%** pill sits **beside the "Custom range" calendar** button, reflecting the **currently-selected range** (Today/Week/Month/All-time/custom — recomputes as the filter changes); (b) "productive" here = a visit that produced an **order OR collection** (NOT market-intel photo, unlike the dashboard); (c) Date & time cells now lead with the short weekday — `format(d, "EEE, dd MMM yyyy")` → "Mon, 07 Sep 2026" (also applied to the missed-beat rows). Backend: `getCustomerVisits` (`apps/api/src/services/customer-visits.ts`) now returns `productive` alongside `total` — a `count(*) filter(where exists order(cust+SE+date) or exists collection(cust+date))` over the same range as `total`. Extracted `productivityColor` to shared `apps/web/src/lib/productivity.ts` (dashboard drilldown imports it too — single source). Verified: backend SQL run against prod (9th Gear CUST-0061 → 7 total / 4 productive = 57%); frontend pill+weekday via throwaway harness, deleted. tsc/lint clean; the 4 `customers.test.ts` POST failures are PRE-EXISTING (customer-create, not visits).

**2026-09-07 (part 3, UNCOMMITTED, needs api+web deploy).** Missed-beat rows in the customer Visits tab now **interleave by date** instead of being pinned atop page 1, and show a **7:00 PM** time. Per the user: missed stay **uncounted** (the "N visits" number, tiles, and pagination remain real check-ins only) and do **not** affect the Productivity pill. Backend `getCustomerVisits` missed query now returns `at` (the 7 PM IST instant = `(plan_date::timestamp + interval '19 hours') at time zone 'Asia/Kolkata'`) and `newer` (count of real check-ins newer than that instant). Frontend assigns each missed row to a page via `min(floor(newer/8)+1, pageCount)` (clamp = oldest-than-all lands on the last page), then merges that page's real rows + its missed rows into one `feed` sorted newest-first by timestamp (`tsOf`); extracted a `VisitTableRow` component. Verified vs prod (CUST 2d84aecc: missed 28 Aug → at=13:30Z=7PM IST, newer=2 → sits below 01 Sep, above 25 Aug) + harness screenshot, deleted.

**2026-09-07 (UNCOMMITTED, needs web deploy).** Brought the mobile Super Admin "Productivity %" pill to the web dashboard. Mobile's Productive Visits drill (`apps/mobile/.../home/kpi-drill-row.tsx`) shows a colour-graded pill (productive ÷ total visits, HSL hue 0°→120° red→amber→green, `hsl(h,68%,92%)` bg + `hsl(h,72%,30%)` fg). Ported that exact scale into the web drill-down `apps/web/src/features/dashboard/metrics-drilldown-agents.tsx` (`productivityColor` helper + a `Productivity N%` pill in each SE row's right side).

Per the user (this goal): the pill shows on **BOTH** the Visits drill AND the Productive Visits drill (mobile only shows it on Productive Visits). `pct = round(productiveVisits / visits * 100)`, shown only when `visits > 0`. Web already had the "Productive Visits" metric card + the "N productive" subline; only the pill was missing. Verified in-browser via throwaway `/prod-check` harness (12%/14% red, 32% orange, 50% amber, 95% green), harness deleted. tsc/lint clean. Relates to [[project-visit-outcomes]] (same drill-down component).

---

## project-deploy.md

---
name: project-deploy
description: Cloudflare deployment setup — how frontend and backend are deployed
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e09476c-7019-45a2-84c0-72fe0bdd509a
  modified: 2026-08-13T07:05:06.638Z
---

Frontend is deployed as a **Cloudflare Worker** (not Pages) at `https://sri-aparajita-web.vardhansystems.workers.dev`.

**Why Worker not Pages:** OpenNext sets `__ASSETS_RUN_WORKER_FIRST__: false`, which requires Cloudflare to serve static assets before the worker. This only works with the Workers + `[assets]` binding model, not `wrangler pages deploy`.

**Deploy command:** `pnpm run deploy` from `apps/web` (runs `opennextjs-cloudflare build && wrangler deploy`). NOTE: use `pnpm run deploy`, NOT `pnpm deploy` — bare `pnpm deploy` invokes pnpm's builtin deploy command ("No project was selected for deployment"), not the package script.

**Build gotcha (2026-08-13):** `globals.css` does `@import "shadcn/tailwind.css"` (the `shadcn@4.13.0` npm pkg ships `dist/tailwind.css`). If the build fails with "Can't resolve 'shadcn/tailwind.css'", the workspace `node_modules` is partial (running `pnpm --filter X add …` can leave other packages unmaterialized). Fix: `pnpm install --force` at the repo root to rematerialize, then rebuild.

**wrangler.toml key config:**
```toml
main = ".open-next/worker.js"
[assets]
directory = ".open-next/assets"
run_worker_first = false
```

**Secrets required on the Worker:**
- `SRI_APARAJITA_API_BASE_URL` = `https://api.vardhansystems.workers.dev`
- `JWT_SECRET` = same value as the API worker

**Backend (API):** deployed at `https://api.vardhansystems.workers.dev` via `wrangler deploy` in `apps/api`.

**Root cause of stale lockfile bug:** `apps/web/pnpm-lock.yaml` was a stale file that caused Turbopack to detect two lockfiles and fail. Deleted it. Do not recreate.

**Why:** Turbopack uses the topmost lockfile as workspace root. With two lockfiles (apps/web + monorepo root), it used monorepo root but couldn't find `next` (not hoisted). Deleting `apps/web/pnpm-lock.yaml` left only one lockfile so auto-detection works.

---

## project-dev-server.md

---
name: project-dev-server
description: "Why root `pnpm dev` excludes the MCP worker (9229 inspector port clash) + how to run each piece locally"
metadata: 
  node_type: memory
  type: project
  originSessionId: 62e3d7c6-d6a4-498b-9f38-eea58c1f2635
  modified: 2026-08-13T12:40:11.897Z
---

Root `pnpm dev` is `turbo run dev --filter=!@sri-aparajita/mcp` (changed 2026-08-13). Only **api (8787)** + **web (3000)** run; **mcp is excluded on purpose**.

**Why:** both `apps/api` and `apps/mcp` run `wrangler dev`, and wrangler's default V8 **inspector port is 9229**. Running them together made the 2nd wrangler fail with `Address already in use (127.0.0.1:9229)`, and because Turbo tears the whole run down on one task failure, it killed web + api too — so `pnpm dev` appeared to "crash" but the real cause was the port clash. Excluding mcp (it's a standalone remote worker, not part of the web app) removes the 2nd wrangler entirely.

**Run each piece:** `pnpm dev` (api+web) · `pnpm dev:web` · `pnpm dev:api` · `pnpm dev:mcp` (runs mcp standalone — added same change) · `cd apps/mcp && pnpm dev` also works. Only apps/api, apps/web, apps/mcp have `dev` scripts (db/shared/mobile don't).

**Gotcha:** killing a `wrangler dev` and instantly restarting can throw a one-off `SENTRY_DO SQLite ... SQLITE_BUSY` on boot (old workerd's local SQLite still releasing) — it self-recovers; a clean single start doesn't show it.

Web still talks to the DEPLOYED API by default (`SRI_APARAJITA_API_BASE_URL`) even when local api runs — see [[project-local-web-uses-deployed-api]]. Deploy flow in [[project-deploy]].

---

## project-dialog-system.md

---
name: project-dialog-system
description: "Unified dialog kit (sticky header/body/footer frame, size tiers, DialogSection) applied to all 30 dialogs — enterprise redesign"
metadata: 
  node_type: memory
  type: project
  originSessionId: 83399742-4811-416d-a6a9-2c186cf7bcab
  modified: 2026-08-04T12:31:24.993Z
---

2026-08-04: Redesigned every dialog in apps/web into ONE shared system (branch `dialog-system`). Direction chosen by the client: spacious & comfortable, sticky frame on all dialogs, labeled sections in long forms, keep the existing brand blue. Mockup was signed off first (artifact "Beyond Dialog System").

**The kit — `apps/web/src/components/ui/dialog.tsx`:**
- `<DialogContent size="sm|md|lg|xl">` — fixed width tiers **500 / 640 / 880 / 1080 px** (replaced 7 ad-hoc widths). Flex column capped at `max-h-[85vh]`, darker backdrop (`bg-foreground/25`).
- `<DialogHeader>` (pinned, border-b) · `<DialogBody>` (the ONLY scroll region, `min-h-0 flex-1 overflow-y-auto`) · `<DialogFooter>` (pinned, plain surface + border-t, actions right, primary last). So the primary action is ALWAYS visible — fixes the old tall-form overflow where Save sat below the fold.
- New `<DialogSection label="…">` — uppercase label + rule for grouping long forms.
- Pattern for forms: `<form className="flex min-h-0 flex-1 flex-col">` wraps Header/Body/Footer. Body uses `space-y-4` (flat) or `space-y-6` (sectioned). Reference impl: `products/product-create-dialog.tsx`.

**Conventions:** sentence-case titles/buttons ("Save changes", "Create customer"), destructive uses `<Button variant="destructive">` (no hardcoded bg-red-600), one inline-error style (`bg-destructive/10`), busy button labels.

**Scope:** all 30 DialogContent files converted + shared `ConfirmDialog` + `customers-form-fields.tsx` (sectioned into Identity·Contact·Classification·Tax IDs·Address·Credit). Tiers: sm=confirms/tiny, md=standard forms, lg=rich/sectioned forms, xl=viewers.

**Verified:** tsc + eslint clean on all 34 files; browser-verified L sectioned (Add Customer — sticky header+footer while body scrolls), M form (Add Product), S destructive confirm (Delete product), lg viewer (metrics drilldown). Web tests: 7 failures are all PRE-EXISTING (login/dashboard/super-admin jest-dom matcher + router-mock issues), no new failures. Web-only change, no API/migration. Related: [[project-url-list-state]].

---

## project-dues-buckets.md

---
name: project-dues-buckets
description: "Collection-dues ageing buckets (0-30/30-45/45-60/60+) + SE crossing notifications, shipped 2026-07-24 (migration 0039)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f686e535-ba24-4529-89c2-88f359d5400b
  modified: 2026-08-17T19:20:51.098Z
---

Collection-dues ageing shipped 2026-07-24 — the last feature from the 2026-07-23 invoices-first roadmap (now fully done).

**Model (user-decided):** age basis = **invoice date** (IST); each customer with outstanding sits in exactly **one** bucket by their **oldest invoice with outstanding > 0**; buckets `0_30`(≤30) / `30_45`(31–45) / `45_60`(46–60) / `60_plus`(>60).

**Pieces:**
- Migration `0039_customer_dues_state.sql` (applied live): `customer_dues_state` remembers last bucket per customer for crossing detection.
- API: `services/dues.ts` + `routes/dues.ts` — `GET /dues/me/summary`, `GET /dues/me/customers?bucket=` (SE-only, scoped `customers.created_by`).
- Cron (3-min schedule) calls `runDuesMaintenance`: self-gates to once per IST day after 9 AM via `system_settings.dues_last_run_date` (atomic insert/update-where-changed). Upward crossing → `se_notifications` type `dues_bucket` + Expo push; first sight seeds silently (no flood); downward silent; cleared dues delete state.
- Mobile: Home `DuesCard` (2×2 tappable tiles) → `/dues/[bucket]` list → customer page; offline via `performance_cache` rows `dues_summary`/`dues_<bucket>`. Alerts screen "Collections due" section renders the feed (tap = mark read only).

**Verified live 2026-07-24:** Janatha Garage (₹5,836 invoice dated 2026-05-26, 59 days) in 45–60; simulated 1→2 crossing produced the notification + feed entry; emulator UI E2E-checked. API deployed.

**Tap dues alert → customer ledger (2026-08-08, API deployed + verified):** migration `0056_notification_customer.sql` added nullable `se_notifications.customer_id` (FK `on delete set null`); `dues.ts` now populates it on each dues-bucket notification insert; `listMyNotifications` returns `customerId`; mobile `InvoiceNotification` gained `customerId`; Alerts `onDues` marks read + `router.push('/ledger/[id]', {id: customerId, customerName: title minus "Dues alert: "})`. Red chevron shows ONLY when `customerId` present. **No backfill** (user's choice) — existing dues notifications stay null/non-navigating; new cron-created ones navigate. Verified on emulator: JS Automobiles dues alert → its Ledger (₹66,040 Dr). **Also (same day)** the dues-bucket drill-down list (`app/dues/[bucket].tsx`) customer tap now opens `/ledger/[id]` (was `/customer/[id]`) — mobile-only, no API change (dues list already carries customerId+name); verified Sai Ram Motors (30–45d) → Ledger ₹35,900 Dr. NOTE: mobile JS change needs a new APK for field phones; one existing notif (JS Automobiles) was manually given a customer_id for the test. See [[project-alerts-reminders]], [[feedback-nativewind-shadow-crash]].

**Display-label fix (2026-08-18, ⚠ NEEDS API DEPLOY):** the shown labels were overlapping/off-by-one vs the actual SQL. The math has always been non-overlapping — `age_days <= 30 → 0`, `<= 45 → 1`, `<= 60 → 2`, else `3` (so age 30→bucket0, 31→bucket1, 46→bucket2, 61→bucket3). Corrected the DISPLAY text everywhere to match: **0–30d / 31–45d / 46–60d / 61d+** (en-dash; keys `0_30`/`30_45`/`45_60`/`60_plus` UNCHANGED — used in URLs/DB). Edited: mobile SE `components/dues-card.tsx` + `app/dues/[bucket].tsx` ("Dues · 31–45 days" etc.), mobile SA `components/admin-dues-card.tsx` + `app/(admin)/dues.tsx`, and API `services/dues.ts` `DUES_BUCKET_LABELS` ("31–45 days"/"46–60 days"/"61+ days") — the server labels also feed the SE dues-crossing push text ("moved into the … bucket") + the `label` field in the summary/customers response, so this part **needs `pnpm -C apps/api deploy`**. Updated 2 API tests (`routes/dues.test.ts`, `services/dues.test.ts`) to the new labels; all 7 dues tests pass. Verified live on SA Home card + SA dues screen. Label-only — no customer changes bucket. Web has NO dues-bucket UI (mobile-only).

**Gotchas:** running `runDuesMaintenance` in local Node (IST tz) makes Neon date→`toISOString` shift a day (one test notification says "since 2026-05-25"); Workers/UTC is correct. Customer "Balance" on mobile uses the credit-balance model (net of advance collections) and can differ from invoice-outstanding dues (Janatha: balance ₹836 vs dues ₹5,836 — the ₹5,000 collection was verified before the invoice existed so was never allocated to it).

---

## project-dues-ledger-truth.md

---
name: project-dues-ledger-truth
description: Collection Dues / outstanding = stateless ledger Total Debit Balance (single source of truth); reconcile drift
metadata: 
  node_type: memory
  type: project
  originSessionId: e0779741-786e-4ffd-b0de-e5dad287996f
  modified: 2026-09-07T08:16:09.382Z
---

**2026-09-07 — mobile customer-page balance MIGRATED to ledger truth (the last holdout; UNCOMMITTED, needs api deploy).** The mobile customer-detail "Balance" (hero-card.tsx `credit.totalOutstanding`) + the credit-block gate came from `customers.ts` `listCustomerInvoices`, which still used the OLD drift math: `Σ invoices.outstanding_amount + opening_outstanding − advanceCredit`, where `advanceCredit = Σ verified collections − Σ verified allocations`. That double-counts any collection paying down a debt WITHOUT a `collection_allocations` row — payments against an OPENING balance never get one, and some invoice reconciles reduced outstanding_amount without one → phantom "advance credit" (green Cr). PROVEN on prod: Satyam CUST-0010 showed −₹1,960 vs ledger ₹0 (COLL-0201 ₹1,960 no allocation row); Afreen CUST-0201 showed −₹3,849.30 vs ledger ₹0.35 Dr (opening-balance payments, 35000 collections − 31150.35 allocations). FIX: replaced `totalOutstanding` with the same stateless ledger balance (opening_amount + Σ non-rejected invoice_net_value − Σ non-rejected collections − Σ returns) via a `customer_net_ledger_balance` query; creditBlocked now guards on it. Verified: new formula returns 0.00 / 0.35 on prod (matches ledgers); tsc clean; the 2 mobile-sync credit-gate tests updated (mock the new query) and pass; the 4 remaining mobile-sync failures are PRE-EXISTING (POST create 201, fail on clean baseline). No mobile rebuild needed (reads the field). advanceCredit still returned for compat.

2026-08-22: Reworking reconciliation so **dues = the ledger's Total Debit Balance everywhere**, computed STATELESSLY (never drifts). Triggered by SRI LAKSHMI showing Collection Dues ₹14,360 vs ledger ₹17,628.

**Root problem:** the old dues expressions read `invoices.outstanding_amount` + a held-credit hack, and `outstanding_amount` is maintained by incremental `+=/-=` at collection verify/edit only — it drifts (a ₹0 collection with a phantom ₹3,268 allocation over-credited an invoice; collections recorded before their invoice never applied; invoice re-uploads reset outstanding without re-applying collections; pending collections not counted).

**Agreed ground-truth formula (user-confirmed):**
`balance = customer_opening_balances.opening_amount + Σ(invoices where approval_status<>'rejected' .invoice_net_value) − Σ(collections where accountant_approval_status IS DISTINCT FROM 'rejected' .collection_amount) − Σ(sales_returns.gross_amount)`
- Positive = owes (Dr), negative = credit (Cr). Uses `opening_amount` (original), NOT `outstanding_amount`.
- Collections are NON-REJECTED (incl. **pending** — user chose to match today's ledger) and INCLUDE credit notes (payment_mode='credit_note' rows live in `collections`; don't double-count them).
- This is exactly `assembleLedger`'s math (services/customers.ts).

**LAYER 1 — DONE (uncommitted, needs api+web deploy):** replaced the drift-prone expression with the ledger formula in:
- `COLLECTION_DUES_EXPR` (services/customers.ts) — Customers list column. Web `customers-columns.tsx`: owes=**red**, credit=**green + "Cr"** (user's color rule).
- `kpi_outstanding` + leaderboard `outstandingDue` (services/kpis.ts). New KPI Outstanding total ₹36,94,448.60 (was ₹37,57,346). All three now identical math → reconcile, can't drift. tsc clean both apps.
- Real impact: only **9 customers'** displayed dues change (all downward to true value; were over-charged, mostly by ignored pending collections). NB my FIRST dry-run was WRONG — it used opening_outstanding not opening_amount, fabricating a ₹145k Manikanta "bug" and a 19-customer list; the correct list is 9.

**LAYER 2 — DONE (uncommitted, needs api deploy):** per-invoice `outstanding` now recomputed from ground truth so ageing views (overdue, buckets, oldest-unpaid, credit-gate) sum to the ledger. Decisions: **oldest-debt-first** (opening then invoices by due date; explicit S7 targeting superseded); **aggregates-only + append** (recompute invoice.outstanding/amount_collected/payment_status + opening.outstanding; keep existing allocations/reconcile; append recompute after each mutation).
- `services/reconcile-recompute.ts`: pure `recomputeAggregates` (integer paise, single credit pool = Σ non-rejected collections, returns lower per-invoice debt) + DB `recomputeCustomerBalances(sql, customerId)` (one transaction). 7 tests pass.
- Wired (append `recomputeCustomerBalances`) into 8 mutations: collections create/verify/update/reject, invoices create/update, sales-returns create/update. tsc clean.
- **One-time repair RUN ON PROD** (self-verifying psql transaction, aborts if ageing≠ledger): 19 invoices + 2 opening balances corrected; verified ageing total ₹36,89,448.60 = ledger; SRI LAKSHMI/Umesh/Ayyappa/JS/Mohd-Sallauddin all reconcile OK.
- NOTE: 14 PRE-EXISTING api route-test failures (collections/customers/visits/mobile-sync) are a mock-harness issue, NOT from this work — baseline without my edits fails identically.

**Data fix already applied to PROD (approved):** SRI LAKSHMI COLL-0096 phantom ₹3,268 allocation removed; invoice BAL/26-27/0048 → outstanding ₹3,268 / partially_paid. (Other drift left for Layer 2's repair.) See [[project-kpis-load-optimization]] (same kpis.ts file), [[project-dues-buckets]], [[project-invoices-section]].

---

## project-error-monitor-dupkey-merge.md

---
name: project-error-monitor-dupkey-merge
description: Error Monitor merges ALL duplicate-key NeonDbErrors into one mislabeled group; the shown route/constraint may not match the real failing endpoint.
metadata: 
  node_type: memory
  type: project
  originSessionId: 0f5fcc13-0b06-4233-bc4a-f22ce737e455
  modified: 2026-09-07T09:54:12.605Z
---

**Error Monitor fingerprint gotcha (found 2026-09-07).** `fingerprintOf` in `apps/api/src/services/errors.ts` builds the group key from `[source, kind, normalizeMessage(message), topFrame(stack)]`. `normalizeMessage` replaces any quoted string with `<str>` (line ~56), so `duplicate key value violates unique constraint "X"` normalizes identically for EVERY table X. Combined with `kind="NeonDbError"` and an identical neon-driver `topFrame`, **all duplicate-key 500s across all tables/routes collapse into ONE error_group.** The group's `title` is frozen from the FIRST event and `sample_route` is the first non-null route — so the list row can show one table's constraint at one endpoint while the 39 events actually span multiple routes/constraints.

**To see the truth, query `error_events` per group** (route + message), don't trust the group title/sampleRoute. Example that cracked task_9ab8b55b: the group titled `visits_client_uuid_unique @ /tracking-sessions/start` was really 30 `/visits/checkin` (visits_client_uuid_unique, stopped 09-04, already guarded) + 9 `/tracking-sessions/start` (gps_tracking_sessions_client_session_id_key, ongoing).

**Fix applied that day:** `startTrackingSession` (`services/tracking-sessions.ts`) was a check-then-insert with no `on conflict` → concurrent/replayed Start Day threw 23505. Made idempotent on the deterministic `client_session_id` (pre-insert `sessionByClientSessionId` replay lookup + `on conflict (client_session_id) where client_session_id is not null do nothing` + re-fetch winner + catch `one_active_per_user_device` race), mirroring visits/orders/collections. Returns existing (200) on replay, never 500. Test added; UNCOMMITTED, **needs api deploy**. See [[project-checkin-beat-race-fix]] (the visits/checkin side, already fixed earlier).

---

## project-error-monitoring.md

---
name: project-error-monitoring
description: "In-house error monitoring (Sentry replacement): error_groups/events/notes + API capture + ingest + SA-only web /errors viewer with triage"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81771ad0-d42b-4b51-a8ef-ce7de64a6ce9
  modified: 2026-08-23T05:05:54.815Z
---

2026-08-23: Built an IN-HOUSE error monitor (user chose over 3rd-party like Sentry) — captures errors from API + web + mobile, dedups them, and a SUPER_ADMIN-only web page triages them. Vertical slice DONE + verified against localhost worker → prod DB. UNCOMMITTED. Migration 0071 APPLIED to prod DB (additive, safe). Needs api+web deploy.

**Schema (migration `0071_error_monitoring.sql`, applied):** `error_groups` (dedup by `fingerprint` unique; status open|resolved|ignored; occurrence_count; assigned_to/resolved_by users FK ON DELETE SET NULL), `error_events` (per-occurrence, group_id cascade, jsonb context), `error_notes` (group_id cascade). No organization_id.

**API:**
- `services/errors.ts` — `captureError` writes group+event in ONE atomic CTE (1 subrequest, safe in waitUntil); `fingerprintOf` (FNV-1a hex over source|kind|normalized-message|top-stack-frame — normalizes uuids/numbers/quoted-strings so similar errors group); `listErrorGroups`/`errorSummary`/`getErrorGroupDetail`/`updateErrorGroup`/`addErrorNote`; `cleanupOldErrors` (90-day retention, self-gated once/IST-day via system_settings `errors_last_prune_date`, added to the */3 maintenance cron in index.ts).
- Capture hook in `lib/errors.ts` `errorHandler`: on unhandled throw OR ApiError status>=5xx, fire `captureError` via `ctx.waitUntil` (best-effort, swallows own errors, never changes the response). 4xx client errors NOT logged. Type-only import of SqlClient avoids a runtime cycle (db.ts→errors.ts→services/errors.ts).
- `routes/errors.ts` mounted at `/errors`: `POST /ingest` (requireAuth ANY role — web/mobile report own errors; userId/role from token not body), `GET /` `GET /summary` `GET /assignees` `GET /:id` `PATCH /:id` (status+assignee) `POST /:id/notes` — all SUPER_ADMIN-only.
- **Regression reopen:** a new occurrence of a RESOLVED group auto-reopens it (clears resolved_by, keeps assignee); IGNORED stays muted.

**Web (SUPER_ADMIN only):** `app/(dashboard)/errors/page.tsx` (SA-guard) + `features/errors/` (errors-api.ts, errors-view.tsx = summary cards + status tabs + source filter + table, error-detail-drawer.tsx = stack/occurrences/resolve·ignore·reopen/assignee/notes, errors-shared.ts). Nav item "Error Monitor" (Bug icon) added to SUPER_ADMIN Management section in `features/shell/dashboard-nav.tsx` (NavKey "errors").

**Verified:** ingest dedup (2 identical→1 group count 2), SA endpoints 403 for SE token, resolve+assign+note SQL, regression-reopen (live). tsc clean (api+web). 7 new fingerprint tests + full api suite (the 14 failing route tests are PRE-EXISTING mock-harness 422s, unrelated — my capture only fires on 5xx). Web UI typechecks but NOT render-verified (needs an SA web login — I only have SA user ids, not passwords; SA users incl. "Vishnu Vardhan" b9ab71aa, distinct from SE vishnuvardhan@).

**CLIENT CAPTURE WIRED (2026-08-23):**
- Web: `app/api/report-error/route.ts` (same-origin proxy, cookie→token→`/errors/ingest`, forces source=web, always 2xx) + `lib/report-error.ts` (`reportWebError` fire-and-forget + de-dup + keepalive; `installWebErrorReporting` window error/unhandledrejection listeners) wired into all 3 boundaries (`error.tsx`, `global-error.tsx`, `(dashboard)/error.tsx`) + `components/web-error-reporter.tsx` mounted in root `layout.tsx`. Unauthenticated errors dropped (204).
- Mobile: `lib/report-error.ts` (`reportMobileError` — plain fetch to `${API_BASE_URL}/errors/ingest`, token from `useAuth.getState()`, appVersion from expo-constants, de-dup, never throws, no-op when signed out) wired into `_layout.tsx` `ErrorBoundary` (render, fatal) + the `installGlobalErrorLogging` ErrorUtils handler.
- **PROVEN LIVE end-to-end (2026-08-23):** MOBILE — a real app error (temp trigger via `ErrorUtils.reportError`) fired the global handler ([BeyondCrash] logged) → `reportMobileError` → `/errors/ingest` → a `mobile` error_group appeared. WEB — POST to `/api/report-error` (with a `beyond_auth` cookie = raw token) → 202 → forwarded → a `web` error_group appeared. Temp mobile crash-trigger REMOVED; both tsc clean. All test error data DELETED from prod (error_groups/events/notes back to 0/0/0). Note learned: Metro's watcher misses `_layout.tsx` edits — needs `expo start --clear` + a fresh relaunch to reload root-layout changes. `beyond_auth` cookie stores the RAW token (unsigned), and the web login route sets it for ANY role. Also: 3 TEST error rows seeded in prod (2 "Cannot read property…"/"Network request failed" + note) — left so the dashboard shows populated; purge with `delete from error_groups where source in ('web','mobile') and title like '%property name of undefined%' or title like 'Network request failed%'`.

---

## project-expenditure-analytics-pending.md

---
name: project-expenditure-analytics-pending
description: Expenditure analytics (more charts + period comparison) fully specced 2026-07-24 but DEFERRED — spec lives in docs/PENDING-EXPENDITURE-ANALYTICS.md
metadata: 
  node_type: memory
  type: project
  originSessionId: 8edc5668-998c-4acd-b68d-d2f6046de98e
  modified: 2026-07-24T10:10:17.520Z
---

Expenditure analytics — more charts plus vs-previous-period comparison — was **fully specced and agreed on 2026-07-24, then deferred** by the user to work on something else. **Do not re-ask the design questions**; every decision is recorded in `docs/PENDING-EXPENDITURE-ANALYTICS.md`. Just build from that file when the user returns to it.

Headline decisions: period picker moves to the top-left of "+ Category" with presets (This month / Last month / Last 3 / Last 6 / This year / Custom); comparison is **automatic against the immediately preceding equal span**; delta badges on all four summary cards (zero baseline shows "new", not ∞%); four charts in a 2-up grid — existing donut, a **merged** 12-month stacked compulsory/variable bar chart, top-8 category this-vs-previous bars, and per-person this-vs-previous bars for any entry with a person link; **everything filters together** (type/category/search drive charts, cards and table). One new endpoint `GET /expenditures/analytics` returns current + previous + 12-month series + per-person in a single round trip.

Critical carry-over: **every Recharts chart in this app needs `isAnimationActive={false}`** — Recharts 3.8 + React 19 builds the sector/bar groups but never emits their `<path>` elements when entry animation is on, so the chart renders blank. Percentage radii also don't resolve in v3; use numbers. See [[project-expenditures]].

---

## project-expenditures.md

---
name: project-expenditures
description: "Expenditure section for SA/Manager/Accountant — compulsory vs variable categories, bills, person link (migration 0040, 2026-07-24)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f686e535-ba24-4529-89c2-88f359d5400b
  modified: 2026-07-24T06:25:52.717Z
---

Expenditure tracking shipped 2026-07-24 (migration `0040_expenditures.sql`). Greenfield — there was no expense feature before.

**Model (all user-decided):**
- **Compulsory vs variable is a property of the CATEGORY**, not the entry. 18 seeded categories: compulsory = Rent, Power, Internet, Salaries, Bank Charges, CA & GST Charges; everything else variable (Fuel — Sales Executives / Logistics / Internal, Food — SEs & Logistics / Corporate, Customer Gifting, Travel Expenses, Drinking Water, Stationery, Donation — Willing / Unwilling, Coupon Redemptions).
- **All three office roles (SA, Manager, Accountant) can record AND edit** entries and add custom categories. **No approval step** — an entry is final on save. **Web only**, never mobile.
- Optional **bill** (image/PDF ≤10 MB → R2 `expenditures/{id}/…`), optional **person link** (`user_id` → an SE or Logistics driver, so fuel/food can be attributed per person), optional payment mode / paid-to / remarks.
- Page shows **period totals + compulsory-vs-variable split + per-category breakdown** with a date-range filter.

**Pieces:** `services/expenditures.ts` + `routes/expenditures.ts` (CRUD, `/categories`, `/people`, `/summary`, `/:id/bill`); web `features/expenditures/*` at `/dashboard/expenditures`; nav entry under Configure for SA+Manager and under Finance for Accountant. Entry codes are `EXP-0001` style.

**Gotchas:** the `users` active column is `status` (not `is_active`). `requireRole` needs a mutable `Role[]`, so `as const` on the roles array fails typecheck. Radix Select options render in a portal and can't be clicked by the browser-tool refs — verify create flows via the API instead.

Verified live then the two test entries were deleted (the DB is a live field trial — see [[project-field-trial]]). Related: [[project-collection-receipts]] for the same authed-blob image viewer pattern.

---

## project-fcm-credential-fix.md

---
name: project-fcm-credential-fix
description: Root cause + fix for ALL Expo/FCM app pushes silently failing (missing FCM V1 push credential on Expo)
metadata: 
  node_type: memory
  type: project
  originSessionId: 4adfedc6-e5d2-4fac-86b5-afc4863cf55e
  modified: 2026-08-15T04:04:20.916Z
---

2026-08-15: Discovered that **every push notification the app sends was silently failing** (dues alerts, invoice notifications, delivery pushes, and the new location nag). Root cause: Expo's push service had **no FCM push credential** — `androidAppCredentials.androidFcm` = null AND `googleServiceAccountKeyForFcmV1` = null. The Expo push API rejected sends with `InvalidCredentials` / "Unable to retrieve the FCM server key". It was invisible because `sendExpoPush` (apps/api/src/services/invoices.ts) is fire-and-forget (`.catch(() => undefined)`).

**Why it broke:** the Android package changed com.anonymous.mobile → com.vardhansystems.sriaparajita (2026-08-01, see [[project-app-package-id]]); the FCM V1 push credential was never (re)configured for the app. The service account that WAS set up on Expo is `googleServiceAccountKeyForSubmissions` — for Play Store uploads, NOT push. Client side was fine (google-services.json for the right package, Firebase project `beyond-distribution` #404860333067).

**Fix:** user generated an FCM V1 service-account key (Firebase console → project `beyond-distribution` → Project settings → Service accounts → Generate new private key) and uploaded it via `eas credentials` → Android → Google Service Account → Push Notifications (FCM V1). Verified: Expo push returns `status: ok`, delivery receipt `ok`, notification displays on device.

**To inspect the credential state** (non-interactive): Expo GraphQL `POST https://api.expo.dev/graphql` with header `expo-session: <~/.expo/state.json auth.sessionSecret>`, query `app{ byFullName(fullName:"@vardhansystemssupports-team/sri-aparajita-automobiles-and-lubricants"){ androidAppCredentials{ googleServiceAccountKeyForFcmV1{ id } androidFcm{ id } } } }`. Needed by [[project-location-health-guard]] (its FCM nag).

---

## project-field-trial.md

---
name: project-field-trial
description: "Field trial started 2026-07-17 — DB wiped to zero (kept users/catalogue), APK c14a3a5e is the trial build"
metadata: 
  node_type: memory
  type: project
  originSessionId: eda7d8d0-d4fd-4f51-b3b7-1bae7bfc6978
---

**Field trial began 2026-07-17.** The production Neon DB was wiped that morning for a clean start: ALL orders, order_items, collections (+payment_proofs), visits, gps_points/sessions, delivery_runs/stops/photos, customers, customer_photos, tasks, market notes, alerts → 0 rows. **Kept:** all 12 users (real + test accounts), 64 products, 1,829 bearings, roles/org/settings.

**Data after this date may be REAL field data — never bulk-delete without asking.** Test accounts still exist (test@test.com / TestSE#2026 SE, logistics@test.com / LogiTest#2026); rows created by those accounts are the safe ones to clean.

Trial builds: first was EAS preview APK c14a3a5e (versionCode 2, 2026-07-17 morning). **Superseded same day by build 88a28491 (versionCode 3)** adding: 3-minute GPS pings (was 5), required multi-select Customer Segment (2W/3W/Car/Commercial/Agri), shimmer skeletons everywhere, app locked to light mode (`userInterfaceStyle: "light"`). The preview profile now has `autoIncrement: true` (added after the versionCode-2 collision risk). API version 1d3a568a.

R2 note: wiping DB photo rows left orphaned objects in the PHOTOS bucket (customers/, deliveries/, tasks/ keys) — harmless, clean up someday. See [[project-bearings]], [[project-logistics-delivery]].

**GPS reliability fixes (2026-07-17 night, from trial-day analysis; NOT yet deployed/APK'd — user said "don't deploy anything"):** trial data showed (a) sub-3-min extra pings — Android fused-provider piggybacking, incl. our own check-in one-shots; (b) exact-duplicate points — non-idempotent batch retry; (c) a 3.3h blackout — battery optimizer killed the task (phone had battery/net/location on); (d) End day never closed the server session (no endpoint existed). Fixes implemented: client throttle (drop points <2.5 min after last kept, `MIN_PING_GAP_MS` in gps.ts), Start-day re-press guard, `installGpsWatchdog()` (AppState active → restart task if day-flag set in SecureStore `beyond_day_tracking_on`), End-day now POSTs new `/visits/gps/end` (idempotent; sets ended_at), migration `0021_gps_dedupe.sql` (applied: removed 14 dupes, unique index user_id+recorded_at) + `on conflict do nothing` on insert. Web tracking map now draws a dot per ping with IST time tooltip (verified live, 244 dots). Battery tip added to Start-day dialog ("Settings → Battery → Unrestricted"). All tests green (API 250, mobile 62). Ship = deploy API + new APK + web deploy for the dots.

---

## project-fuchs-catalogue-segments.md

---
name: project-fuchs-catalogue-segments
description: Catalogue replaced with 58 Fuchs products; segment set changed to Car/2W/3W/Commercial/Truck/Agri/Gear Oil; pack sizes now fully per-product (no hard-coded lists)
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cf48323-24fa-457a-978b-1f32a8c5b39e
  modified: 2026-07-26T10:13:24.210Z
---

On 2026-07-26 the whole oil catalogue was replaced (from `Fuchs_Product_Dataset.xlsx`) and the segment taxonomy changed. This supersedes the old segment names in AGENTS.md.

**Segments (NEW, title-cased):** `Car · 2W · 3W · Commercial · Truck · Agri · Gear Oil`. Was `Cars/2W/3W/Commercial/Tractors/Industrial/Gear Oil` — Tractors→Agri, Industrial dropped, Truck added. The list is duplicated (no shared const) in 8 source files: api `products.ts` (ALLOWED_SEGMENTS), `targets.ts`+`dashboard-analytics.ts` (OIL_SEGMENTS); web `product-create-dialog.tsx` (PRODUCT_SEGMENTS), `targets-api.ts` (OIL_SEGMENTS), `orders-create-helpers.ts` (SEGMENT_OPTIONS); mobile `order/new.tsx` (SEGMENT_ORDER), `performance.ts` (OIL_SEGMENTS). Change all together.

**Catalogue:** 58 Fuchs products (all `brand='Fuchs'`), 121 pack rows. The one dup name `TITAN UNIMAX 15W40 CK4` was merged (segments Car+Truck, packs 26+205).

**Pack sizes are now fully per-product / data-driven** — all hard-coded pack-size lists were removed (api `ALLOWED_PACK_SIZES` gone; web `PACK_SIZE_OPTIONS`/`PRODUCT_PACK_SIZES` gone; mobile `PACK_SIZES` gone). Storage already existed: `product_pack_sizes(product_id, pack_size_litres)` table + `createProduct` persists segments+packs. `GET /orders/products` now returns `packSizes` per product. SEs (mobile order screen) and the web order form show ONLY the selected product's packs; web product dialog is free numeric entry. Mobile local-db schema bumped v14→v15 (products.pack_sizes column).

**Bearings catalogue (also 2026-07-26):** replaced all 1830 bearings with 1830 distinct from `ORDER_FORM_WITH_BRAND.xlsx` (1834 rows, 4 dup part_nos merged), all `brand='Texspin'`. Added a new `bearings.application` text column (vehicle/model, e.g. "TATA 207,SPACIO") — stored + shown to SEs and searchable (part_no OR application) in the order flow, web admin catalogue (new Application column + add/edit field), and mobile. API `services/bearings.ts` all queries + create/update carry application; web `order-bearing-line-row`/`bearing-dialog`/`products-columns`; mobile `order-cache` CachedBearing + local-db bearings.application (schema v15→v16) + `order/new` bearing card/sheet/search. Deployed 2026-07-26.

**Also 2026-07-26:** all orders + order_items wiped from prod (testing phase, user OK'd, no backup needed but a pre-wipe pg_dump was taken). See [[project-field-trial]].

API+web deployed 2026-07-26. **Mobile APK NOT yet rebuilt** — SE pack-picker/segment changes need a new APK to reach phones. Nothing committed to git.

---

## project-fulfillment-pending.md

---
name: project-fulfillment-pending
description: "Fulfillment Order→Invoice→Delivery; UPGRADED 2026-07-27 to PARTIAL delivery — multiple invoices per order, per-SKU matching+allocations, shipments timeline. Phases 1-3 DEPLOYED; only logistics-mobile 'Delivered' pick remains"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cf48323-24fa-457a-978b-1f32a8c5b39e
  modified: 2026-08-13T12:20:35.329Z
---

**2026-08-13 (b) — returned qty shown + ledger-edit re-parses & re-allocates (DEPLOYED + E2E-verified):**
- **Returned quantity now visible on the order** (was badge-only): Orders LIST — under the fulfillment badge a rose "N returned" (units) hint, and the Total Litres column shows gross "70 L" + rose "−42 L returned" note (user chose "show both"). Order DETAIL line-items — a per-SKU "Returned" column (shown only when any SKU has returns). API: `RETURNS_LATERAL` now also sums `returned_litres` (sum sri.litres); paged query selects `returnedUnits`/`returnedLitres` → `mapOrderRow`; web `Order` type + `SkuProgress.returnedUnits` (already added). Verified: ORD-0210 shows 70 L/−42 L/12 returned + detail Returned=12.
- **Returns ARE already netted from SE totals** (confirmed, not new): `targets.ts` + `leaderboard.ts` both compute `oi.total_litres − returned_litres`. The ORDER's own Total Litres stays GROSS (shows the −returned note beside it) — deliberate.
- **Ledger "Edit invoice" now = the upload flow (parser + side-by-side + re-allocate)**: replaced the plain manual-fields dialog (`ledger-edit-invoice-dialog.tsx`) with the same PDF-preview-beside-fields + per-SKU matcher used on upload (reuses extractPdfLines/parseInvoiceLines/InvoiceReviewForm/autoMatchLines/validateMatches/customerGuard). Seeds fields+matches from the stored invoice (line_items carry orderItemId); replacing the PDF re-parses + re-auto-matches. On save (order-scoped) it sends lineItems → **API `updateInvoice` rewrites `invoice_line_allocations` in one txn** so the order's fulfillment RE-DERIVES (this closes the old "edit doesn't move fulfillment" gap). API refactor: extracted `loadOrderForInvoice`/`assertInvoiceCustomerMatches`/`buildInvoiceAllocations` shared by create+update; `buildInvoiceAllocations` + `GET /orders/:id/invoiceable?excludeInvoiceId=` exclude the invoice's OWN allocations from remaining (so an edit isn't self-over-billed); `getInvoice` now returns orderId/orderCode. Header-only edit (no lineItems / order-less invoice) still supported = allocations untouched. Verified live: dialog shows PDF iframe + 10 fields + matcher ("3.5L · 20 left"). Stock NOT re-deducted on edit (intentional).
- Whole batch: 428 API + 31 web tests green, tsc clean, API+web DEPLOYED. **Uncommitted.** NOTE: browser-automation synthetic clicks don't reach these custom tab/row React onClicks — use a native `el.click()` via javascript_tool to drive the ledger tab + row pencils.

**2026-08-13 — RETURNS now drive fulfillment (DEPLOYED + E2E-verified):** two new stages **`partially_returned`** (some units returned) and **`returned`** (all *billed* units returned) added to the computed ladder; both take precedence over the invoice/delivery ladder but sit **below `cancelled`**. Source = `sales_return_items.quantity_units` summed per order_item vs allocation (billed) units. API (`services/orders.ts`): added `RETURNS_LATERAL` const (returns lateral aliased `ret`: `returned_units`, `all_billed_returned=bool_and(alloc−returned<=0.001)`) appended to `ORDER_FROM`; two CASE branches in `FULFILLMENT_CASE` (+ inlined into the tagged-template recent-orders query — can't `${const}` a tagged template); `FULFILLMENT_STAGES` set + sort-rank (returned=7/partial=6, after cancelled=5); `orderFulfillmentSummary` gained exclusive `returned`+`partiallyReturned` counts (+ `and returned_units=0` on the 5 existing buckets); `getOrderById` `skuProgress` gained per-SKU `returnedUnits`. Web: `fulfillmentStatus` union + `SkuProgress.returnedUnits` (orders-api.ts), tones+labels (orders-columns.tsx, orange/rose), row-bg + filter dropdown (orders-list.tsx), summary cards shown only when >0 (orders-fulfillment-summary.tsx), export statuses+labels (orders-export.ts), detail `deriveStage`+`STAGE_STYLES` (order-detail.tsx — computes from summed returnedUnits, all-billed-returned check). Verified live: ORD-0210→Partially returned, ORD-0001→Returned, funnel PARTIAL RET.1/RETURNED 5. **Uncommitted.** Still-pending from same ask: invoice-header EDIT should rewrite `invoice_line_allocations` so fulfillment re-derives (NOT started).

**2026-08-12:** Customer detail → **Orders tab** now shows a **Fulfillment** column (was "Status" showing order approval_status). Extracted `FulfillmentBadge` + `FULFILLMENT_TONES`/`FULFILLMENT_LABELS` into `features/orders/orders-columns.tsx` (shared); the Orders list `fulfillmentColumn` cell + `customer-orders-tab.tsx` both use it. Data already present: the tab fetches `/orders/paged?customerId=` which computes `fulfillmentStatus`. E2E-verified (CUST-0182 orders show "Delivered"). Web-only, uncommitted.

**Fulfillment** — chain **Order (ORD-####) → Invoice → Delivery** so an order is trackable
end-to-end with a per-order status trail + a funnel/aging dashboard. Spec: docs/PENDING-FULFILLMENT.md.

**Mobile order badges show fulfillment now (2026-08-08, API deployed + verified):** The SE customer page "Last 5 orders" badge showed the raw order_status ("Approved" — redundant, orders auto-approve). Now shows the computed fulfillment ladder (Ordered / Partially invoiced / Invoiced / Partially delivered / Delivered / Cancelled). Change: `services/orders.ts` `listOrders` (the `/orders?customerId=` path the mobile uses) gained the same `fulfillmentStatus` CASE + `fulf`/`skuinv` lateral joins as `listOrdersPaged` (was null there before; `mapOrderRow` already mapped it). Mobile: `ServerOrder`+`CachedServerOrder` gained `fulfillmentStatus`; `cached_orders` gained a `fulfillment_status` column (idempotent alter in migrateLocalDb) so it's offline-correct; badge uses FULFILLMENT_LABEL + STATUS_CHIP (fallback "ordered" for stale cache). Verified live: Sai Ram Motors ORD-0121/0120 → "Delivered". Needs new APK for field phones.

**ORIGINAL build (2026-07-25, live):** 1:1:1 Order:Invoice:Delivery. Migration 0042 added
`invoices.order_id` (partial-unique) + `delivery_run_stops.invoice_id` (partial-unique).
`createInvoice` order-scoped with EXACT totals guard. Per-order Upload-invoice button, fulfillment
badge, order-detail trail, funnel strip. Invoices page = read-only registry.

**PARTIAL-DELIVERY UPGRADE (2026-07-27) — an order can now be shipped/invoiced across MULTIPLE shipments:**
- Design (locked w/ user): Approach A = **separate invoice per shipment** (order → many invoices);
  track SKUs/qty per shipment; add **"Partially delivered"** status; at-a-glance = just an amber
  **"Partially delivered"** label (NO fractions); over-quantity BLOCKED. Per-SKU line matching
  (auto-match parsed line → order SKU, accountant confirms, block unmatched line) was DEFERRED.
- ✅ **Phase 0** (kebab ⋮ row menu Upload/Edit/Cancel + soft cancel `POST /orders/:id/cancel`): already existed.
- ✅ **Phase 1** (migration 0043 `drop index invoices_order_id_key`; `createInvoice` in
  apps/api/src/services/invoices.ts: removed already-invoiced block, replaced EXACT-totals guard
  with **within-remaining** guard — order-context query now sums already-invoiced litres+bearing
  (excl. rejected), new upload must be ≤ remaining on both oils & bearings; over-ship→422, empty→422,
  fully-billed→409). **Migration applied to PROD + API deployed.**
- ✅ **Phase 2** (computed fulfillment ladder + Partially-delivered label): `listOrdersPaged`
  ORDER_FROM rewritten with **lateral aggregates** (fulf: invoice_count/delivered_count/inv_oil/
  inv_bearing; ot: ord_oil/ord_bearing) — was `left join invoices` which MULTIPLIED rows once an
  order had >1 invoice. SQL computes `fulfillmentStatus` (ordered→invoiced→partially_delivered→
  delivered) + `fullyInvoiced`. `orderFulfillmentSummary` rewritten (CTE, no multiplication) + adds
  `partiallyDelivered`. Web: Order type gained fulfillmentStatus/fullyInvoiced; list badge inline
  (amber partial), upload-gate keyed on `!fullyInvoiced` (was `!invoiceId`); summary strip adds
  "Partial". **API + web deployed; verified live in browser.**
- ✅ **Phase 3 (per-SKU matching + detail view) — BUILT + DEPLOYED 2026-07-27:**
  - Migration **0044** `invoice_line_allocations` (invoice_id→order_item_id, quantity_units, litres) — applied to prod.
  - `createInvoice` now takes `orderItemId` per line item; validates every oil/bearing line is matched
    to an order SKU + no SKU over-billed (sum requested ≤ remaining), inserts allocation rows in ONE
    `sql.transaction` (invoice id generated in JS via crypto.randomUUID so both statements share it).
    Aggregate within-remaining guard REPLACED by per-SKU.
  - New `GET /orders/:id/invoiceable` (SA/Accountant) → per-SKU ordered/invoiced/remaining, feeds the dialog.
  - `getOrderById` now returns `shipments[]` (all order invoices + delivery status) + `skuProgress[]`
    (per-SKU ordered/invoiced/remaining). `fulfillment` (single) kept for back-compat = first shipment.
  - Web: invoice upload dialog gained a **SKU matcher** — `invoice-sku-match.ts` (autoMatchLines: oils by
    pack size + name-token overlap, bearings by part-no/name; validateMatches) + `invoice-line-matcher.tsx`
    (per-line SKU <select> + remaining, flags unmatched/over-billed). Dialog fetches invoiceable via
    ensureQueryData, auto-matches on parse, blocks save until all matched & none over-billed, sends orderItemId.
  - Web order detail rewritten (`order-detail.tsx`): **shipments timeline** (vertical, one card per invoice +
    delivered badge + "Awaiting N SKUs" row) on top, then **line-items table** with per-SKU **Invoiced /
    Remaining** columns ("Done" green pill when remaining 0). `deriveStage` guarded against undefined arrays.
  - **Legacy backfill:** the 1 pre-allocation invoice (BAL/26-27/0232) got allocations = full ordered qty
    (old exact-match flow guaranteed full coverage). Verified live: ORD-0001 shows Invoiced 20 / Done.
  - NOT fully E2E-tested: real BAL PDF parse→match→allocate (user has the only sample); covered by 359 API tests.
- ⏳ **Still pending:** "Delivered" badge needs logistics-mobile invoice-pick (old Phase 7, needs APK) to set
  `delivery_run_stops.invoice_id`. Until then partial invoices show "Invoiced"/"Partially delivered" only.

Ladder rule (SQL): 0 invoices→ordered; delivered_count=0→invoiced; delivered_count≥invoice_count &
inv≥ord(−0.01 litres)→delivered; else→partially_delivered.

**BUG FIX 2026-07-28 — wrong-invoice guard (per-SKU matching was too permissive):** a different PDF
(TITAN 5W30 3.5L, wrong customer) uploaded to ORD-0008 slid through — auto-match fell back to any SKU,
"SP" token coincidence + single-candidate fallback matched it, and the server only checked
matched+within-qty (comparing 4 packs of 3.5L vs 10 of 0.9L). Fixed with 3 guards on BOTH client
(`invoice-sku-match.ts`) AND server (`invoices.ts` helpers): (1) **customer guard** — invoice party
phone (last-10) AND customer name (token-overlap) must both match the order customer (skipped only if
customer has no phone); (2) **oil line↔SKU** — same viscosityGrade (20W40≠5W30) AND same pack size
(grade-less SKU → strong name overlap); (3) **bearing** — part-no tokens in the line. Loose fallbacks
removed; matcher `<select>` now only lists `candidatesForLine` (+ "Not matched"); `invoiceable` endpoint
returns customerName/customerPhone; dialog sends `invoiceCustomerName`. 10 regression tests in
`invoice-sku-match.test.ts`. Bad invoice BAL/26-27/0068 deleted (ORD-0008 back to Ordered; R2 pdf orphaned).

---

## project-incentives.md

---
name: project-incentives
description: Incentives page (SA/Manager/Accountant) — monthly Collections % + Targets (litre-threshold reward + per-litre rate) per SE
metadata: 
  node_type: memory
  type: project
  originSessionId: 5644a38e-d39f-4927-a4aa-15516eac607c
  modified: 2026-08-21T12:09:51.547Z
---

2026-08-21: Built the **Incentives** page (`/dashboard/incentives`), was a placeholder. UNCOMMITTED. Monthly, per sales executive, two sections:
- **Collection incentive** = that month's VERIFIED collections × a per-SE % → payout. Attribution: `collections.collected_by_user_id` (the collector), grouped by **approved_at** IST month (verified only). Decided with user.
- **Target incentive**, two parts on the same row: (a) **per-month** = a litre-threshold reward — office sets `target_litres` + `target_reward`; if that month's oil litres ≥ target_litres, pay the reward (user's example: hit 3000 L → ₹1000); (b) **per-litre** = monthly oil litres × a per-SE `per_litre_rate`. Litres = oil litres from `orders` (order_items.total_litres net of sales_return_items, by `orders.sales_executive_id`, order_date month) — same calc as targets/leaderboard.
- **Display only** (no payout/paid tracking, per user). Access + edit: **SA + Manager + Accountant**.

Stack:
- migr **0067_se_incentives.sql** (APPLIED to prod DB via psql): one row per (user_id, period_month) holding the 4 manual knobs (collection_pct, per_litre_rate, target_litres, target_reward) + updated_by. Actuals computed live, never stored.
- API `apps/api/src/services/incentives.ts` (`listIncentives` set-based CTE join, `upsertIncentive`) + `routes/incentives.ts` — `GET /incentives?month=YYYY-MM`, `PUT /incentives/:userId`. Money math in SQL numeric. Registered in index.ts.
- Web `apps/web/src/features/incentives/*` (incentives-api types, incentives-panel [withQueryClient, month navigator mirroring Targets, 3 summary cards + 2 section tables, row-click opens dialog], incentive-edit-dialog) + `app/dashboard/incentives/page.tsx`. Nav: fixed SA Configure href (#→/dashboard/incentives), added to Manager Configure + Accountant Finance.

Live-verified: page renders both tables with real per-SE verified-collection totals; edit Murali 2% → ₹4,989.2 computed + persisted (test row then deleted). `tsc` clean both apps.

**"Per month" target model note:** implemented as SELF-CONTAINED entered target_litres+reward per SE/month (NOT reusing se_targets), per the user's "3000L → 1000" example. Easy to switch to reuse existing monthly targets if wanted.

**Deploy:** migration already applied to prod DB; still need to deploy `apps/api` (for the route) + `apps/web` (for the page). Related: [[project-se-targets]], [[project-web-resilience-hardening]] (psql write path via apps/api/.dev.vars DATABASE_URL = writable prod primary).

---

## project-invoice-parse-audit.md

---
name: project-invoice-parse-audit
description: "2026-08-20 audit of uploaded invoice line_items vs source PDFs — parser mis-reads line qty/price; 3 fixed, 6 have missing PDFs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3920d201-e00c-4cdc-bdb0-120b944fc1fc
  modified: 2026-08-20T06:22:44.922Z
---

Full audit (2026-08-20) of all 228 `invoice_source='upload'` invoices' stored `line_items` against their source BAL tax-invoice PDFs (pulled from R2 `sri-aparajita-photos/invoices/<key>` via `wrangler r2 object get`, text via `pdftotext -layout`, compared qty/price/amount).

**Parser bug:** the client-side invoice parser (`apps/web/.../invoice-parser.ts`) occasionally mangles a LINE's quantity or price (e.g. copies the previous line's `price`, or mis-reads `qty`), while the invoice HEADER totals (taxable/GST/net) stay correct because they're parsed from the PDF's tax-summary box, not the line rows. So the header reconciles but a line is wrong.

**Detection:** sum of `line_items[].amount` should equal `invoice_net_value` (amounts are GST-inclusive line totals; grand total = sum of line amounts when discount=0). A mismatch > ~₹1 flags a mis-parse. Caveat: a `−₹30` mismatch is usually a legitimate "Add: Freight & Forwarding Charges ₹30" line that's in the total but not itemized — benign.

**Fixed (DB edits, live prod, invoice totals unchanged):**
- BAL/26-27/0314 (ORD-0161): FRICOFIN EA 50 qty 12→24, price→296.61, amount→8400 + `invoice_line_allocations` 12→24 (this qty error stranded the order at "partially delivered"; see [[project-fulfillment-pending]]).
- BAL/26-27/0304: SILKOLENE 20W40 SP 1L price 388.98→304.24, amount 18360→14360.
- BAL/26-27/0346: SILKOLENE 20W-40 0.9L price 304.24→312.71, amount 21181→21771.

**Result:** of 222 invoices with a readable PDF, ALL match exactly after these 3 fixes. Parser bug was rare.

**6 invoices have a DANGLING PDF reference** — `invoice_pdf_url` points to an R2 key that returns "key does not exist" (source PDF never persisted / deleted): BAL/26-27/0208 (ORD-0262), 0309 (ORD-0089), 0310 (ORD-0199), 0312 (ORD-0196), 0316 (ORD-0158), 0327 (ORD-0252). Their line_items reconcile internally but can't be verified. Separate data-integrity issue — re-upload the PDFs.

**Not bugs:** 9 orders read "partially delivered" because their (correctly-parsed) invoices genuinely bill fewer units/SKUs than ordered — real partial deliveries or over-entered orders (cf. ORD-0171/0213 which were corrected by reducing the order). Fulfillment "delivered" needs every line fully invoiced (allocation ≥ ordered) AND every invoice delivered — see `FULFILLMENT_CASE` in `apps/api/src/services/orders.ts`.

**Parser is NOT currently buggy (2026-08-20 follow-up):** the `ITEM_ROW` regex + `itemsToLines` y-tolerance in `invoice-parser.ts` are byte-identical to the original (2026-07-24) and re-parse all 3 bad PDFs CORRECTLY today (verified by running the app's real `pdfjs-dist` on the R2 PDFs). So the corrupt DB values were historical (older state / PDF-replace desync), not something the live parser reproduces. **Durable guard added instead:** `parseInvoiceLines` now returns `freight`, `lineItemsTotal`, `reconciles` — false when line amounts (+freight) ≠ grand total (the signal that caught all 3). The upload dialog (`invoice-upload-dialog.tsx`) shows a red "Line items don't add up" banner + an "I've verified each line" checkbox that gates Save; the line matcher now shows each line's ₹ amount. Validated: **0 false positives across all 222 real PDFs** (freight handled); blocks the 3 bad shapes. 6 new parser tests. NOT committed/deployed (web-only change).

---

## project-invoice-pdf-tab-title.md

---
name: project-invoice-pdf-tab-title
description: "Deferred — invoice PDF tab/viewer title; blob removed + wrapper shows invoice number, but PDF's own /Title still \"Invoice\""
metadata: 
  node_type: memory
  type: project
  originSessionId: da302c48-ee39-4f07-9a6c-140569e62bc5
  modified: 2026-08-05T15:30:23.390Z
---

Invoice-PDF open flow, reworked 2026-08-05 (SUPER_ADMIN web). **DONE:** removed the `blob:https://…` URL — clicking an invoice number now navigates to a same-origin proxy `apps/web/src/app/api/invoice-files/[id]/route.ts` (auth via session cookie + `serverApiFetch` service binding; the client used to fetch cross-origin + `URL.createObjectURL`, which forced the blob). The proxy serves a tiny **titled HTML wrapper** whose `<title>` is the **invoice number** (passed as `?name=`), hosting the PDF in a full-viewport iframe. `?embed=1` returns the raw PDF, with the PDF's UTF-16BE `/Title` "BusyWin" (BUSY/BusyWin accounting software stamps it) byte-swapped in place to same-length "Invoice" (xref stays valid). Client: `openInvoicePdf(id, number)` in `features/invoices/invoices-api.ts`; callers = orders `InvoiceCell` (`features/orders/orders-columns.tsx`) + invoices list. Deployed api+web 2026-08-05.

**DEFERRED (user, 2026-08-05, "not important for now, do this later, but remember it"):** the **browser tab already shows the invoice number** (wrapper works in prod). But the **PDF viewer's own gray header** still reads "Invoice" — that's the PDF's embedded `/Title`, which the same-length byte-swap can only make "Invoice", not the (variable-length) invoice number. To make the in-viewer title the actual invoice number, rewrite the PDF `/Title` with a PDF library (**pdf-lib** works on Workers) — heavier (dep + per-view re-encode) but gives a native full-tab PDF with the exact number. See [[project-invoices-section]].

**Why:** user wants the invoice number everywhere it's shown; the wrapper covers the tab, the pdf-lib rewrite would cover the viewer header too.
**How to apply:** in the proxy `?embed=1` branch, load bytes with pdf-lib, `doc.setTitle(invoiceNumber)`, re-save; drop the byte-swap + possibly the wrapper. Need the number in the route (already passed as `?name`).

---

## project-invoices-section.md

---
name: project-invoices-section
description: "Invoices section built 2026-07-23 — upload+parse BAL PDFs on web, SE notifications with WhatsApp share on mobile; invoices now drive customer outstanding"
metadata: 
  node_type: memory
  type: project
  originSessionId: f686e535-ba24-4529-89c2-88f359d5400b
  modified: 2026-07-23T10:52:34.876Z
---

Built and E2E-verified 2026-07-23 (unblocks its two follow-ups ([[project-dues-buckets]], [[project-se-targets]])):

- **Flow**: SA/Accountant uploads the fixed-format BAL tax-invoice PDF on `/dashboard/invoices` → parsed CLIENT-SIDE (pdf.js + `apps/web/src/features/invoices/invoice-parser.ts`, 6 unit tests) → editable review form → customer auto-matched by Party Mobile No (searchable picker fallback) → saved via multipart POST /invoices (PDF → R2 `invoices/…`, row → `invoices` table incl. `line_items` jsonb; migration `0037`).
- **Parsing rules**: oils = HSN 2710, litres = qty × pack size from description (`1L`, `900ML`, `7.5L`); bearings = any other HSN (samples show 8482); taxable/GST/grand from the tax-summary row; station may be blank. Party phone: first digit-run after the label (e-way bill shares the line!).
- **Dues**: `outstanding_amount = grand total`, `due_date = invoice_date` (user chose invoice-date clock); the existing collection-verify reconcile reduces it → mobile credit gate + future ageing buckets now have real data.
- **SE delivery**: `se_notifications` row + Expo push (`push_tokens`, `POST /me/push-token` registered on app start). Mobile Alerts screen (bell) lists invoice notifications; tap downloads the PDF (expo-file-system) and opens the system share sheet (expo-sharing) → WhatsApp. Verified on emulator end-to-end; marks read after sharing.
- **Gotchas**: expo-sharing is a NATIVE module — required a dev-client rebuild; ships with the next EAS APK. Real push on production Android needs **FCM credentials in EAS** (not yet configured — pushes are silently skipped until then; in-app feed works regardless). Customer search API now also matches `phone`. Web deploy pending (user reviews + commits first).
- SE mapping: invoice's SE = `customers.created_by` when that user holds the SALES_EXECUTIVE role; customers created by admins have no SE → no notification (shown as "No SE" in the web list).

---

## project-invoicing-build.md

---
name: project-invoicing-build
description: "In-app invoicing build (replaces BusyWin) — Phase 1 oils; spec + progress, pricing model, where the code lives"
metadata: 
  node_type: memory
  type: project
  originSessionId: da302c48-ee39-4f07-9a6c-140569e62bc5
  modified: 2026-08-06T07:57:53.790Z
---

Building **in-app invoice generation to replace BusyWin** (client currently invoices in BusyWin). Full spec + decisions in `docs/INVOICING-PLAN.md`. Working style (client goal 2026-08-05): **TDD, ≤100 lines/file, one phase at a time**. Phases: 1=Invoicing (oils first, bearings/filters later), 2=Stock Journal (Add/Modify/List), 3=GST (Report, Audit).

**Pricing model (VERIFIED vs real invoices):** price master's **MOP is GST-inclusive** → printed pre-GST `Price = MOP/(1+gst)`, line `Amount = MOP × qty × (1−discount%)` rounded to whole rupee (match BusyWin), grand total = sum of rounded lines. Discount is **per (customer, product)** (customer default + per-product override). GST 18% for HSN 2710/8482/8421/3820, intra-state CGST+SGST else IGST. Numbering auto `BAL/26-27/####`, first issued = **2000**, FY reset. E-invoice/e-way = **manual capture** (paste IRN/QR/eway, no govt API). Invoices created **from an order**; date=today; roles Accountant+Super Admin; copies Original/Duplicate/Triplicate; line description = current product name + pack. Everything configurable in a new **Configure → Invoicing** area (nothing hardcoded). PDF rendered **client-side** (Workers has no headless Chrome).

**DONE (2026-08-05):** migration `0053_invoicing.sql` APPLIED (product_pack_prices, customer_product_discounts + customers.default_discount_pct, hsn_gst_rates seeded 18%, invoice_settings singleton seeded next_number=2000 fy 26-27, new invoices cols transport/vehicle/eway/irn/irn_qr/reverse_charge/place_of_supply). Pure logic TDD'd in `apps/api/src/services/invoicing/`: `invoice-calc`, `invoice-number`, `discount`, `mop-match`, `mop-parse` (25 tests). Price master seeded **57 of 74** retail SKUs from `MOP 18MAY26` file; pipeline spot-check exact (10W30 SL 0.8L → Price 293.22, Amount 11764).

**Phase 1a UI DONE (2026-08-05):** Configure→Invoicing area (Super Admin, nav under Configure) — `/dashboard/invoicing` company/numbering settings form (GET/PUT /invoicing/settings) + `/dashboard/invoicing/prices` **Price Master + MOP import review** (paste MOP text → auto-upsert matched, assign unmatched to a product). API routes in `apps/api/src/routes/invoicing.ts` (+ invoicing-prices.ts, invoicing-generate.ts). Web feature `apps/web/src/features/invoicing/`. All verified E2E, ≤100 lines/file.

**Phase 1b IN PROGRESS (2026-08-05):** generate-from-order COMPUTE done + verified. TDD units: `invoice-build` (resolved lines→items+totals, verified vs real ₹26,124 invoice), `invoice-resolve` (price/GST/discount lookup, discount precedence). `generate-data.ts` loader + `generate.ts` `computeGeneratedInvoice` (READ-ONLY) + preview endpoint `POST /invoicing/orders/:orderId/preview` (roles Accountant+Super Admin). 37 invoicing tests. Verified vs ORD-0152 → BAL/26-27/2000, ₹4,460. Note: interState detection is name-based (customer address_state != 'Telangana') — no state-code mapping yet. **Commit DONE:** `commit.ts` `commitGeneratedInvoice` (ONE transaction: bump invoice_settings.next_number, insert invoices row invoice_source='generated', insert invoice_line_allocations so order→Invoiced; SE se_notifications best-effort after). Endpoints `POST /invoicing/orders/:id/preview` (read-only) + `/generate` (201). **UI DONE:** "Generate invoice" action in orders-list RowActionsMenu (SA/Accountant, un-invoiced/partial) → `generate-invoice-dialog.tsx` (fetches preview → shows lines+totals+invoice number → header inputs station/transport/vehicle/eway/IRN/QR → Generate → toast). NOT live-verified yet (browser SA session logged out — Neon Auth; first real generation will issue BAL/26-27/2000). **Phase 1c PDF DONE (2026-08-06):** client-side render via **jsPDF + jspdf-autotable**. `amount-in-words.ts` (TDD, Indian numbering, matches BusyWin footer), `invoice-pdf-blocks.ts` (header/party/footer draw), `invoice-pdf.ts` `renderInvoicePdf` (Original/Duplicate/Triplicate, line table + tax summary), `finalize-pdf.ts` (`finalizeGeneratedPdf` = render + multipart upload). API: `GET /invoicing/company` (SA+Accountant seller block) + `POST /invoicing/invoices/:id/pdf` (store to R2 `invoices/…` + set invoice_pdf_url). Dialog: on generate → commit → render PDF client-side → upload → viewable via existing `/api/invoice-files`. **Phase 1 (oils) now END-TO-END** (Configure→price master→generate→BAL PDF). NOT live-verified (SA session logged out). PDF layout is complete but NOT pixel-matched to BusyWin — will need visual tuning. Undeployed. **Per-product discount in the generate dialog DONE + LIVE-VERIFIED (2026-08-06):** editable "Disc %" column per line (`preview-lines.tsx`), keyed by orderItemId; editing re-previews server-side (exact math) and sends `lineDiscountOverride` on generate. Verified: 10% on ORD-0152 → ₹4,460→₹4,014, taxable 3,401.69. Backend already supported it. Deployed API confirmed to have all invoicing routes (user deployed 2026-08-06); web still points at local 8787 (same DB); generate flow live-verified up to preview (didn't commit — avoids burning BAL/26-27/2000; next_number still 2000, no invoice created). TODO still: Expo push, state-code map for interState, bearings/filters (Phase 2), Stock Journal (Phase 3), GST reports (Phase 4).

**SIMPLIFIED — pricing folded into Products page (2026-08-06):** the separate Price-Master screen + MOP-import chain was **deleted** (client: "make this lightweight"). MRP+MOP now live as per-pack rows inside the existing product create/edit dialog. Product packs became `[{packSize, mrp, mop}]` (MRP/MOP optional — a product can be unpriced). `/products` GET returns `packs` (product_pack_sizes LEFT JOIN product_pack_prices); POST/PATCH accept `packs` and upsert `product_pack_prices` alongside `product_pack_sizes` (only fully-priced packs written; delete+reinsert on update). Products list shows a **"Packs · MOP"** column (blue pill `1 L · ₹399` when priced, grey `1 L` when not). New TDD'd helper `apps/api/src/services/product-packs.ts` (parsePacks/packWriteArrays, 5 tests). New web `pack-rows.tsx` editor. **Deleted:** api `routes/invoicing-prices.ts`, services `prices.ts`/`mop-import`/`mop-match`/`mop-parse` (+tests); web `price-master.tsx`/`mop-import-panel.tsx`/`prices-api.ts`/`invoicing-tabs.tsx` + `/dashboard/invoicing/prices` route. `/invoicing/prices` API route unregistered; Invoicing settings page lost its tabs (now one screen). Generate pipeline still reads `product_pack_prices` directly — untouched. Both apps tsc-clean, 419/419 api tests pass, verified E2E (edited 10W40 SP → ₹399 persisted to DB). VERIFIED on local (web→local 8787); **not committed, not deployed** yet.

**PDF REWORK + UPI QR (2026-08-06):** Invoice PDF reworked toward the original BusyWin look (client chose "modernized", not pixel-clone): outer page border, boxed header (GSTIN/copy/TAX INVOICE/seller/address), party+meta box (adds Reverse Charge:N), **grid** line-items table with MRP(comma)/Disc%/CGST%/SGST% (single IGST% col for inter-state) + **Grand Total row with total qty**, tax-summary grid, amount-in-words, bank, terms, signatory. Files: `invoice-pdf-blocks.ts` (drawBorder/drawHeader/drawParty/drawFooter, exports M/RIGHT), `invoice-pdf.ts` (lineTable/taxTable, `renderInvoicePdf(company, inv, qr?)`). **Dynamic UPI QR**: new `upi-qr.ts` `buildUpiUri` (TDD, `upi://pay?pa=&pn=&am=<2dp>&cu=INR&tn=`, %-encoded) + `upiQrDataUrl` (via new `qrcode` dep) → embedded bottom-right with "Scan & pay via UPI / INR <total>"; `finalize-pdf.ts` builds it async from settings UPI ID + seller + grand total + invoice no. **Replaces** the old static payment_qr_url in the PDF. New setting **`invoice_settings.upi_id`** (migration `0054_invoice_upi.sql` — NOT YET APPLIED; app's settings/company/generate will 500 until `alter table invoice_settings add column if not exists upi_id text;` is run) surfaced as "UPI ID" field in Configure→Invoicing (BANK_FIELDS; removed the "Payment QR URL" form field). Verified via isolated node render (scratchpad, no DB side-effects) — layout correct, QR string exact; web+api tsc clean, upi-qr tests pass. **Undeployed, uncommitted; did NOT generate a real invoice (would burn a BAL number + fire SE push).**

**PENDING:** 17 unmatched MOP SKUs (catalogue name gaps: `10W30 SCOOT`↔DB `10W30 MAX SCOOT`, `20W40 SP`↔`20W40 API SP`, `15W40 CK4 UNIMAX`↔`CI4+`, `15W40 CF4 UNIVERSAL` & `TITAN FORMULA 5W40 SN` not in DB) — need user to rename/add/map. Bulk-pack (drum 205/50L) prices not loaded (branded names differ). Still to build: config API + Configure→Invoicing UI (settings, GST rates, price/discount mgmt, MOP import review screen), customer discounts, then **Phase 1b** generate-from-order + **1c** PDF. [[project-invoices-section]] is the existing upload-based invoices; this replaces the source with generation.

---

## project-kpis-load-optimization.md

---
name: project-kpis-load-optimization
description: KPIs/dashboard endpoint was slow under concurrency; fixed by parallelizing its aggregates with Promise.all
metadata: 
  node_type: memory
  type: project
  originSessionId: e0779741-786e-4ffd-b0de-e5dad287996f
  modified: 2026-09-04T07:32:16.431Z
---

**⚠️ SUPERSEDED 2026-09-04 — the KPIs page + endpoint were DELETED.** `GET /dashboard/kpis`, `services/kpis.ts`, the standalone `/kpis` web page, `features/kpis/*`, and the sidebar KPIs item are all gone (user asked to remove KPIs). The Accountant home (which was the KpisOverview) is now a simple placeholder pending a real design. So the optimization below no longer applies to a live endpoint — kept only for the technique (sequential-await → one Promise.all) which was ALSO applied to `getSkuAnalytics` (still live). See [[project-dashboard-finance-cards]]. Historical record follows:

2026-08-22: A light-smoke load test on PROD (15 concurrent, read-only GETs, driven from the authenticated browser session replaying the app's own bearer-auth requests) found `GET /api/v1/dashboard/kpis` — the SUPER_ADMIN + ACCOUNTANT **home dashboard** endpoint, which auto-refetches every 120s — degraded badly under concurrency:

- `customers/paged` (indexed list): 160ms isolated, **p50 144ms / p95 221ms under load** — no degradation.
- `dashboard/kpis` (aggregate): ~0.5–1s isolated, but **p50 7,667ms / p95 8,441ms / max 8,757ms under 15 concurrent** (~8–10×). 0 errors (correct, just slow).

**Root cause:** `apps/api/src/services/kpis.ts` `getKpiOverview()` awaited **5 independent aggregates sequentially** (invoices-period, outstanding, overdue-dues, new-customers, team-target) — each its own Neon HTTP round-trip — *then* ran the last 3 (expenditure, order funnel, executive leaderboard) in a Promise.all. So per-request latency was the SUM of ~6 round-trips, and Neon compute contention under parallel requests amplified it.

**Fix (this session):** all 8 queries are independent (none consumes another's result mid-flight), so they now fire in ONE `Promise.all` → latency = MAX of one round-trip, not the sum. SQL statements and the return shape are byte-for-byte unchanged; only the await structure changed. tsc clean, `routes/dashboard.test.ts` (4) pass. No dedicated kpis test exists.

**DEPLOYED + re-tested 2026-08-22 (confirmed on prod, same 15-concurrent/30s test):** KPIs p50 7,667→**2,931ms** (−62%), p95 8,441→3,128ms, max 8,757→3,175ms, isolated ~940→**~240ms**; throughput 3.5→**9.4 rps** (2.7×); 0 errors; customers/paged control unchanged (~140ms). Residual ~2.9s p50 under heavy concurrency = Neon contention on the two per-customer correlated-subquery aggregates (outstanding, overdue) — next lever if ever needed. (Code change is committed-status per user's own flow.)

**Verify after deploy:** re-run the concurrent replay against `/dashboard/kpis` — expect p50 to drop from ~8s toward ~1s. Method: capture the app's real request (wrap `window.fetch`, click a paginated list to grab the `Authorization` header), then replay N-concurrent from the page console (CORS blocks a hand-built cross-origin fetch without the app's bearer). See [[project-web-resilience-hardening]] for the related health/monitoring work.

**Second instance found + fixed 2026-08-22 ("check all other pages"):** swept 17 read endpoints isolated + 6 heaviest under the same 15-concurrent test. All healthy EXCEPT `GET /dashboard/sku-analytics` (the SA/Manager dashboard "SKU analytics — Billed" section) — ~600ms isolated but **p50 4,922ms / p95 6,447ms under load**, the identical sequential-await bug. `services/sku-analytics.ts` `getSkuAnalytics()` awaited 6 independent queries one-by-one (lines, return-lines, catalogue, bearing-brands, 6mo trend, return-trend) — all depend only on range/current-date, none on each other or the in-memory aggregation between them → collapsed into ONE Promise.all (SQL + processing + return unchanged). tsc clean, dashboard tests pass. UNCOMMITTED, needs api deploy + re-test (expect p50 ~5s→~0.6s). Everything else (targets, dashboard/metrics, analytics/oils|bearings|customers, reports, incentives, tracking, attendance, beat-plans, market-intel, expenditures/summary, paged lists) stayed <1s under load — no action.

Further headroom if still needed: collapse the per-customer correlated-subquery aggregates (outstanding, overdue) into set-based joins, and/or add a short server-side cache (dashboard snapshot, not transactional). Matches the `docs/CODE-AUDIT-2026-07-22.md` "batch DB reads" rule.

---

## project-ledger-edit.md

---
name: project-ledger-edit
description: "Editing customer-ledger entries (SUPER_ADMIN) — phased build, Phase 1 done"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-07T16:05:07.329Z
---

Client wants to fix wrongly-typed **ledger** entries (customer detail → Ledger tab). Ledger mixes 3 backends: **Sale**=invoices, **Rcpt**=collections (a credit note is a collection with `payment_mode='credit_note'`), **Sale_re**=sales_returns. Ledger balance is computed LIVE from source tables; `invoices.outstanding_amount` is denormalized (verify-time reconcile applies `collection_allocations` + decrements it).

Decisions (2026-08-07): edit ALL types; **edit-anytime + auto-recompute**; **SUPER_ADMIN only**; invoices = edit fields + replace PDF; sales returns = full per-line quantity edit; deliver **phase-wise**.

ALL 3 PHASES BUILT + UI-verified (dialogs open/prefill/recompute-preview), tsc clean both apps, 421 API tests pass. NOT committed. **Save/mutation paths UNTESTED on live data** (real trial data — [[project-field-trial]]); user tests saves. SUPER_ADMIN-only Edit pencils on each ledger row type in `customer-ledger-tab.tsx`.

- **Phase 1 — Receipts + Credit notes (collections):** `PATCH /collections/:id` + `updateCollection`/`reverseCollectionAllocations`. Edit amount/date/mode/reference/remark; verified rows: reverse this collection's allocations → update → `reconcileCollection` + `applyHeldCreditToOpenInvoices`. Caveat: explicit single-invoice allocation becomes general after edit. Web `ledger-edit-collection-dialog.tsx`.
- **Phase 2 — Invoices:** `PATCH /invoices/:id` (multipart, optional PDF replace) + `updateInvoice`. Edits number/date/station/phone/litres/bearingQty/taxable/gst/grandTotal; recomputes outstanding = grandTotal − amount_collected. Line-items/SKU-allocations/stock NOT touched (so SKU analytics + SE bearing targets keep old line_items — known limitation). Web `ledger-edit-invoice-dialog.tsx`.
- **Phase 3 — Sales returns:** `PATCH /sales-returns/:id` + `GET /sales-returns/:id` (`updateSalesReturn`/`getSalesReturnForEdit`). Full per-line quantity re-entry; validate-before-mutate then reverse+reapply in ONE txn (net invoice outstanding by old−new gross). Refactored `createSalesReturn` to share `buildReturnLines`; `getReturnableInvoice` gained `excludeReturnId`. Web `ledger-edit-return-dialog.tsx`. Also fixed stale bearings.test.ts (ACCOUNTANT can read, not manage).

Related: [[project-collection-types]], [[project-invoices-section]], [[project-dues-buckets]].

---

## project-ledger-fifo-unpaid.md

---
name: project-ledger-fifo-unpaid
description: "Customer ledger Sale-row status is FIFO — one \"Partially paid\" boundary, the rest \"Unpaid\""
metadata: 
  node_type: memory
  type: project
  originSessionId: b77e2608-e1f9-4c8e-bf9c-0fa0ce0fbaef
  modified: 2026-08-08T09:13:35.785Z
---

**2026-08-08** — customer ledger "Paid off" column now distinguishes **Partially paid** vs **Unpaid** under FIFO (previously any not-fully-paid Sale read "Partially paid", which wrongly implied later invoices had caught money).

Rule: payments settle oldest-invoice-first (already FIFO in `buildLedger`, `apps/api/src/services/customers.ts`). A Sale row is `[fully paid → shows day count] → [at most ONE partially-paid boundary invoice] → [everything after = Unpaid]`. So only the oldest still-unpaid invoice that actually caught a partial payment shows "X days · Partially paid"; every Sale after it shows "X days · Unpaid".

Implementation: the FIFO loop already tracks each unpaid invoice's `remaining`. Added `partiallyPaid?: boolean` to the ledger row — true when `remaining < original` (return-adjusted principal), false when it still owes the full amount (nothing reached it). Set in the "Attach payoff info" loop next to `paidOff`. Labels: web `apps/web/src/features/customers/customer-ledger-tab.tsx` (`payoffLabel`) and mobile `apps/mobile/src/app/ledger/[id].tsx` (`ageLabel`) both read `paidOff ? days : partiallyPaid ? "…· Partially paid" : "…· Unpaid"`.

**Deploy caveat:** web + API must ship TOGETHER. If the web label logic deploys before the API returns `partiallyPaid`, the field is undefined → falsy → the boundary invoice wrongly shows "Unpaid". BUILT, tsc + 421 API + 113 mobile tests pass, verified against real Usman Motors (CUST-0150) data; NOT committed; web needs deploy + mobile needs APK. Supersedes the earlier "unpaid→Partially paid" relabel. Related: [[project-ledger-edit]], [[project-dues-buckets]].

---

## project-local-web-uses-deployed-api.md

---
name: project-local-web-uses-deployed-api
description: "Local web dev server reads from the DEPLOYED prod API, not local 8787 — API changes won't show in the running app until deployed"
metadata: 
  node_type: memory
  type: project
  originSessionId: de09bd9a-d688-4d95-abab-875313fac328
  modified: 2026-07-22T07:40:54.421Z
---

`apps/web/.env.local` sets `SRI_APARAJITA_API_BASE_URL=https://api.vardhansystems.workers.dev/api/v1`. Because this is baked into the client `actionConfig` at server render, the **browser (even on localhost:3000) calls the DEPLOYED production API**, not the local `apps/api` dev server on 8787. The deployed API shares the same Neon DB (single-client), so newly-created rows appear, but any **new API code (new fields, endpoints, validation) will NOT take effect in the running local web app until `apps/api` is deployed**.

**Why:** Verifying an API-backed web change locally is misleading — the UI shows stale behavior from the deployed API while your local 8787 has the new code. This burned ~15 tool calls debugging why `packSizes` returned `—` in the Products table (2026-07-22): the local 8787 API returned packSizes correctly, but the app read the not-yet-deployed prod API.

**How to apply:** To verify an `apps/api` change in the browser locally, either (a) deploy the API (`wrangler deploy`, ask first — see [[project-deploy]]), or (b) temporarily set `SRI_APARAJITA_API_BASE_URL=http://localhost:8787/api/v1` in `apps/web/.env.local` and restart the Next dev server, then revert. To test the API alone without the browser, hit local 8787 directly with a Bearer token from `POST /auth/login` (see [[project-test-web-accounts]]). Migrations run against the shared Neon DB via `psql "$DATABASE_URL"` and take effect immediately for both local and deployed API.

---

## project-location-health-guard.md

---
name: project-location-health-guard
description: "BUILT + live-verified mid-day full-screen location-enforcement blocker for SE + Logistics; diagnosis of Sandeep's sparse-GPS case"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3910dd7a-fe38-4edd-8e39-a0b4ce4618e7
  modified: 2026-08-14T22:10:03.930Z
---

2026-08-15: **BUILT + live-verified on emulator** (NOT committed; needs APK). Field concern: SE Sandeep's GPS pings sparse.

**BUILD:** `lib/location-health.ts` (pure evaluator — blocks when NOT granted = denied|undetermined for fg/bg, gps `=== false`; NEVER on "unknown"=read-failure), `lib/location-guard-state.ts` (debounce reducer, REQUIRED_CONSECUTIVE_BAD=3, clears instantly on healthy), `lib/use-location-guard.ts` (hook polls on AppState "active" + 60s idle + 2s confirmation burst; gated on field-role && isDayTracking()), `components/location-guard.tsx` (full-screen non-dismissable Modal + `LocationGuard` wrapper; Linking.openSettings / sendIntent LOCATION_SOURCE_SETTINGS; swallows hardware back). Mounted at ROOT `_layout.tsx` inside LockGate (one mount covers SE+Logistics). Reconciled `tracking-health.ts` background warning→blocker + test. 12 new unit tests; suite **191 green, tsc clean, all files ≤100 lines**. **Live E2E** (SE acct 476451dd): Start Day → `pm revoke ACCESS_BACKGROUND_LOCATION` → foreground → full-screen "Set location to Allow all the time" blocker appeared → re-grant → auto-cleared. Test tracking data deleted, real 1947-pt history + live pin restored. Known minor: cold-restart-into-already-bad-state can wait the 60s idle before blocking (the AppState re-check — the realistic revoke-while-backgrounded path — catches it immediately); optional tightening.


**Diagnosis (from prod DB + code):** Start Day ALREADY hard-blocks on background location (`permissions.ts:183-203`, added 2026-08-01) — foreground + background + battery-opt are essential; day can't start with background denied. The gap is **mid-day**: background permission is checked once at Start Day and NEVER re-checked. Sandeep passes the gate each AM, then his device downgrades mid-shift (background→denied since ~Aug 10; some days foreground denied / GPS toggle off too). `installGpsWatchdog` (`gps.ts:399`) then **silently degrades** — no re-prompt/warn/stop. Native FGS (`ForegroundLocationService.kt`, a `location`-typed foreground service) captures on foreground perm alone WHILE ALIVE; background "all the time" is the RESILIENCE net for when OEM battery-killers/Doze kill the FGS → then foreground-only capture → ~⅔ of expected pings missing. Heartbeats stay frequent because they're an independent 3-min JS timer needing no fix. Offline pings are NOT the problem: `gps_pings` table is durable (no cap/eviction, retries; only server `rejected` acks are terminal-dropped) — sparsity is at CAPTURE not the queue. Of 6 active SEs only Sandeep affected. NOTE inconsistency to fix: `tracking-health.ts` `buildStartDayHealthChecklist` wrongly treats background as a non-blocking "warning" (not wired to UI though).

**Agreed feature spec ("location health guard"):** roles = **SE + Logistics**. After Start Day, continuously re-verify and show a **full-screen, non-dismissable blocker** when ANY of: device location services off / foreground revoked / background "Allow all the time" revoked (mid-day trigger = **location only**; battery-opt/autostart stay Start-Day checks). **No escape hatch** (truly hard — accept support load on stuck devices). Check on every app→foreground return + the 3-min watchdog; only while day on + within working hours (SE 7PM IST; Logistics cutoff TBD — agent found logistics passes cutoffHourIst=-1 i.e. no 7PM stop, but AGENTS says 21:00 — reconcile). Blocker deep-links to the exact Settings screen, auto-clears when healthy. **CRITICAL impl caveat:** MUST debounce — require a STABLE bad reading (perm reads flicker to denied during cold-start) or reps get falsely locked out (dangerous with no escape). Assumed **Android-only** (native tracking is Kotlin) — iOS scope unconfirmed. Android 11+ reality: "Allow all the time" can't be granted in-app, only via Settings deep-link + detect-on-return. Related: [[project-tracking-live-upload]], [[project-tracking-screen-off]], [[project-7pm-cutoff-checkin]].

---

## project-logistics-delivery.md

---
name: project-logistics-delivery
description: "LOGISTICS mobile delivery-run feature (migration 0018, added 2026-07-15) + logistics test login"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6da298a3-8e15-40aa-b01f-22bbd9ca0284
---

The mobile app now serves **LOGISTICS** as well as SALES_EXECUTIVE (role-routed). Built 2026-07-15. A logistics user does a daily **delivery run**: Start (vehicle number + start odometer + odometer photo) → freeform delivery stops (pick any customer, attach multiple proof photos) → End at godown (end odometer + photo). Location is tracked with the **same** `gps_tracking_sessions`/`gps_points` flow as SEs (reuses `startDayTracking`/`stopDayTracking`).

**Test login:** `logistics@test.com` / `LogiTest#2026` (LOGISTICS role, "Ravi Logistics"). Created via DB with the pbkdf2 hash (SHA-256, 100k iters, 16-byte salt). See [[project-test-web-accounts]].

**Data model (migration `0018_delivery_runs.sql`):** `delivery_runs` (vehicle_number, start/end_odometer, status active|ended, run_date IST, client_uuid), `delivery_run_stops` (run_id, customer_id, lat/long), `delivery_photos` (run_id, stop_id nullable, kind start_odometer|end_odometer|delivery, file_key in R2 `deliveries/{runId}/…`). The pre-existing order-tied `deliveries`/`delivery_items` tables are NOT used by this flow.

**API (`/deliveries`, role LOGISTICS+SUPER_ADMIN):** `POST /runs/start` (idempotent by clientUuid; resumes an active run), `POST /runs/:id/end`, `POST /runs/:id/stops`, `POST /runs/:id/photos` (multipart, kind + optional stopId, R2), `GET /runs/active` (resume view + stops). Also: `GET /customers` now allows LOGISTICS (sees ALL customers, not SE-scoped).

**Mobile:** login guard allows LOGISTICS; `AuthGate` role-routes LOGISTICS to `/(logistics)/delivery`. Route group `src/app/(logistics)/`: `_layout.tsx` (Delivery + Settings tabs; add-delivery hidden via `href:null`), `delivery.tsx` (run state machine), `add-delivery.tsx` (full-screen customer picker → confirm → multi-photo), `settings.tsx` re-exports the SE settings. Photo upload via `uploadDeliveryPhoto` in lib/photos.ts.

**Offline-first (2026-07-15):** the delivery flow is now **fully offline-first** like SE orders/collections. New local tables `delivery_runs` + `delivery_stops` (schema v9 in local-db.ts); enqueue helpers `recordDeliveryStart/Stop/End` + query helpers `getActiveDeliveryRun/getDeliveryStops/getDeliveryPendingCount` in sync-core.ts; sync entity types `delivery_start`/`delivery_stop`/`delivery_end` with transport in sync.ts (resolves local run→server id by clientUuid at send time; photos bundled into each item and uploaded after the POST). The delivery/add-delivery screens read the active run + stops from local SQLite (not the API) and write locally + `kickSync()`. Customer picker caches to the shared `customers` table (delivery-cache.ts) so it works offline. A "N deliveries waiting to upload" amber banner shows on the Delivery screen; the run-complete summary says "N items will upload when you're back online."

**Also 2026-07-15:** photos are **camera-only** (gallery removed from both screens); odometer photos now show a **thumbnail preview** (persistDeliveryPhoto copies each shot into documentDir/deliveries so it survives until sync). Dedicated **logistics Settings screen** (no longer re-exports SE settings): Profile + Edit profile + Change password + App lock + Logout only — **no Data & storage / Sync sections**.

**Reconnect fix:** `resetPendingBackoff(db, now)` clears the exponential-backoff window on a genuine offline→online transition (Network listener) and on app foreground (AppState 'active') via `kickSyncNow()` in sync.ts — otherwise a long offline stint left items waiting out a 5-min backoff before syncing. **add-delivery reset fix:** the pushed screen stays mounted in the tab navigator, so it resets picked/photos/search on `useFocusEffect` (camera round-trip doesn't fire focus, so in-progress photos are preserved).

**UI redesign for low-literacy drivers (2026-07-15):** simpler English + polish across the whole delivery flow. Wording: "Start of run"→**Start Deliveries**, "Back at godown/Closing odometer"→**End Deliveries / Add closing meter reading**, "odometer"→**meter reading (KM)**, "Run complete"→**All done!**, "DELIVERIES THIS RUN"→**Deliveries done**, "Odometer photo attached"→**Meter photo added**, error msgs simplified ("Add a photo of the meter."). **Red `*`** on every required field via a `RequiredLabel` helper. **"End" moved to a small red button in the active-run header top-right** (bottom "End run" button removed); tapping it shows a `useDialog` confirm ("End deliveries?" / No / Yes, end) before the End form. **Removed all "location tracking on" / "your route is tracked" text** (GPS still runs silently). **Logistics tabs now use the SE `SpringTabButton`** (icon+label scale to 0.88 spring on press) in `(logistics)/_layout.tsx`. **Pending-banner bug fixed:** the "N waiting to upload" note was stale (only re-read on screen focus) — now `delivery.tsx` subscribes to `useSyncStore` (pending/lastSyncedAt) and re-reads `getDeliveryPendingCount` after each sync, so it auto-hides the moment the queue drains. Mockup approved before build. All 7 verified live on emulator; tsc clean. Nothing committed.

**Cold-launch SE-flash fix (2026-07-15):** on a fresh app open, a logistics user briefly saw the SE tabs before the logistics UI. Root causes (in `src/app/_layout.tsx` AuthGate): (1) the navigator's default route is the SE `(tabs)`, which paints before the redirect effect runs; (2) even after `router.replace("/(logistics)/delivery")`, `useSegments()` flips to `(logistics)` a frame or two BEFORE react-navigation unmounts the outgoing SE screen, so gating the splash on `segments`/`needsRedirect` alone reveals the SE UI during that lag. Fix: keep the navigator mounted but cover it with a full-screen spinner **overlay** (`Splash overlay`) while `needsRedirect`, PLUS a `revealed` state that only turns true ~250ms AFTER the route settles (covers the paint lag); also set root `<Stack screenOptions={{ animation: "none" }}>` so group swaps are instant. Verified via slowed-redirect burst capture: native splash → spinner → logistics, no SE frame. tsc clean. (Debugged with a temp on-screen banner showing hyd/start/tok/role/seg/redir.)

**AuthGate routing fix (2026-07-15):** logistics Edit profile / Change password / App lock appeared "not working" — tapping them bounced straight back to the Delivery tab. Cause: `AuthGate` in `src/app/_layout.tsx` redirected any LOGISTICS user whose `segments[0] !== "(logistics)"` back to `/(logistics)/delivery`, which also caught the **shared** `settings/*` account screens (Edit profile → `/settings/profile`, Change password → `/settings/password`). Fix: added `const inShared = segments[0] === "settings"` and excluded it from that redirect (`&& !inShared`). All three now work for logistics (Edit profile save round-trips, Change password validates + posts, App lock enables with a device PIN) — same shared screens/routes SEs use.

**Automated E2E tests (2026-07-15):** `apps/api/src/routes/deliveries.test.ts` (21 tests) drives the full delivery lifecycle through the real Hono app (`app.request(path, init, env)`) with a **stateful** in-memory Neon mock (dispatches on the `/* query_tag */` SQL comment; server ids minted on create so reads reflect prior writes) + an R2 `PHOTOS` mock: start→stop→photo→end→resume, idempotent replays (start/stop/end), validation (422s), ownership (404, another logistics user can't end your run), ended-run stop (409), access control (401/403 for SE, 200 for LOGISTICS+SUPER_ADMIN). Follows the `photos.test.ts`/`visits.test.ts` pattern; `deliveries.ts` route+service added to the coverage `include` in `apps/api/vitest.config.ts` (branches ≥90% global threshold met at 90.74%). Also `apps/mobile/src/lib/delivery-cache.test.ts` (4 tests, offline customer picker cache via `createTestDb()`/`node:sqlite`). Run: `pnpm --filter @sri-aparajita/api test` (212 pass) and `pnpm --filter mobile test` (53 pass). NOTE: no seed logistics user and no live-DB/Detox/Maestro harness exists — "E2E" here = full request path with mocked Neon+R2, plus the manual emulator passes below.

**Status:** backend verified end-to-end (curl + automated route tests); mobile verified live on emulator **3× end-to-end** (2 online + 1 full offline→reconnect pass, all synced to server with run+stop+3 photos each). 49 mobile unit tests pass (incl. delivery FIFO + backoff-reset), mobile+api tsc clean. **Deployed + shipped 2026-07-16:** API deployed to `https://api.vardhansystems.workers.dev` (version 78fc4fe7, delivery routes verified live) and a new preview APK built on EAS (build feb9128a, versionCode 2, arm64+armeabi, prod API URL baked in — install link at expo.dev/accounts/vardhansystems/projects/mobile/builds/feb9128a-007a-4915-9b8f-94f5825a1680). Still nothing committed to git. NOTE: the [[project-bearings]] feature was built AFTER this deploy/APK and is not in them. See [[project-collection-types]] for the proof-photo pattern this reuses and [[project-mobile-offline-vision]] for the offline mandate.

---

## project-logistics-location-pin.md

---
name: project-logistics-location-pin
description: "Logistics \"Pick the invoice\" cards get a location pin that opens the customer's coords in Google Maps"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-08T07:15:22.404Z
---

**2026-08-08** — logistics delivery app: each invoice card on the **"Add → Pick the invoice"** screen (`apps/mobile/src/app/(logistics)/add-delivery.tsx`) now has a **location pin icon on the right** that opens **Google Maps** at the customer's saved coordinates. BUILT, tsc + 421 API + 113 mobile tests pass; NOT committed. Mobile needs a new APK; API needs a deploy.

- **Coords source:** the customer's SE-saved `customers.latitude/longitude`. Added `c.latitude, c.longitude` to the `deliverableInvoices` query + mapping in `apps/api/src/services/deliveries.ts` (feeds `GET /deliveries/pending-invoices`). **All 257 customers currently have coords**, so the pin is precise in practice.
- **Tap behavior (view-pin):** opens `https://www.google.com/maps/search/?api=1&query=LAT,LNG` (dropped pin, driver starts navigation themselves). **Fallback** when a customer has no coords: `?query=<url-encoded address line>` (text search). `openInMaps()` helper + `Linking.openURL`.
- **Card structure:** the card is one `Pressable` that selects the invoice; the pin is a **nested `Pressable`** (right side, `location-outline` icon in a circle) so tapping it opens Maps without also selecting the invoice.
- **Scope (user's choices):** this Pick-the-invoice list ONLY (not the active delivery-run cards); view-pin not turn-by-turn; icon on the right; address-search fallback.

Related: [[project-logistics-delivery]], [[project-fulfillment-pending]].

---

## project-logistics-online-first.md

---
name: project-logistics-online-first
description: Logistics delivery writes made online-first with an offline safety net (fixes readonly-DB lost-delivery incident)
metadata: 
  node_type: memory
  type: project
  originSessionId: ec2ba780-d7df-482c-b7d1-77177c4f3ca2
  modified: 2026-08-14T18:48:06.149Z
---

2026-08-15: Fixed a field incident where a Logistics driver's on-device SQLite went **read-only** ("attempt to write a readonly database", likely storage full) and **lost a delivery while on 4G** — the old flow wrote to local SQLite FIRST then synced, so a broken DB blocked save/photos/end/logout. Chosen fix (user "Option C"): **online-first with a local-queue safety net**, TDD, React-Native/Hono best practices, every new file ≤100 lines, 100% coverage of the core.

**How it works now** (all 4 logistics writes — start-run, deliver-stop, end-run, photos): try the server DIRECTLY first (bypasses the broken local DB — a READ of `server_id` still works on a readonly DB); fall back to the durable `sync_queue` ONLY when the send genuinely fails; if even the queue can't persist (offline + broken DB) → surface `unsaved` "kept on your phone, tap again" WITHOUT discarding input; a permanent 4xx → `rejected` with the server message. `clientUuid` idempotency makes try-then-queue dupe-safe.

**New pure modules (TDD, 100% covered, ≤100 lines each):**
- `src/lib/online-first.ts` — `submitWrite<T>({send,queue,isRetryable?})` → `WriteOutcome` (`sent`/`queued`/`unsaved`/`rejected`); `defaultIsRetryable` (network/408/429/401 retryable, other 4xx permanent)
- `src/lib/delivery-remote.ts` — direct senders `sendStartRun`/`sendAddStop`/`sendEndRun` (injectable fetcher defaulting to `apiFetch`)
- `src/lib/deliver-stop.ts` — `saveDeliveryStop` (no runServerId → queue; else submitWrite; photo-upload failure does NOT re-queue the stop → no dupe)
- `src/lib/deliver-run.ts` — `submitDeliveryWrite` shared by start/end run-level writes

**Display stays correct** via best-effort local MIRROR helpers in `sync-core.ts` (insert/replace with `server_id` set + `photos_uploaded=1`, **no enqueue** → shows immediately on healthy devices, silently skipped on broken DB since server is truth): `mirrorSentDeliveryStop`, `mirrorStartedDeliveryRun`, `mirrorEndedDeliveryRun`.

**Wired into** `src/app/(logistics)/add-delivery.tsx` (onSave) + `delivery.tsx` (onStart/onEnd). Removed the old hard `if(!db) return setError(...)` early-returns — a missing/broken local DB no longer blocks an online save.

**Status:** 151 mobile tests green, tsc clean, feature core 100% cov (34/34 stmts, 20/20 br). Live: earlier stop integration E2E vs local API 8787→Neon passed (persisted, idempotent, invoice→Delivered, cleaned up); all 4 endpoints confirmed live + auth-gated (401). NOT committed, **needs a new APK** + real-device confirm. Full server-first display sourcing from `GET /deliveries/runs/active` (vs the local mirror) is the one deferred polish. Related: [[project-logistics-delivery]], [[project-photo-dark-watermark-fix]], [[project-mobile-offline-vision]].

---

## project-margin-simulator.md

---
name: project-margin-simulator
description: "Margin Simulator page (SUPER_ADMIN, oils) — save/reopen margin scenarios, formula ported 1:1 from client's margin_simulator.xlsx"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2563c901-096f-4df1-9034-928922d78a28
  modified: 2026-08-12T07:40:13.601Z
---

**2026-08-11** — Client wanted a **Margin Simulator** page (SUPER_ADMIN only) replicating their `margin_simulator.xlsx`. Client confirmed: **follow the sheet's formulas exactly**.

**Formula chain (per oil product+pack), ported verbatim:** Total Expense = Expense/L × Pack → Total Cost = DLP + Total Expense → Scheme Total = Scheme/L × Pack → Net Realization = MOP − Scheme Total → **Margin/Pack = Net Realization − Total Cost** → **Margin/Liter = Margin/Pack ÷ Pack**. **MRP and Coupon are captured but NOT in the margin** (exactly as in the sheet). Page shows only the two net-margin outputs (not the intermediate rows).

**Client decisions:** oils only (bearings/filters excluded — no litres); MRP fetched from price master + editable (blank if none), Coupon typed — both reference-only; Expense/L defaults to **65** on product-pick; margins may go negative → **highlight red (negative) / amber (<₹5/L thin)**; **save scenarios to reopen** (DB-backed); layout = a saved comparison table + single-product add/edit dialog with live preview; placed in sidebar **Configure**, SUPER_ADMIN only.

**BUILT (tsc clean both apps; NOT committed):**
- **DB** migr `0060_margin_simulations.sql` (inputs + computed snapshot margin_per_pack/liter; product_id ON DELETE SET NULL, snapshots product_name).
- **API** `services/margin.ts` (marginOf formula + list/create/update/delete) + `routes/margin.ts` (`/margin-simulations` GET/POST/PATCH/DELETE, SUPER_ADMIN) registered in index.ts. Tests `margin.test.ts` (4, formula matches sheet cols C/Q).
- **Web** `features/margin-simulator/`: `margin-calc.ts` (+5 tests, sheet-verified cell-for-cell incl thin ₹2/pack ₹0.4/L), `margin-api.ts` (server loaders — sims + oil products via listManagedProducts, packs carry mrp/mop), `margin-client.ts`, `margin-format.ts` (marginTone), `margin-entry-dialog.tsx` (SEARCHABLE product + pack pickers via `margin-search-select.tsx` wrapping shared `OrderSearchCombobox`, client-side filtered — replaced the ugly native selects 2026-08-11; MRP prefill from pack.mrp, live preview), `margin-page.tsx` (saved table) — **2026-08-11 reworked to a SPREADSHEET-STYLE UI** (`margin-row.tsx`): products as rows, gridline cells, VIEW mode shows plain value cells; a per-row **⋯ actions menu** (Edit / Save / Revert / Delete) toggles EDIT mode where numeric cells become in-place inputs (Tab between, Enter=save, Esc=revert), margins recompute LIVE, per-row Save=PATCH (no auto-save), product/pack fixed. The ⋯ menu is a **self-managed portal dropdown** (createPortal to body) — the shared base-ui `Popover` would NOT open under automation and gets clipped by the table's overflow-x container, so avoid it for in-cell menus. Delete → confirm dialog. New-simulation dialog kept for adds (searchable oil/pack pickers via `margin-search-select.tsx`). **E2E-VERIFIED on localhost:3000 2026-08-12**: ⋯ menu, Edit→live recompute (MOP 2000→₹418/₹119.43), Save (PATCH 200), delete confirm (cancelled), New dialog product search (37 oils, filter works). Only 2 columns shown (Margin/Pack + /Liter), not the intermediate rows. **Search added 2026-08-12** — live filter box above the table (client-side, filters saved rows by BOTH product name and pack size; "No simulations match" empty state); E2E-verified. **Scoped shimmer 2026-08-12** — user wanted the loading shimmer on the SERVER-fetched data region, NOT the whole page. Refactored: `page.tsx` (server) renders DashboardShell + PageHeader immediately, then `<Suspense fallback={<MarginTableSkeleton/>}>` around `MarginLoader` (async server component that awaits loadSimulations+loadOilProducts) → `MarginSimulatorContent` (client grid, extracted from the old margin-page.tsx). Files: `margin-loader.tsx` (server), `margin-content.tsx` (client, search+New-button row + table + dialogs), `margin-skeleton.tsx` (fallback mirrors search+button row + 10-col table w/ 5 rows). Deleted the old full-page `loading.tsx` and `margin-page.tsx`. Couldn't screenshot the transient shimmer locally (bfcache serves instantly) but it's the standard Next pattern, tsc clean. **Centering 2026-08-12** — all columns+headers+edit-inputs CENTERED except Product (left), across margin-content/margin-row/margin-skeleton. **Arrow-key cell nav 2026-08-12** — edit-mode `onKey` in margin-row.tsx: Left/Right jump between the row's cells ONLY when caret is at the value edge (start→prev, end→next), preserving in-value caret movement; stops at first/last cell; no Up/Down (per user). Tab still works. E2E-verified (5 scenarios pass). Route `app/dashboard/margin-simulator/page.tsx` (SUPER_ADMIN). Nav key `margin-simulator` in dashboard-nav Configure (Calculator icon).

**Pagination added 2026-08-12** — CLIENT-SIDE, 10 rows/page, "Page X of Y" + Previous/Next (app-consistent style; shared `PaginationBar` is TanStack-coupled so a small local pager was built instead). In `margin-content.tsx`: parent holds `page` state, `PAGE_SIZE=10`, and `filterSims()` helper shared by rows+pager so counts can't drift. `MarginRows` slices filtered rows to the page (clamps to pageCount so a shrinking result never lands on an empty page); new `MarginPager` (its own `<Suspense fallback={null}>`, resolves the SAME promise via a 2nd `use()`) renders below the table and returns null when ≤10 rows fit. Search resets to page 1 via `onSearch` (setQ+setPage(1)) in the input onChange — NOT a useEffect (lint `react-hooks/set-state-in-effect`). NOTE: current architecture is `page.tsx` passing unawaited promises → client `use()` inside `<Suspense>` (margin-loader.tsx was later removed); the older margin-loader/MarginTableSkeleton note above is stale. E2E-verified: 10 rows, "Page 1 of 6", Prev disabled p1, Next→p2 (rows change), search "V TWIN"→1 row + pager hidden. Web-only, tsc+eslint clean, NOT committed.

**Data source:** `GET /products` returns oils with `packs:[{packSize,mrp,mop}]` (the price master) — used for the picker + MRP prefill. **Needs: migr 0060 apply + API deploy + web deploy** to work on bdms.vardhansystems.in; login-gated so user verifies after deploy (offer browser E2E like Stock Journal). Related: [[project-invoicing-build]] (price master MRP/MOP source), [[project-stock-inventory]] (same page/nav patterns).

---

## project-mcp-server-discussion.md

---
name: project-mcp-server-discussion
description: "MCP server for Beyond — remote, read-only, OAuth-gated, ad-hoc SQL over live Neon; fully specced in discussion, PARKED (no code) while owner learns MCP"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f15dbcf-7895-4d5c-b2e9-05e6df133a0a
  modified: 2026-08-13T04:07:49.437Z
---

2026-08-12: Discussion-only exploration of building an **MCP server** so the owner can ask the business questions in natural language from an AI app (Claude first). **No code written — parked** while the owner reads up on MCP and comes back.

Full notes: `docs/MCP-SERVER-DISCUSSION.md` (decisions table, architecture, OAuth options, guardrails, example questions, build order, open threads). Diagram artifact: https://claude.ai/code/artifact/1370d792-7b78-434a-b5de-0e16f9b48ddb

Decisions settled: **read-only**, **ad-hoc SQL only** (v1, one `run_sql` tool), **full schema + full data** exposed, **live/main Neon DB** (no replica), **all on Cloudflare + Neon** (recommend a new `apps/mcp` Worker), **remote + OAuth 2.1** (lean: Cloudflare `workers-oauth-provider`), **Claude first** (ChatGPT `search`/`fetch` conventions later), **you + owner, a login each**, guardrails = **SELECT-only Neon role + statement timeout + row cap**.

**Update 2026-08-12 (Cloudflare "MCP v2" post, blog.cloudflare.com/mcp-v2):** MCP is now stateless → run in a **plain Worker with `createMcpHandler`** (official now), **no Durable Objects / `McpAgent`** needed (our server is stateless — each SQL call independent). OAuth: **DCR is deprecated** (gone after summer 2027) → use **CIMD** (`clientIdMetadataDocumentEnabled: true`) on `workers-oauth-provider`. TS SDK replatformed to Web Standards (better for Workers). Core decisions + guardrails unchanged; still doesn't mention Claude/ChatGPT.

**Update 2026-08-12 (Neon's OWN MCP server, neon.com/docs/ai/neon-mcp-server):** Neon ships a hosted remote MCP at `https://mcp.neon.tech/mcp` with `?readonly=true` + `?projectId=<id>` + OAuth — a `querying` (run SQL) tool. **Could replace building our own for a v1 (near-zero code).** Trade-off: broad tool surface, **Neon-account-level auth** (not per-app-user), Neon's own timeouts (not our custom guardrails/audit). TENSION: Neon **explicitly warns "never connect MCP to production DBs" + avoid PII** — contradicts our "live DB + show everything" calls; mitigation = point it at a **read-only Neon branch** (copy-on-write, isolates the live app). OPEN Q for owner: OK to use a branch instead of the live primary? Leaning: fast v1 = Neon hosted MCP (read-only, project-scoped, on a branch); build custom CF Worker later only if we need custom guardrails / per-user auth / curated tools.

**Update 2026-08-12 (Neon branching vs read replicas):** For the MCP's read-only data source use a **READ REPLICA, not a branch** (corrects earlier "branch" note). Branch = point-in-time copy that goes stale (needs reset-from-parent). Read replica = separate read-only compute on the SAME storage → **always current** (sub-second async lag), isolates heavy queries from the live app, **no extra storage cost**, **scales to zero** idle (wakes in seconds up-to-date). Create: Console "Add Read Replica" / CLI `neon branches add-compute <branch> --type read_only` / API. Nuance to verify: hosted `mcp.neon.tech?projectId=` likely hits the PRIMARY (readonly blocks writes but may not route to the replica); to force replica routing, point a self-hosted Neon MCP or our Worker at the **replica's connection string**. Two shapes: fastest v1 = hosted Neon MCP readonly on primary; write-safe+perf-isolated = server → replica conn string.

**Update 2026-08-12 (checked neondatabase-labs/mcp-server-neon repo):** Neon's MCP **cannot target a replica** — it's **API-key/OAuth account-scoped, no raw DATABASE_URL**, runs SQL via the Neon API on the branch's **PRIMARY** compute (`readonly`/`projectId`/`category` are URL params on the remote `mcp.neon.tech` Vercel app; local `npx @neondatabase/mcp-server-neon start <API_KEY>` = same primary behavior). So `readonly=true` = write-safe but NOT perf-isolated. To run on the **replica**, use a **generic read-only Postgres MCP** (`@modelcontextprotocol/server-postgres` or `crystaldba/postgres-mcp`) pointed at the **replica connection string** + a SELECT-only role — or our own Worker. Final fork: fastest v1 = hosted Neon MCP readonly (on primary, zero infra); replica-isolated = generic Postgres MCP / Worker → replica conn string.

**Update 2026-08-12 (generic Postgres MCP depth; owner has CREATED the read replica):** Reference `@modelcontextprotocol/server-postgres` = **ARCHIVED**, skip. **`crystaldba/postgres-mcp` ("Postgres MCP Pro")** = the real generic option: `--access-mode=restricted` (read-only txn + `pglast` parse + exec cap), `DATABASE_URI` env (= replica conn string), transports stdio + SSE, install pipx/uv/Docker; tools incl. `execute_sql`, `list_schemas`, `list_objects`, `get_object_details`, `explain_query`, health/tuning. **Gap: no built-in OAuth** (SSE remote is unauthenticated → needs an auth layer). So fork: **LOCAL Claude Desktop (stdio, no OAuth, ~5 min)** vs **REMOTE (SSE behind auth, or our CF Worker with workers-oauth-provider)**. Pending owner answer: local-desktop vs truly-remote (the earlier "remote+OAuth" pick was for "any app" flexibility; local needs neither).

**Update 2026-08-12 (remote decision + recommendation):** Owner wants **remote** + prefers **Python (pipx/uv)** runtime; replica created; asked compare+recommend. Compared **A: Postgres MCP Pro (Python, SSE) + CF Tunnel/Access** vs **B: our small Cloudflare Worker**. **RECOMMENDED B** — the hard reqs (remote + OAuth) are exactly what the Python server lacks natively (no MCP OAuth → fragile auth-fronting + a 24/7 VPS); the Worker does OAuth (`workers-oauth-provider`/CIMD) + Streamable HTTP natively on existing CF+Neon, nothing to provision. Recommendation goes AGAINST the Python preference on purpose (language < getting remote-auth right). Keep Postgres MCP Pro as a **local** power tool (pipx + Claude Desktop vs replica) later. Pending: owner to accept B (Worker) or stick with A (Python+CF Access). No code yet.

**Update 2026-08-13 (FINAL BUILD SPEC compiled — all decisions locked, still NO code):** `docs/MCP-SERVER-DISCUSSION.md` rewritten from running-log into an **implementation-ready build spec**. Locked: login = **Google** upstream; allowlist = **`support@vardhansystems.in`** only (owner added later); guardrails = **5000-row cap + 15s statement_timeout** + audit log; deploy URL = a **`workers.dev` subdomain** (`sri-aparajita-mcp.<account>.workers.dev`). Data role = **`mcp_readonly` SELECT-only**, created on the PRIMARY (roles are cluster-wide; can't CREATE ROLE on the read-only replica), connect via the **replica pooled host** with `?options=-c statement_timeout=15000`. Read-only enforced 3 ways (replica rejects writes + SELECT-only role + read-only txn). Spec has: file layout (`apps/mcp/src/{index,mcp,google-auth,db}.ts`), wrangler + secrets (`REPLICA_DATABASE_URL`, `GOOGLE_CLIENT_ID/SECRET`, `OAUTH_KV`), `run_sql` tool contract, server instructions w/ data caveats, 5-phase checklist, acceptance questions. Build on owner's go.

**Update 2026-08-12 (CHOSEN: Option B, the Worker):** Owner accepted building a **new `apps/mcp` Cloudflare Worker**. Stack: **`createMcpHandler`** (official TS SDK, Streamable HTTP, stateless, no DO) + **`@cloudflare/workers-oauth-provider`** (MCP OAuth/CIMD) + **`@neondatabase/serverless`** → read-replica conn string. Decisions: auth = upstream **Google/GitHub sign-in, allowlist the 2 emails**; one tool **`run_sql`** (SQL-only, schema via information_schema); guardrails = **SELECT-only Neon role + statement_timeout ~8s + row cap + audit log**; runs on CF edge (e.g. `mcp.vardhansystems.in`), nothing to keep alive. Phases: scaffold+run_sql (MCP Inspector) → add oauth-provider+upstream login → wrangler deploy + add custom connector in Claude → harden. Decide before building: Google vs GitHub + 2 emails · SELECT-only role SQL · row-cap/timeout · Worker URL. **Still no code** — owner learning MCP; full plan in `docs/MCP-SERVER-DISCUSSION.md`.

**Update 2026-08-13 (BUILD STARTED, Phase 0/1):** Owner chose **skip the dedicated SELECT-only role — query the read replica directly** (the replica endpoint physically rejects writes, so read-only is enforced at the endpoint even with `neondb_owner`). Replica conn string is in `apps/mcp/.dev.vars` (gitignored; root `.gitignore` now ignores `.dev.vars`). Verified the string reaches the REPLICA (`pg_is_in_recovery()=true`, 290 customers read OK) and the Neon HTTP driver accepts it (incl. `channel_binding=require`). **IMPORTANT build correction:** the v2 Cloudflare post = **stateless `createMcpHandler` from `agents/mcp/server`, NO Durable Object**. My first scaffolding wrongly used **`McpAgent`** (DO+migrations); owner caught it. **Use `createMcpHandler` (v2 stateless), NOT McpAgent** (McpAgent only as fallback if createMcpHandler isn't in the installed `agents` version). Verify exact `McpServer` import path (`@modelcontextprotocol/server` per post vs `@modelcontextprotocol/sdk/server/mcp.js` per McpAgent docs). Build currently PAUSED after this correction — `apps/mcp` dir created, `src/db.ts` write was rejected; re-scaffold the v2 way. Note: statement_timeout enforced client-side via `AbortSignal.timeout` in db.ts (connection-string `options` may not pass through the HTTP driver).

**Update 2026-08-13 (PHASE 1 DONE + verified, v2 stateless):** `apps/mcp` Worker built & working. Confirmed the v2 stateless path IS shippable: `createMcpHandler` from **`agents/mcp/server`** + SDK v2 **`@modelcontextprotocol/server@2.0.0`** `McpServer` (NOT the v1 `@modelcontextprotocol/sdk` — that's the deprecated compat path); **NO Durable Object, NO migrations**. Deps: `agents@0.20.1`, `@modelcontextprotocol/{server,client}@2.0.0` + `sdk@1.30`, `zod@4.4` (works with SDK registerTool), `@neondatabase/serverless@1.1`. Files `src/{index,mcp,db,instructions,worker-env.d}.ts`. Env threaded via **module-scope stash** (per-request `McpServerFactory` ctx carries no Worker env). `run_sql` tool → `runReadOnlySql` (5000-row cap, `AbortSignal.timeout` 15s). **E2E verified via wrangler dev + JSON-RPC**: initialize/tools-list/tools-call all work (290 customers; SEs Sandeep126/Murali96/Upendar35); **write rejected** ("cannot execute UPDATE in a read-only transaction"), `pg_is_in_recovery()=true`. tsc clean. Gotchas: `compatibility_date` had to be **2026-07-08** (installed wrangler 4.107 runtime max, not 2026-08-01); MCP Streamable HTTP needs `Accept: application/json, text/event-stream`. NEXT = Phase 2 (OAuth: `@cloudflare/workers-oauth-provider` + Google, allowlist support@vardhansystems.in) — needs the owner to create a Google OAuth client; then Phase 3 deploy to workers.dev + add custom connector in Claude.

**Update 2026-08-13 (PHASE 2 DONE + verified — PASSPHRASE OAuth, NOT Google):** Owner decided auth = **password-gated OAuth**, no Google/third-party (reason: claude.ai custom-connector dialog offers only OAuth-or-open, no bearer-header field; a passphrase login is the simplest real gate for 2 trusted users). Built with **`@cloudflare/workers-oauth-provider@0.10.3`**: `export default new OAuthProvider({ apiRoute:"/mcp", apiHandler (wraps createMcpHandler + env stash), defaultHandler: authHandler, authorizeEndpoint:"/authorize", tokenEndpoint:"/token", clientRegistrationEndpoint:"/register", scopesSupported:["mcp:read"] })`. `src/auth.ts` renders a passphrase login on `/authorize`, checks `env.MCP_PASSPHRASE`, then `env.OAUTH_PROVIDER.completeAuthorization({...props:{userId:"sri-aparajita-owner"}})`. Requires KV binding **`OAUTH_KV`** (wrangler.jsonc, placeholder id for local; create real one for deploy). Secrets: REPLICA_DATABASE_URL + MCP_PASSPHRASE (local test value `beyond-test-2026` in .dev.vars — owner picks the real one at deploy). **E2E verified (node/curl)**: /mcp no-token→401 + WWW-Authenticate Bearer; DCR register→authorize form→wrong-pass 401→correct-pass 302+code→/token (scope mcp:read)→/mcp WITH token runs run_sql (290 customers). tsc clean. Env type: `OAUTH_KV: KVNamespace`, `OAUTH_PROVIDER: OAuthHelpers`. NEXT = Phase 3 deploy: `wrangler kv namespace create OAUTH_KV` + paste id; `wrangler secret put REPLICA_DATABASE_URL` + `MCP_PASSPHRASE`; `wrangler deploy`; add custom connector in Claude (workers.dev URL + /mcp, no client id/secret — DCR); then Phase 4 harden (audit log, rate limit).

**Update 2026-08-13 (PHASE 3 DEPLOYED + verified live):** `apps/mcp` Worker is LIVE at **`https://sri-aparajita-mcp.vardhansystems.workers.dev`** (MCP endpoint `/mcp`) on the owner's Cloudflare (vishnuvardhan@vardhansystems.in). Created KV `OAUTH_KV` id `57a40507909f423392fba3d926966adb` (in wrangler.jsonc); set secrets `REPLICA_DATABASE_URL` + `MCP_PASSPHRASE` (owner-chosen passphrase `Beyond-Auto-lub-MCP-6304`); `wrangler deploy` (wrangler 4.107, compat_date 2026-07-08). Verified in prod: /mcp no-token→401 + WWW-Authenticate; AS metadata https; full OAuth flow (register→authorize form→wrong-pass 401→correct-pass→token scope mcp:read→/mcp run_sql = 290 customers). ONLY REMAINING STEP = owner adds it in Claude UI (Settings→Connectors→Add custom connector→URL .../mcp, blank OAuth fields=DCR→enter passphrase). Optional Phase 4 harden: audit log (who/sql/rows/ms), rate limit, add owner's 2nd person. Local `.dev.vars` keeps a TEST passphrase `beyond-test-2026` (prod secret is the real one).

**Update 2026-08-13 (BLOCKER: Claude connect fails at token exchange — KV cross-region race):** Adding the connector in claude.ai fails with `mcp_token_exchange_failed`. `wrangler tail` on sri-aparajita-mcp showed the exact flow: register→GET/authorize→POST/authorize (302+code)→**POST /token → 400 invalid_grant "Grant not found or authorization code expired"** ~1s after issuance (NOT time-expired). Ruled OUT: resource-indicator mismatch (Claude sends `resource=<origin>` no /mcp — reproduced, still works), confidential vs public client (both work), request shape. My same-region curl flow ALWAYS succeeds; Claude fails. Root cause = **Cloudflare KV eventual consistency across regions**: `/authorize` writes the code+grant (`grant:sri-aparajita-owner:<id>`) to KV near the user (India); Anthropic's `/token` reads from KV near US ~1s later before propagation → grant not found. Known class of issue (anthropics/claude-ai-mcp issues). workers-oauth-provider 0.10.3 (latest) has no consistency config; uses get/put/delete/list on env.OAUTH_KV. FIX options: (A) back OAUTH_KV with a **single Durable Object** (strongly consistent) via a KV-shim → the proper fix (reintroduces a small DO just for OAuth state); (B) Claude **Desktop** + bearer token (no code flow, sidesteps KV) — but user is on claude.ai web; (C) just retry (unreliable). Awaiting owner's choice. NOTE: temporary passphrase gate etc. all verified working; only the cross-region code exchange is broken.

**Update 2026-08-13 (FIX DEPLOYED — DO-backed OAuth store):** Fixed the cross-region KV race by backing the OAuth store with a **single strongly-consistent Durable Object**. New `apps/mcp/src/oauth-kv-do.ts`: `OAuthKvDO extends DurableObject` implements the KVNamespace subset the provider uses (kvGet/kvPut/kvDelete/kvList over `ctx.storage`, with TTL-on-read); `makeConsistentKV(stub)` shims it to KVNamespace. `index.ts` now wraps `provider.fetch(request, {...env, OAUTH_KV: makeConsistentKV(stub)}, ctx)` (addresses one DO via `idFromName("oauth-store")`). wrangler.jsonc: removed `kv_namespaces`, added `durable_objects` OAUTH_DO + migration v1 `new_sqlite_classes:["OAuthKvDO"]`. Redeployed; prod full OAuth flow verified (register→authorize→token→/mcp 290 customers), gate still 401. **NOTE for owner:** if Claude reconnect fails with "Unknown OAuth client", REMOVE the old connector and ADD fresh (Claude cached a client_id in the now-empty old KV; needs a new DCR against the DO). Old KV namespace `57a40507...` is orphaned/unused (can delete later). Awaiting owner's cross-region retry in Claude to confirm the real fix. **RESOLVED — owner removed+re-added the connector and it CONNECTED & WORKS in claude.ai (2026-08-13).** Logs showed register→authorize→clean stream of `POST /mcp - Ok` (initialize+tool calls), no invalid_grant. **The MCP server is now fully LIVE and usable end-to-end.** Phase 4 partial DONE 2026-08-13: **(1) Query audit log** — new `apps/mcp/src/audit-do.ts` `AuditLogDO` (single DO, holds last 500 entries newest-first: ts/ok/rowCount/truncated/elapsedMs/sql/error); `run_sql` best-effort-logs every call; new read-only **`get_audit_log`** MCP tool (limit default 20). Off-DB by design (replica is read-only). Deployed + verified (already capturing the owner's real Claude queries). **(2) Second person** = **same shared passphrase** (owner's choice) — needs NO code; both use `Beyond-Auto-lub-MCP-6304`, audit can't distinguish them (accepted). **(3) Cleanup** — deleted orphaned KV namespace `57a40507...` (account now has zero KV namespaces; OAuth uses the DO). apps/mcp files: index, auth, db, mcp, instructions, oauth-kv-do, audit-do, worker-env.d. Migrations v1 OAuthKvDO + v2 AuditLogDO. Still NOT git-committed. Remaining optional: rate limit; per-person passphrases if attribution ever wanted.

Data caveats to remember: orders store **no price** (true margin isn't in orders; MOP/DLP live in price-master/[[project-margin-simulator]]); oils are measured as **ordered** but bearings come from **invoices** — don't mix sources in a "total sales" query. Related: [[project-overview]], [[project-deploy]].

---

## project-mobile-apk-size.md

---
name: project-mobile-apk-size
description: "Why the EAS mobile APK was ~120MB and how it's fixed (ABI restriction to arm64-v8a)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6da298a3-8e15-40aa-b01f-22bbd9ca0284
---

The EAS `preview` APK for the SE app was ~120 MB because Expo prebuild sets `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` — every native `.so` (React Native, Hermes, each native module) ships for all 4 CPU architectures; a phone loads only one (arm64-v8a). ~¾ of the file is discarded CPU code.

**Note:** `apps/mobile/android/` is **gitignored** (`/android` in .gitignore), so EAS regenerates it via `expo prebuild`. Editing `android/gradle.properties` directly does NOT affect EAS builds. Also, local `expo run:android` only ever builds the connected device's ABI (arm64 on the Apple-Silicon emulator), so the ~120 MB was never seen locally — only in EAS.

**Fix (2026-07-13):** a config plugin `apps/mobile/plugins/withAndroidAbiFilter.js` (uses `withGradleProperties`) pins `reactNativeArchitectures`, registered first in `app.json` → `expo.plugins`. **Decided value: `arm64-v8a,armeabi-v7a`** — arm64 covers every 64-bit phone since ~2017 (incl. test Moto); armeabi-v7a keeps old/ultra-budget 32-bit phones (Android Go) working for the rural field-sales market. Still drops the two x86 emulator ABIs. Verified: after `expo prebuild -p android`, gradle.properties = `arm64-v8a,armeabi-v7a`. Override with env `ANDROID_ABIS=arm64-v8a` for the smallest possible APK.

**Measured (debug builds, isolates ABI effect):** all-4-ABI = 229.6 MB; arm64-only = 80.9 MB (−65%); per-ABI native libs — arm64 56.7 MB, armeabi-v7a 34.1 MB, x86 57.3 MB, x86_64 56.6 MB. Shipping arm64+v7a ≈ 115 MB debug (~50% smaller than all-4); release/EAS proportionally smaller.

**OS-version reach:** minSdkVersion = 24 (Android 7.0), Expo SDK 57 default, not overridden — covers the last 5 Android versions and older. No change needed (decided 2026-07-13: support at-least-last-5, keep older too).

Further optional trimming (not done): install `expo-build-properties` and enable `android.enableProguardInReleaseBuilds` + `enableShrinkResourcesInReleaseBuilds` (proguard can break reflection — test before shipping). Or ship an `.aab` (App Bundle) if going to Play Store. See [[project-mobile-rebuild]] and [[project-deploy]].

---

## project-mobile-collections-beat-due.md

---
name: project-mobile-collections-beat-due
description: "Mobile SE app: collection performance (total+verified, day/week/month) in the My Performance card, and per-customer collection due (outstanding + ageing bucket) on each beat-plan stop."
metadata: 
  node_type: memory
  type: project
  originSessionId: 749d7190-55d2-4eb5-aaf4-045985026923
  modified: 2026-09-09T19:23:42.782Z
---

**2026-09-10.** Two SALES_EXECUTIVE mobile features (apps/mobile, TDD, ≤100 lines/file).

**1. Collection performance** — added to the Home "My Performance" card alongside oils/bearings. Total ₹ collected + verified split, per today/week/month, **actuals only** (collections have no target). API: new `getCollectionActuals` in `apps/api/src/services/targets.ts` (bounds mirror `getOilActuals`; total = non-rejected, verified = accountant-verified; by `collection_date`, `collected_by_user_id`), wired into `getMyPerformance` → `/targets/me` now returns `collections:{total,verified}` on today/week/month. Mobile: `performance.ts` types gained `CollectionActual`; pure `collectionsForTab` lives in NEW `lib/performance-format.ts` (kept out of performance.ts so it's testable without the Expo `__DEV__` runtime — importing performance.ts in vitest throws `__DEV__ is not defined`); a "Collected" `LeadStat` added to `performance-card-body.tsx`.

**2. Beat-plan collection due** — each stop row shows the customer's total outstanding ₹ + ageing-bucket chip (0–30/31–45/46–60/61+, emerald→amber→orange→red), only when outstanding > 0. API: `getTodayBeatPlan` (`beats.ts`) gained a lateral summing outstanding (invoices + customer_opening_balances) + oldest-invoice age; `mapStopRow` returns `outstanding` + `dueBucket` via new exported `bucketFromAge(ageDays)` in `dues.ts`. Mobile: `BeatStop` type + `stop-row.tsx` chip; bucket→label/colour via NEW `lib/dues-bucket.ts` (`dueBucketMeta`).

**TDD:** `bucketFromAge` (api dues-bucket.test, 4), `dueBucketMeta` (mobile, 3), `collectionsForTab` (mobile, 2) — all pass. web+api+mobile tsc clean.

**Also fixed (my earlier regression):** the committed Sold Oil/dashboard-cards work (see [[project-order-fulfillment-status]]) had broken `apps/api/src/routes/dashboard-metrics.test.ts` (6→8 metrics, litres now delivered/invoice-based). Updated its sql mock (`metrics_delivered`/`metrics_ordered`/`metrics_bearings`, `agent_customer_delivered`) + 2 assertions → 10/10 pass.

**Pre-existing (NOT this work):** 13 api route-test failures remain in collections/customers/mobile-sync POST endpoints — `Error: This context has no ExecutionContext` (test harness supplies no Workers executionCtx for `waitUntil` push calls) + body-validation 422s. Predate this work (customers create, untouched by me, fails identically). See [[project-dues-ledger-truth]].

**STATUS:** code complete, UNCOMMITTED. Needs apps/api deploy + a new mobile build (APK, [[project-mobile-apk-size]]) to see on device. `/targets/me` + `/beats/today` are the changed contracts.

---

## project-mobile-offline-vision.md

---
name: project-mobile-offline-vision
description: "Mobile SE app must work fully offline — ALL data cached and shown, never a bare \"Couldn't load\""
metadata: 
  node_type: memory
  type: project
  originSessionId: 6da298a3-8e15-40aa-b01f-22bbd9ca0284
---

The Sales Executive mobile app (apps/mobile) must be **fully offline-capable**: every kind of data — orders, collections, market-intelligence images, customer history, everything — should be cached locally and displayed when there is no signal. The app must **never show a bare "Couldn't load … / Retry"** for data it could have cached. Stated by the user 2026-07-13 during an offline e2e test.

**Why:** field reps work in low/no-signal shops. The current customer-detail screen (Last 5 Sales / Last 5 Collections / Market Intelligence photos) is network-only and fails offline — and does NOT show an order the rep just created offline. That risks re-entry (duplicates) and lost trust. The Home "Today's activity" already reads from local SQLite and works offline; the rest of the app should match.

**How to apply:** when building/reviewing mobile read screens, add a local (SQLite/cache) fallback that merges unsynced local records (show a "pending" badge) with last-known cached server data. Photos should be cached too. Contrast the offline-first Home screen (works) with customer detail (network-only, needs fixing). Stage: early pilot with a few trusted reps. See [[project-mobile-rebuild]].

**Implemented 2026-07-13** (verified live offline): customer detail now shows Last-5 sales, Last-5 collections, and customer info offline for all the SE's customers. Local SQLite tables `cached_orders` + `cached_collections` (local-db.ts v5); helpers `cacheCustomerOrders`/`getCachedOrders` + `cacheCustomerCollections`/`getCachedCollections` in order-cache.ts; customer/[id].tsx fetchers cache-on-success and fall back to cache offline; sync.ts kickSync prefetches — collections free from the bulk `/collections` pull, orders per-customer (throttled 10 min). **Photos deliberately NOT cached** (out of scope per user).

Still-open gaps (not addressed):
- MI/customer **photos** are still network-only → "Couldn't load photos" offline (intentionally deferred).
- Home activity row status is stale after a sync completes until the screen is re-focused.

---

## project-mobile-rebuild.md

---
name: project-mobile-rebuild
description: "Mobile app rebuild decisions (2026-07-09) — apps/mobile in monorepo, pnpm-only, and planned/unplanned visit semantics"
metadata: 
  node_type: memory
  type: project
  originSessionId: 52f17895-91a5-462f-89b3-eda9bcade413
---

Decisions made 2026-07-09 with Vishnu:

1. **Mobile app location**: rebuild the SALES_EXECUTIVE React Native (Expo) app at `apps/mobile` INSIDE the pnpm monorepo — NOT the standalone npm repo that MOBILE_PLAN.md originally mandated (user rejected standalone; MOBILE_PLAN.md has been updated). pnpm ONLY — the first app died from npm-inside-pnpm package duplication breaking NativeWind/Metro, not from the monorepo itself. Share types/API contracts/business rules via `packages/shared` (currently an empty stub). Web shadcn/Base UI components are NOT reusable in RN; mobile UI uses react-native-reusables.
2. **Visit semantics**: a visit checked in against a `beat_plan_stops` row is a **planned** visit; a visit without a beat-plan stop is **unplanned**. Both allowed, tracked separately. The API's two parallel flows (`/visits` beat-stop-based and `/executive-day` assignment-based) should converge on this single model.
3. API gaps for mobile — CLOSED 2026-07-09 (TDD, `apps/api/src/routes/mobile-sync.test.ts`; migration `0009_mobile_sync.sql` applied to Neon): `GET /customers/:id/invoices` (creditBlocked computed server-side from `credit_overdue_days` setting), `POST /visits/gps/batch` (alias of `/visits/gps`), `clientUuid` idempotency on visits/orders/collections POSTs (replay → 200 + `existing: true`), `?since=` on `GET /customers` and `GET /orders/products`. Also opened `GET /customers`, `GET /orders/products`, `POST /orders` to SALES_EXECUTIVE (salesExecutiveId forced to self on POST).
4. `apps/mobile` (Expo SDK 57, Expo Router, NativeWind 4): **Phases 1–5 all built and emulator-verified 2026-07-09** — login/beat list, GPS check-in/out (planned visits), orders with server-side credit gate, collections with invoice allocation, 3-tab UI (Home/Customers/Settings + sync inspector), LWW status pull, chaos-tested offline sync (zero dupes). Only the EAS dev-build device gate remains (needs Vishnu's Expo account). Local SQLite migrations self-heal: migrateLocalDb intentionally has NO user_version early-return (idempotent steps only) — do not "optimize" it back. **Toolchain notes:** tailwindcss must stay pinned to 3.4.x (expo install grabbed v4, which breaks NativeWind), `react-native-css-interop` must be a direct dependency (pnpm strictness hides NativeWind's JSX runtime otherwise), and NativeWind's CSS interop CANNOT parse oklch() colors (verified on device 2026-07-09 — styles silently drop, e.g. transparent buttons): mobile theme tokens in `apps/mobile/src/global.css` mirror the web's globals.css but as exact hex conversions (via culori), with the oklch source in comments. Mobile is light-only for now (.dark block present but inert, darkMode: "class"). EAS dev-build device gate still pending (needs Vishnu's Expo account + Android device).
5. **Mobile testing pattern**: offline/sync modules (`local-db.ts`, `sync-core.ts`, `beat-cache.ts`) are pure TS with zero RN imports, tested in vitest against Node's built-in `node:sqlite` via a `LocalDb` interface; expo-sqlite adapts to the same interface at runtime (`src/lib/db.ts`). Keep new offline logic in pure modules so it stays testable. Sync semantics: FIFO flush, retryable failure stops the flush (causal order), permanent 4xx parks as failed with manual retry.

**Why:** these were explicit user decisions via Q&A; docs alone flip-flop on mobile scope. The toolchain notes are the exact failure modes that killed the first build.
**How to apply:** treat MOBILE_PLAN.md (as updated 2026-07-09) as authoritative for mobile; never suggest a standalone mobile repo or npm; keep tailwind pinned 3.4.x and css-interop direct in apps/mobile; when touching visit code, move toward planned/unplanned unification. See [[project-overview]].

---

## project-mobile-shimmer.md

---
name: project-mobile-shimmer
description: "SE mobile shimmer/skeleton loading system — presets, the cache rule, and per-screen coverage"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-07T20:40:49.194Z
---

The SE mobile app has a **context-aware shimmer** system in `apps/mobile/src/components/skeleton.tsx` (pure RN, no gradient dep — a skewed translucent band on a single shared native-driver loop via `SkeletonTheme`). Core rule: **a skeleton shows ONLY on cold first-load when nothing is cached**; if offline/cache data exists the screen renders it instantly and refreshes quietly. Each screen composes a skeleton that MIRRORS its real final layout, never a generic centered spinner.

**Presets (import from `components/skeleton`):** `Skeleton` (one block), `SkeletonTheme` (shared-sweep wrapper), `SkeletonList({count,row})`, and row shapes `CardRowSkeleton`, `ListRowSkeleton`, `PickerRowSkeleton`, `InvoiceRowSkeleton`, `NotificationRowSkeleton`, `DuesRowSkeleton`, plus (added 2026-08-08) **`ContactRowSkeleton`** (avatar+2 lines, contacts list), **`FormFieldSkeleton`** (label+input, edit forms), **`RecordRowSkeleton`** (rounded-3xl order/collection cards), **`LedgerRowSkeleton`** (rounded-2xl, 2 left + 2 right), **`PdfPageSkeleton`** (invoice-PDF page placeholder).

**Full-coverage pass done 2026-08-08** (built + tsc + 111 tests pass; NOT committed; needs new APK):
- Fixed mismatches: Customers tab → ContactRowSkeleton; customer/edit + settings/profile → FormFieldSkeleton (were directory cards); customer/[id] orders+collections → RecordRowSkeleton; ledger/[id] → LedgerRowSkeleton + shimmered the closing-balance number; invoice/[id] → PdfPageSkeleton (was a bare `ActivityIndicator` — the only real gap); dues-card radius → rounded-3xl.
- Left as-is (already good): Home, alerts, dues/[bucket], order/new, reminder/new (search-result), performance-card, order-detail-sheet, Home greeting header.
- **Deliberately skipped** (user decision): screens with NO first-load network fetch render instantly so a shimmer would just flash — Reminders tab (local SQLite), Settings, collection/new, stop/[stopId], customer/new. And **submit/save BUTTON spinners are kept** (login, password/customer save, GPS capture, share, sync, checkout) — those are actions, not first-load.

Related: [[project-customers-contacts-list]], [[project-mobile-offline-vision]] (the "never a bare Couldn't-load" ethos this supports).

---

## project-mobile-stress-findings.md

---
name: project-mobile-stress-findings
description: "Mobile app stress/perf test findings (2026-08-22): release-build perf numbers + offline gaps + transient SE→admin role-guard slip"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81771ad0-d42b-4b51-a8ef-ce7de64a6ce9
  modified: 2026-08-22T17:40:26.013Z
---

2026-08-22: Ran stress/perf tests on the SE mobile app (apps/mobile) on the Pixel emulator, on a **release APK** (built locally via `android/gradlew :app:assembleRelease`, JBR JDK from Android Studio, signed w/ debug keystore). Logged in as real prod SE "Sandeep". All read-only (no writes to prod).

**PERF (release vs debug — debug is Metro/`__DEV__`, ~4x worse, never judge perf on it):**
- Cold start ~1.3s release vs ~5.8s debug; warm 0.16–0.53s vs ~1.2s.
- Scroll frame-time percentiles (emulator marks every >16ms frame "janky" — % is a host-GPU artifact, percentiles are the signal): Customers ~330 p50 61 / p95 105 / p99 121ms; Bearings ~1830 p50 57 / p95 117 / p99 300ms. Virtualization works (median flat vs list size); only hard-fling tail on the 1830 list strains. FlashList/list-tuning (reverted earlier) would target that tail.
- Memory: NO leak. Release soak PSS 458→**424MB** (GC reclaimed), Views/Activities/AppContexts plateau. Survives process-kill (`am kill`), Doze (`deviceidle force-idle`), screen-off — session persists (SecureStore), no crash. 240-event random input fuzz: no crash/ANR.
- Prod API edge: unauth `GET /me` ×120 @ conc 20 → all 200, p50 54 / p95 110 / p99 117ms (edge only, no Neon).

**FINDINGS worth acting on:**
1. **Offline gaps (contradicts [[project-mobile-offline-vision]] "never a bare Couldn't load"):** offline, these are NOT cached and show "Couldn't load": per-customer **Ledger**, customer-detail **Last-5 Orders / Last-5 Collections / Market-Intelligence photos**, Home **Leaderboard**; customer-detail **Balance falls back to ₹0** (was ₹640 online). Cached & fine offline: Customers list, SE Home performance card + beat. Reconnect recovery works via each screen's focus-refetch.
2. **Transient role-guard slip (client-only, low sev):** under rapid back/navigation an SE briefly RENDERED the **Super Admin dashboard** ((admin) route group — "Dues by executive", "Active Executives", Tracking tab) for ~several seconds before `AuthGate` in `app/_layout.tsx` redirected back to (tabs). Likely the documented `/` ambiguity between `(admin)/index` and `(tabs)/index`. **Data did NOT leak** — SA endpoints are role-guarded server-side (403 an SE token), so only skeletons showed. Fix = block the admin group render synchronously for non-admin roles, not via post-render effect.

**Layout:** portrait-locked (no landscape). Large font 1.30 → only "Commercial" wraps. Low-res 720x1280 → Week/Month toggle labels truncate ("Wee"/"Mont"). Both cosmetic.

**WRITE SUITE (2026-08-22 pm, SE account vishnuvardhan@vardhansystems.in / role SALES_EXECUTIVE, token via API):**
- **Authed API load** 150 reqs @ conc 20, all 5 SE endpoints → **150/150 200, zero errors**. Latency p50/p95: /targets/me 98/163, /customers 92/157, /dues/me/summary 90/188, /orders/products 94/162ms. **HOTSPOT: `/beats/today` p50 349 / p95 423ms (~4x others)** — beat-plan materialization; optimize before big concurrent 8AM rush.
- **Idempotency VERIFIED** (the offline-queue safety) on check-in, order, collection: same `clientUuid` replay → `existing:true`, no duplicate. Minor: a **non-UUID clientUuid → raw 500** (uuid-column cast) instead of clean 400.
- **7 PM cutoff enforced client-side**: "Start day" after 19:00 IST → "Day is over — runs until 7 PM" dialog (couldn't test live GPS capture past 7PM).
- Customer-create requires legalName + customerType(mechanic|retail|lof|industrial) + addressPincode + creditLimit + creditDays.
- **TEST DATA created on PROD then CLEANED UP (2026-08-22):** customer CUST-0328 "ZZ PERF TEST — DELETE ME" + 2 orders + 2 order_items + 1 collection + 1 visit + 1 beat_customer_days + **15 se_notifications** hard-deleted via psql transaction (prod primary, .dev.vars DATABASE_URL). Verified gone. Left audit_logs create-entry (no FK, harmless). NOTE: 15 se_notifications for ONE fresh customer — possible over-generation of SE notifications on customer/order/collection create, worth a look.
- Retracted earlier "greeting name mismatch" — it was just a prior logged-in account (Sandeep, a real SE); greeting correctly shows current user.

**Env left changed:** emulator now runs the RELEASE APK (debug build uninstalled → no Metro hot-reload till reinstalled). Gitignored symlink `node_modules/@babel/plugin-transform-react-jsx`→pnpm store added so release JS bundling resolves under pnpm (removed by fresh `pnpm install`).

---

## project-mobile-super-admin.md

---
name: project-mobile-super-admin
description: "Super Admin area added to the mobile app (was SE/Logistics only) — decisions, phase status, and how to run the local dev build"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4adfedc6-e5d2-4fac-86b5-afc4863cf55e
  modified: 2026-08-17T23:16:36.344Z
---

2026-08-17: Building a **SUPER_ADMIN area inside the Expo mobile app** (previously SE + Logistics only). IN PROGRESS — Phases 0–2 built + verified live on the emulator; not committed yet (local Metro dev).

**Locked decisions (from the user):**
- **Access:** SA logs in on the SAME mobile login with their own email+password. `auth.ts` login guard now allows `SUPER_ADMIN` (was SE/Logistics only); API `/auth/login` already accepts SA (checks `password_hash`) — SA needs a password set via web "Set password" if it fails. MANAGER/ACCOUNTANT stay web-only.
- **Interactivity:** FULL interactive (create/edit across all customers), NOT read-only.
- **Data:** online-only (no offline cache/queue for the SA area).
- **Tabs (5):** Home · Customers · Tracking · Alerts · Settings. Dues buckets = a card on Home → full buckets screen (filter to ONE SE).
- **Home KPIs:** mirror the web `/dashboard/metrics` cards (Active Executives live/total, Visits, Productive Visits, Sales–Oils litres/orders, Bearings qty, Collections ₹). **Summary cards only — no drill-downs.**
- **Customers:** ALL customers (reuse SE screens; `/customers` is role-scoped → returns everyone for SA), full detail (orders/collections/notes/ledger). **NO Market intelligence** — hide the "Market" button in `customer/[id].tsx` for SA.
- **SA create attribution:** when SA creates an order/collection, show an **executive picker** (like web) to credit an SE. (SE flow forces self; add a picker shown only for SA.)
- **Alerts:** an **activity feed** of 5 events, pushed via **FCM to ALL Super Admins**: executive login, order created, collection created, visit check-in, new customer created. Reuses existing mobile push (`push_tokens` + `sendExpoPush`); needs a SA notifications table + send-on-write hooks (login + customer are new; order/collection/visit already have web-push hooks to extend).
- **Tracking maps:** **react-native-maps (native)** — needs Google Maps Android SDK key + a NATIVE rebuild for that module. **Reuse the web Maps key** (⚠ it's a Maps JS API key; native needs "Maps SDK for Android" enabled on it, Android/none restriction). FULL parity with web `/dashboard/tracking`: rep list (Live badge, last-ping, point count) + pick rep → day-route polyline + current marker + date picker. SE + Logistics on one screen, filterable. **Auto-poll every 60s** ("Live" if last ping <12 min).

**Phase status:**
- **P0 (routing + shell) DONE+live:** `_layout.tsx` generalized to 3 role groups (`ROLE_GROUPS`=["(tabs)","(logistics)","(admin)"], `myGroup`/`myHome`). New `app/(admin)/` group: `_layout.tsx` (5 tabs) + index/customers/tracking/alerts/settings. `components/admin-placeholder.tsx`.
- **P1 (Home KPIs) DONE+live:** `app/(admin)/index.tsx` + `lib/admin-dashboard.ts` (`fetchDashboardMetrics` → `/dashboard/metrics`, token from `useAuth.getState().token`). KPI grid + skeleton/error/pull-to-refresh. `DashboardMetrics` type mirrors web.
- **P2 (Customers) DONE+live:** `app/(admin)/customers.tsx` re-exports the SE customers screen — shows ALL customers for SA. `customer/[id]` reused; for SA (`isAdmin = role==='SUPER_ADMIN'`) the **Market button, Market-Intelligence section, and Check-in button are hidden**. **Attribution: NO executive picker** — decided to auto-attribute to the customer's owning SE (data: all 299 customers owned by an SE). Implemented server-side: `customerOwnerSE(sql, customerId)` in `services/orders.ts`; `createOrder` + `createCollection` default salesExecutiveId/collectedByUserId to it when the office creator names none (SE-created still forces self; web dropdown still overrides).
- **P3 (master dues) DONE, needs API deploy:** API `getAdminDuesSummary`/`listAdminDuesCustomers` (services/dues.ts, optional `executiveId` filter, +owning-SE name) → routes `GET /dues/summary` + `GET /dues/customers` (SUPER_ADMIN/MANAGER). Mobile: `lib/admin-dues.ts`, `components/admin-dues-card.tsx` on Home, `app/(admin)/dues.tsx` (SE-filter chips + bucket strip + customer list → customer/[id]); `dues` registered `href:null` in the admin layout. ⚠ Emulator app targets the DEPLOYED API (`EXPO_PUBLIC_API_URL=https://api.vardhansystems.workers.dev/api/v1`), so P3 dues + the attribution change won't show on-device until `pnpm -C apps/api deploy`.
- **P4 (maps) BUILT + native-rebuilt + verified live (map tiles blocked on key):** `lib/admin-tracking.ts` (fetch `/tracking/executives?date=`, `/tracking/route?userId=&date=`, `isLive` <12min) + `app/(admin)/tracking.tsx` (MapView PROVIDER_GOOGLE + rep markers colored by live/selected + selected-rep route Polyline + fitToCoordinates + All|Sales Exec|Logistics filter + Today ‹›date stepper + 60s poll + rep list w/ role+pings). API: added `role` to `listTrackedExecutives` via a SUBQUERY (its FROM has NO roles join — a plain `r.code` 500'd with "missing FROM-clause entry for r"). Native rebuild gotcha: `expo run:android` reused existing `android/` so the app.json `googleMaps.apiKey` did NOT reach AndroidManifest → runtime crash "API key not found"; fix = `expo prebuild --clean --platform android` then rebuild (key then injected as `com.google.android.geo.API_KEY`). Verified live: screen + filter + date + rep list (Upendar/Murali/Srikanth · Sales Exec · 118/85/108 pings) all work; **map TILES blank** → `Google Maps Android API: Error requesting API token StatusCode=INVALID_ARGUMENT` = the reused web key is a browser/referrer Maps-JS key the Android SDK rejects. RESOLVED: user enabled "Maps SDK for Android" on the key → after a force-restart (no rebuild; key value unchanged, API enablement is Google-side) the **map tiles render + SE markers plot** (verified live near Khammam). ⚠ For a RELEASE APK the key's Android-app restriction must also include the release SHA-1 (debug SHA-1 works for the dev build).
- ~~**P4 (maps) SETUP done, screen+rebuild remain:**~~ (superseded)
- (old setup note)  `react-native-maps` installed (expo-pinned); Google Maps Android key injected into `apps/mobile/app.json` (`expo.android.config.googleMaps.apiKey`, reused the web `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, 39 chars — ⚠ that's a browser/referrer key; native Android needs "Maps SDK for Android" enabled + Android/none restriction or tiles render blank; ⚠ key now sits in committed app.json). Tracking API already returns BOTH SE+LOGISTICS (`r.code in (...)`); ADDED `role` to `listTrackedExecutives` response so mobile can filter. REMAINING: `lib/admin-tracking.ts` (fetch `/tracking/executives?date=`, `/tracking/route?userId=&date=`) + `app/(admin)/tracking.tsx` (MapView markers + selected-rep route polyline + rep list w/ live/last-ping + SE|Logistics|All filter + date + 60s poll) + a NATIVE rebuild (`expo run:android`).
- **P5 (Alerts feed + FCM) DONE (feed verified live; push code-complete):** REUSES `se_notifications` + the existing `/me/notifications` feed (no new table/routes — SA rows keyed by user_id, `requireAuth` gate works for SA). New `services/admin-notify.ts` `notifyAdmins(sql, {type,title,body,customerId?})` — inserts one feed row per active SUPER_ADMIN + `sendExpoPush` to their `push_tokens`. Send-on-write hooks (all `c.executionCtx.waitUntil`, guarded `!existing`): `routes/orders.ts` (admin_order), `collections.ts` (admin_collection, ₹+customer), `visits.ts` (admin_visit), `customers.ts` (admin_customer), `auth.ts` login (admin_login, only role SE/LOGISTICS). Mobile `app/(admin)/alerts.tsx` reuses `lib/invoice-notifications.ts` fetchNotifications/markNotificationRead → activity feed w/ per-type icon+tint (cart/cash/location/person-add/log-in), unread dots, tap→customer/[id]+markRead, pull-refresh. Feed verified live on emulator with 5 sample rows (inserted+deleted). NOTE: the FCM push landing on-device not yet triggered by a real event (reuses proven `sendExpoPush` + SA push-token auto-register on login); confirm by firing a real event (e.g. an SE login → SA gets push + feed row).

**ALL PHASES 0–5 BUILT + verified live on emulator (against local API 8787). PRODUCTION TODOs before shipping:** (1) `pnpm -C apps/api deploy` (attribution defaults, master dues endpoints, tracking `role`, admin-notify + 5 hooks, migr none-needed for P5 since it reuses se_notifications); (2) revert `apps/mobile/.env` EXPO_PUBLIC_API_URL → deployed API; (3) add release SHA-1 to the Maps Android key (+ decide shared vs dedicated Android Maps key — shared web key can't be restricted to both web-referrer AND Android); (4) commit; (5) EAS APK build.

**Home refinements (2026-08-18, mobile-only — NO API change, ship = commit + APK):**
- **KPI date-range picker:** SA Home KPIs are scoped to a custom from–to range (default IST today). Header chip (`Today` / `rangeLabel`) → centered `DateRangeSheet` modal (`components/date-range-sheet.tsx`). `lib/admin-dashboard.ts` `fetchDashboardMetrics(from,to)` → `/dashboard/metrics?from=&to=` (web endpoint already accepts the range). On Apply: `setMetrics(null)+setLoading(true)` so KPI cards shimmer immediately. Dues card is a live snapshot — deliberately NOT range-scoped.
- **CUSTOM calendar (replaced native picker):** new `components/calendar-range.tsx` `MonthCalendar` — hand-rolled single-month range calendar, NO dependency (dropped `@react-native-community/datetimepicker` from this screen; it's still used by `app/reminder/new.tsx` so the pkg stays). Tap start → tap later day sets end, span highlights (`bg-blue-100` track, rounded ends; endpoints `bg-primary` filled circles); tapping earlier restarts; tap after a full range starts fresh; single tap = 1-day range. ‹›month nav, future days disabled (`> maxDate`). ⚠ `bg-primary/10` was too faint for the range band → use solid `bg-blue-100`. Verified live: 5→15 Aug range band renders correctly + fetches.
- **KPI cards STYLED (were plain white/black):** each card now has a tinted round icon badge (top-right) — `KpiCard` takes `accent:{icon:IconName, fg, badge}`. Mapping: Active Executives people/blue-50, Visits location/violet-50, Productive Visits checkmark-circle/emerald-50, Sales–Oils water/amber-50, Bearings cog/slate-100, Collections cash/teal-50. Value text stays dark for readability.
- **BUG FIX — parallel load:** `AdminDuesCard` was nested INSIDE the `metrics ? (…)` render branch, so it couldn't mount (or start its fetch) until KPIs resolved → dues always appeared after. Moved it OUTSIDE the metrics gate (renders unconditionally below the KPI section) so its fetch fires on mount in parallel with the metrics fetch.

**SE leaderboard on SA Home (2026-08-18, ⚠ NEEDS API DEPLOY):** reused the EXISTING `components/leaderboard-card.tsx` (the SE Home peer-ranking card) verbatim on the SA Home, placed ABOVE `AdminFulfillmentCard` (order: KPIs → dues → **Leaderboard** → fulfillment). Identical look — horizontal ranked tiles, Today/Week/Month toggle (default Today), gold/silver/bronze medals + numbered circles, zero-sale SEs dropped; no "You" highlight (the SA's user id isn't among SEs, so `isMe` is always false). Works because `QueryClientProvider` wraps the whole app at root `_layout.tsx` (LeaderboardCard uses TanStack `useQuery`). **API change (must deploy):** `routes/leaderboard.ts` guard relaxed `["SALES_EXECUTIVE"]` → `["SALES_EXECUTIVE", "SUPER_ADMIN"]` (SUPER_ADMIN only, per user; MANAGER NOT added). The `oilLeaderboard(sql)` query already returns all SEs' today/week/month litres regardless of caller — only the route guard blocked SA. Verified live on local API (Month: Murali 2424.2L / Sandeep 1463.6L / Srikanth 437L / Upendar 286.6L; Today empty → "No oil sales yet today"). ⚠ Unlike the two cards below, this one is NOT mobile-only — ship = `pnpm -C apps/api deploy` (leaderboard route) + commit + APK.

**Office-created suppression + attribution E2E + Truck removal + search-cap bug (2026-08-18, ⚠ NEEDS API DEPLOY + migration 0064):**
- **Notification suppression:** `routes/orders.ts` + `routes/collections.ts` — wrapped BOTH `notifyOfficeWebPush` (web) and `notifyAdmins` (SA mobile) create-hooks in `if (auth.role === "SALES_EXECUTIVE")`. Office roles (SA/Manager/Accountant) creating an order/collection = data entry → no push/alert. Verified: SA-created ₹11 collection produced 0 `admin_collection` rows.
- **Attribution E2E (VERIFIED via mobile SA app):** SA (Vishnu Vardhan) recorded a ₹11 collection for RD Motors (CUST-0022, owned by SE Srikanth) → `collections.collected_by_user_id` = Srikanth, `created_by` = the SA. So office-created order/collection attributes to the customer's owning SE (`customerOwnerSE` default) while `created_by` keeps the real actor. Order half NOT completed on-device (see order-catalogue issue below); shares identical attribution + suppression code.
- **⚠ Customer SEARCH bug FIXED:** `services/customers.ts` `listCustomers` (mobile directory behind GET /customers) had `limit 200`. There are 299 customers; office roles see ALL, so the 99 oldest (e.g. RD Motors) dropped from the directory + client-side search. SE unaffected (scoped to own <200). Raised to `limit 5000`. Verified live (RD Motors now searchable). The paged/table endpoint is separate.
- **"Truck" oil segment REMOVED everywhere** (user: fold Truck sales → Commercial). Code: mobile `lib/performance.ts` OIL_SEGMENTS + `app/order/new.tsx` SEGMENT_ORDER; web `features/targets/targets-api.ts` OIL_SEGMENTS + `features/products/product-create-dialog.tsx` PRODUCT_SEGMENTS + `features/orders/orders-create-helpers.ts` SEGMENT_OPTIONS; api `services/products.ts` ALLOWED_SEGMENTS + `services/dashboard-analytics.ts` + `services/targets.ts`. (dashboard-nav.tsx `Truck` = lucide Logistics icon, kept.) Migration **0064_remove_truck_segment.sql**: order_items Truck→Commercial (1 row), se_segment_targets Truck merged into Commercial via upsert-sum (25 rows), product_segments delete (0). Updated dashboard-analytics.test.ts expectation. Typecheck (api+mobile) + dues/analytics tests pass.
- **✅ RESOLVED — New Order screen rewritten online-only (2026-08-18, mobile-only):** the catalogue-not-loading hang was in the offline SQLite-cache layer of the old 984-line `app/order/new.tsx`. Rewrote the whole flow ONLINE-ONLY (per user, for BOTH SA + SE — SEs lose offline order creation), split into **22 modules all ≤100 lines** (`lib/order/` types+api+hooks, `components/order/` presentational). Fetchers are plain `apiFetch` (no cache); submit POSTs `/orders` directly (no recordOrder/kickSync/queue), omits salesExecutiveId (server defaults to owning SE). **Full context-aware shimmer** (`CatalogueSkeleton`: search+tabs+chips+7 rows). **Lazy bearings** (`enabled: bearingsRequested`, staleTime Infinity — loads on first Bearings-tab tap, cached for session; both tabs always visible). **Credit in parallel** (no early gate; block only after credit resolves blocked). Kept shared `order-cache.ts` (used by Home/customer/ledger/collections/sync); only removed order-only `rememberPackSize`/`getRememberedPackSize` (pack memory now in-memory ref). Added `packLabel` as a real export in `lib/format.ts`. Typecheck clean, 20/20 order-cache tests pass. **VERIFIED LIVE on emulator:** shimmer → oils load (bug fixed) → Bearings tab lazy-loads (shimmer→data) → add 20W40 → submit → **ORD-0257** placed online. Segment chips show NO Truck. ⚠ mobile-only, ship = commit + APK.
- **✅ Order E2E COMPLETED:** ORD-0257 (SA-created) → `sales_executive_id`=Srikanth, `created_by`=SA, **0 admin notifications**. Both order + collection halves now proven. Cleanup (user runs): `delete from order_items where order_id=(select id from orders where order_code='ORD-0257'); delete from orders where order_code='ORD-0257';` (plus the COLL-0148 deletes above).
- ~~**⚠ DISCOVERED BUG (unresolved): the SA mobile ORDER-create screen never loads the product catalogue**~~ (RESOLVED by the online-only rewrite above) — perpetual `PickerRowSkeleton` across 2 fresh reloads. API is healthy (fast 401 on /orders/products, allows SUPER_ADMIN); `fetchProducts` in `app/order/new.tsx` is network-first (unchanged by me). Likely first-time-SA order path issue OR interaction with online-only (no catalogue prefetch) — but network-first should still fetch. NOT diagnosed. SA cannot create orders on mobile until fixed. Collections work fine.
- **Test-data cleanup (user must run — I'm read-only):** `delete from payment_proofs where collection_id='b2335df6-7d0a-46de-9aa0-2458ffb60a71'; delete from collections where id='b2335df6-7d0a-46de-9aa0-2458ffb60a71';` (COLL-0148, ₹11; was NOT verified so no invoice allocation to undo; orphaned R2 proof object is harmless).

**SA Settings screen — own online-only variant (2026-08-18, mobile-only):** `app/(admin)/settings.tsx` was a bare `export { default } from "../(tabs)/settings"` re-export, which showed SE-only offline surfaces. Replaced with a dedicated SA settings component that DROPS the offline/sync UI (the "Data & storage" App row, the "Sync / Sync now" card, and the red "N failed items / Retry all" inspector) — dead for online-only SA. Kept: profile card, Account (Edit profile / Change password → `/settings/profile`,`/settings/password`), Security (App lock toggle), App (Help & about → `/settings/about`), Log out (simplified confirm — no "N items not uploaded" warning since SA has no queue). Footer changed "Beyond SE · v…" → **"Beyond · v…"**. SE settings screen untouched. Verified live on emulator. Complements the online-only engine change below.

**HOME + ALERTS screens rewritten ONLINE-ONLY + ≤100-line modules (2026-08-18, mobile-only, both SA+SE):** Two parallel subagents (non-overlapping files). **Home:** SE Home `(tabs)/index.tsx` 282→54 (REMOVED the local "Today's activity" feed per user — Performance card already shows today's totals; removed getTodayActivity/getLocalDb/kickSync); SA Home `(admin)/index.tsx` 217→81. Cards online-only (dropped SQLite cache fallback + offline banner): `performance-card` 258→67 (`lib/performance.ts` `fetchMyPerformance`→`MyPerformance|null`), `dues-card` 142→63 (`lib/dues.ts` `fetchDuesSummary`→`DuesSummary|null`; NOTE `fetchDuesCustomers` left on cached networkFirst — `app/dues/[bucket].tsx` needs its CachedResult shape), `leaderboard-card` 146→78, `admin-dues-card` 118→54, `admin-fulfillment-card` 125→73. New modules under `components/home/` + `lib/use-day-tracking.ts`/`use-admin-dashboard.ts`. order-cache today fns KEPT (still used by order-cache.test.ts). **Alerts:** SE `(tabs)/alerts.tsx` 326→63, SA `(admin)/alerts.tsx` 124→83; removed all kickSync/useSyncStore (pull-refresh just refetches `fetchNotifications`); new modules under `components/alerts/` + `lib/alerts-format.ts`/`use-se-alerts.ts`. Kept ALL existing skeletons (user: "keep current skeletons"). Typecheck clean, every Home/Alerts file ≤100. VERIFIED LIVE (as SA): SA Home (KPI grid + dues + leaderboard + fulfillment all render + date picker) + SA Alerts (empty-state feed) work post-split. ⚠ SE Home (performance/dues cards, Today's-activity removal) + SE Alerts (3-segment toggle) are CODE-VERIFIED ONLY (logged in as SA; can't exercise SE screens). ⚠ mobile-only, ship = commit + APK.

**COLLECTION (record) screen rewritten ONLINE-ONLY + upload loading + tap-to-view + ≤100-line modules (2026-08-18, mobile-only, both SA+SE):** `app/collection/new.tsx` (was 343) → thin 84-line route + 12 modules (`lib/collection/{submit,use-collection-form,constants}.ts`, `components/collection/{type-toggle,amount-field,mode-chips,reference-field,proof-field,proof-viewer,record-button,confirmation}.tsx`). ONLINE-ONLY: removed recordCollection/kickSync/persistProofPhoto/getLocalCollectionsForCustomer/getLocalDb/order-cache. Submit (`lib/collection/submit.ts`): POST `/collections` (returns collection DIRECTLY as data → `res.id`/`res.collectionCode`, NOT wrapped) → `uploadCollectionProof(id, photo.uri, token, geo)` direct to R2. **Stable clientUuid** in a useRef (generated on first submit, reused on retry, reset on "Start another") → idempotent create so a failed-proof retry reuses the same collection. **Two-phase loading**: RecordButton shows spinner + status "Saving…"→"Uploading receipt…". **Tap-to-view**: ProofField thumbnail → full-screen `ProofViewer` Modal (expo-image contain, × close, tap-backdrop dismiss); "Proof attached · tap to view"; Remove kept. VERIFIED LIVE (SA→A1 AUTOMOBILE): tap-to-view shows stamped photo (addr+geo+time+user); Record → "Saving…" spinner (verified UNDER THROTTLE — locally the upload is too fast to see, works on real networks) → COLL-0148 ₹22 created online, collected_by=**Murali** (owning SE), created_by=SA, **has_proof=1** (R2 upload OK). Typecheck clean, all ≤100. ⚠ TEST DATA to clean up: `delete from payment_proofs where collection_id=(select id from collections where collection_code='COLL-0148'); delete from collections where collection_code='COLL-0148';` (₹22 A1 AUTOMOBILE — the earlier ₹11 COLL-0148 was already deleted, code reused). ⚠ mobile-only, ship = commit + APK.

**LEDGER screen rewritten ONLINE-ONLY + rows-only shimmer + ≤100-line modules (2026-08-18, mobile-only, both SA+SE):** `app/ledger/[id].tsx` (was 269) → thin 61-line route + modules: `lib/ledger-presets.ts` (PresetKey/PRESETS/ymd/presetRange, FY-starts-Apr), `lib/ledger-format.ts` (rupees/balanceLabel/fmtDate/ageLabel), `components/ledger/{ledger-header,range-presets,ledger-row,ledger-body}.tsx`. **Architecture (my rec):** ONE online fetch of the full ledger (`GET /customers/:id/ledger?from=2000-01-01&to=today`) + on-device `sliceLedger` per range preset (instant switching, NO cache — slicing is UX, not offline). `lib/ledger-fetch.ts` `fetchFullLedger` now returns `LedgerData` (no cache/fromCache). **Rows-only shimmer** (header + CLOSING BALANCE label + range chips stay; only tx rows shimmer via LedgerRowSkeleton; balance number gets a tiny Skeleton). **Dead code removed:** sync.ts `prefetchLedgers` (+consts/call/imports), order-cache.ts `cacheCustomerLedger`/`getCachedLedger` (zero callers), ledger.ts `FULL_LEDGER_KEY`. Preserved: presets, Dr/Cr closing, opening balance, FIFO paid/partial/unpaid age chips, totals footer. Typecheck clean, all ledger files ≤100. VERIFIED LIVE (SA): rows-only shimmer → A1 AUTOMOBILE loads online (₹5,310 Dr, SALE row 7d·Unpaid, totals). NOTE: throttling DURING a Metro reload can drop the dev app to the Expo-Go/launcher (bundle-fetch timeout) — relaunch via `adb shell monkey -p com.vardhansystems.sriaparajita`; not a code bug. ⚠ mobile-only, ship = commit + APK.

**Customer DETAIL screen rewritten ONLINE-ONLY + full shimmer + ≤100-line modules (2026-08-18, mobile-only, both SA+SE):** `app/customer/[id].tsx` (was 843 lines) → thin 100-line route + 14 modules (`lib/customer/{types,queries,checkin,use-photos}.ts`, `components/customer/{top-bar,hero-card,check-in-button,action-row,orders-section,collections-section,photos-section,photo-capture-sheet,section-bits,customer-skeleton}.tsx`). FULLY online: header via `GET /customers/:id` (replaces the local `customers`-table read; also gives geofence lat/lng), balance via `GET /customers/:id/invoices`, last-5 orders/collections online (cache fallback stripped), photos online. REMOVED all `getLocalDb`/`order-cache`/`ensureTodayVisit`/`kickSync`/`fetchFullLedger`/`getCached*`, the offline banner + "Queued — syncing" rows. **Check-in → online** (`POST /visits/checkin` directly; geofence from online lat/lng; self-heal PATCH online): uses a **DETERMINISTIC clientUuid** = SHA256(`${userId}:${customerId}:${todayIso}`)→UUID so a same-day re-check-in is idempotent — CONFIRMED safe: `visits.ts` returns existing-by-client_uuid + DB partial-unique index `visits_client_uuid_unique` (migr 0009). ⚠ `visitedToday` is now SESSION-ONLY (no online "did I visit today" source → button reads "Check in" again after reload; the deterministic id prevents dup visits). SA hiding (Check-in + Market Intelligence) preserved. Full context-aware shimmer (`CustomerSkeleton`: hero + 4-button row + both Last-5 sections). Typecheck clean, all files ≤100. VERIFIED LIVE (as SA): shimmer→A1 AUTOMOBILE loads online (addr/phone/balance ₹5,310/ORD-0215). ⚠ SE check-in path is CODE-VERIFIED ONLY (hidden for SA — needs a real SE field test). ⚠ mobile-only, ship = commit + APK.

**Customers list shimmer → ROWS-ONLY (2026-08-18):** reverted the Customers-tab shimmer from whole-chrome to rows-only per user — `components/customers/customers-skeleton.tsx` now renders just ~10 `ContactRowSkeleton`; `(tabs)/customers.tsx` renders the REAL `SearchHeader` during load (inlined the isPending state into the main return to stay ≤100 lines → 97). Verified live: real search bar stays, only rows shimmer.

**Customers screen rewritten ONLINE-ONLY + full shimmer + ≤100-line modules (2026-08-18, mobile-only, both SA+SE):** `app/(tabs)/customers.tsx` (was 293 lines) → thin 100-line route + new modules: `lib/customers/avatar.ts`, `lib/customers/directory-rows.ts` (flatten+offsets for A–Z jump), `components/customers/{customer-row,az-index,search-header,customers-skeleton}.tsx`. **Online-only:** `lib/customer-directory.ts` `fetchSeCustomers` now returns `DirectoryCustomer[]` (pure `apiFetch`, NO SQLite cache/fromCache); updated `app/reminder/new.tsx` caller; REMOVED `prefetchCustomers` + its consts/call/import from `lib/sync.ts`. Dropped the "Offline — showing cached customers" banner + `kickSync` in pull-refresh. **Architecture (my rec, user delegated):** load full directory in ONE online fetch + FlatList virtualization (the real "lazy loading" — A–Z jump needs the whole set so no data-pagination) + instant client-side search (name/phone/code/city). **Full context-aware shimmer** (`CustomersSkeleton`: search-bar + 10 ContactRowSkeleton + A–Z rail dots). Preserved A–Z contacts UX (sticky headers, index rail jump via getItemLayout/scrollToOffset, initials avatars). NOTE: shared local SQLite `customers` table KEPT — still used by beat-cache/delivery-cache/customer-[id] (only the directory stopped using it). Typecheck clean, all files ≤100. VERIFIED LIVE: shimmer (search+rows+rail) → full A–Z list loads → "RD Motors" search works. ⚠ mobile-only, ship = commit + APK. Same online-only pattern as the New Order rewrite above.

**SA is now truly ONLINE-ONLY — killed the sync engine for SA (2026-08-18, mobile-only):** the "online-only" decision was never enforced in code — `_layout.tsx` called `startSyncEngine()` for ANY logged-in token, so an SA session ran the SE offline machinery (3-min heartbeat timer + `kickSync` bulk prefetch: `/orders/recent-bulk`, bulk `/collections`, bulk ledgers/customers + network/appstate listeners). User saw continuous heartbeat + bulk APIs in the background. Fix (SA-only; SE/Logistics keep full offline): (1) `lib/sync.ts` — stored the Network + AppState subscriptions in module vars and added **`stopSyncEngine()`** (clears `heartbeatTimer`, removes both listeners, resets `started`/`wasConnected`; idempotent). (2) `_layout.tsx` effect — `if (token) { if (isAdmin) stopSyncEngine(); else startSyncEngine(); }` (added `isAdmin` to deps). stopSyncEngine (not just skipping start) also tears down an engine already running from a prior SE session on a shared device. (3) `lib/use-location-guard.ts` — early-return in the effect for non-field roles so SA runs NO idle-recheck timer / AppState listener either (it did no network for SA anyway, but removes the perpetual 12s loop). Kept push-token registration for SA (admin Alerts need it). No screen calls prefetch/bulk directly — the engine was the only trigger, so this removes ALL SA background traffic. Verified: typecheck + 43 sync/guard/heartbeat tests pass; SA app reloads + works; logcat after reload shows zero sync/bulk/heartbeat/gps chatter. Relates to [[project-shared-account-logout-bug]]. ⚠ mobile-only (no API change) → ship = commit + APK.

**SA dues SCREEN full shimmer (2026-08-18, mobile-only):** `app/(admin)/dues.tsx` had ugly loading placeholders — bucket tiles showed "·" dots + empty amounts, and the SE filter chips popped in. Made it context-aware (SA screen only per user; the SE Home `dues-card.tsx` + SE bucket `dues/[bucket].tsx` already had skeletons, left untouched). (1) **Bucket tiles** ("buckets collections"): count + ₹ now shimmer via `{loading ? <Skeleton/> : <Text/>}`, day-labels (0–30d…) stay visible (same numbers-only principle as the KPI/dues-card task). (2) **Filter chips**: added `execsLoading` state (set false in `.finally()` of `fetchSalesExecutives`); while `execsLoading && execs.length===0`, render 4 rounded shimmer placeholder chips (widths 46/62/40/54) after the always-real "All executives" chip. (3) **Customer list skeleton**: upgraded from 4 flat rows → 6 rows mirroring the real row (name left + outstanding right on top, exec·age subline below). Verified live (throttled): chip placeholders + 6-row list skeleton captured; bucket-tile shimmer is code-correct but the summary query resolves faster than execs/customers so it's a sub-second window (buckets showed real numbers while chips+list still shimmered).

**Shimmer scope fix — only server data shimmers (2026-08-18, mobile-only):** the SA-Home KPI cards + `AdminDuesCard` previously replaced the WHOLE card with a skeleton while loading (shimmering static labels/icons/day-labels too). Reworked so the static chrome renders immediately and only server numbers shimmer. **KPI cards (`(admin)/index.tsx`):** dropped the separate `CardSkeleton`/loading-branch; `KpiCard` now takes `value?: string` (undefined→shimmers) + `subDynamic` (count-bearing subline like "8 orders"→shimmers; purely-static sublines "live now"/"customer check-ins"/"order or collection" always shown). Labels + tinted icon badges always render. Built one `kpiRows` fragment fed from `metrics` via optional chaining (values undefined while loading); rendered plain when loaded, wrapped in a single `SkeletonTheme` while `!metrics`. **Dues card (`admin-dues-card.tsx`):** removed the early-return full-skeleton; title / "outstanding" word / bucket day-labels (0–30d…60d+) always render; only ₹ total, customer count, and per-bucket count+₹ shimmer (fixed `BUCKETS` list drives the strip so day-labels show even with no data); one shared `SkeletonTheme` wraps the data region while `!summary`; added a `failed` guard (fetch error → hide card, don't shimmer forever). **Text change:** dues card "view all ›" → **"Tap to view all ›"**. Verified live (throttled reload): KPI labels/icons/static-sublines + dues title/"outstanding"/day-labels all solid, only numbers sweep. NOTE: the Leaderboard + Fulfillment cards keep their own full skeletons (out of scope; user named only KPI + dues).

**Order-fulfillment card (2026-08-18, mobile-only — NO API change):** new `components/admin-fulfillment-card.tsx` on SA Home, rendered BELOW `AdminDuesCard`. Self-fetching (own skeleton, loads in parallel) via `lib/admin-fulfillment.ts` `fetchFulfillmentSummary()` → reuses the EXISTING deployed `GET /orders/fulfillment-summary` (roles incl SUPER_ADMIN; **all-time snapshot, NO date range / NO SE filter** — deliberately NOT tied to the KPI range, like the dues card). Mirrors the web `features/orders/orders-fulfillment-summary.tsx`: 7 stages grouped IN PROGRESS (Ordered, Partial inv., Invoiced, Partial del.) · COMPLETED (Delivered, emphasized) · RETURNS (Partial ret., Returned); soft-tinted tiles with a coloured `border-l-4` accent + per-stage palette; **zero-count stages hidden** (whole group drops if empty; card renders null if no orders). Display-only (no drill-down — no SA orders-list screen yet). Groups stacked vertically w/ light `border-t border-border` divider between (⚠ NativeWind `/70` opacity on border color didn't take → use plain `border-border`). Verified live on emulator (43/3/11 · 176 · 2/5, matching the user's ref screenshot).

**LOCAL-API dev setup (2026-08-17, for verifying unshipped API changes on the emulator):** `apps/mobile/.env` `EXPO_PUBLIC_API_URL=http://10.0.2.2:8787/api/v1` (10.0.2.2 = host loopback from Android emulator). Run local API: `pnpm -C apps/api dev` (wrangler dev on 8787; **its JWT_SECRET comes from the ROOT `.env` via `--env-file ../../.env`, NOT apps/api/.dev.vars** — that root secret == prod, so the app's existing token verifies, no re-login). Restart Metro after the .env change (`expo start --clear`) + relaunch. Verified P3 dues live this way (₹25,58,049.82 · 115 customers; 72/23/6/14 buckets; SE-filter chips; per-customer owning-SE+age). NOTE: revert `EXPO_PUBLIC_API_URL` to the deployed URL before building a shippable APK.

**Running the local dev build (verified working):** emulator `Pixel_8` (`emulator-5554`); `~/Library/Android/sdk/emulator/emulator -avd Pixel_8`. Java NOT on PATH → use Android Studio's JDK: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` + `ANDROID_HOME="$HOME/Library/Android/sdk"`, then `pnpm exec expo run:android` (first Gradle build ~4 min; installs `com.vardhansystems.sriaparajita` + starts Metro). JS edits hot-reload; screenshot via `adb exec-out screencap -p`. See [[project-mobile-rebuild]].

---

## project-neworder-redesign.md

---
name: project-neworder-redesign
description: "SE New Order flow redesigned clean-minimal (2026-07-16): flat list + tabs, bottom-sheet add, typed quantities, editable review cart; user's design taste notes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6831a0d1-b09d-47d7-beb9-a3f42b9d09d3
---

**New Order flow redesign (approved + built 2026-07-16):** `apps/mobile/src/app/order/new.tsx` fully rewritten to a **clean & minimal** style after two rejected directions. Same 3 steps (Pick → Review → Done). Mockups artifact: claude.ai/code/artifact/31fdb064-b0dc-45f9-9af2-edd74bd44922.

**User's design taste (learned through rejections — apply to future mobile UI):**
- Rejected "colored stripes/pills/badges" as **childish/toy-like**; rejected a 2-column tile grid (long names don't fit).
- Wants **clean & minimal**: white, flat, hairline dividers, ONE accent color (Google-style), text buttons over solid chips, Material-style underline tabs.
- Bearings: **only quantities on screen** — no pieces math, no MOQ steps shown in the SE app.

**What the screen is now:** flat single-column FlatList rows (name + segment subtext, blue "Add" text button; added rows show "2 × 1 L / in order" in blue), grey pill search + Oils|Bearings underline tabs (bearings tab hidden when catalogue empty) + flat outline segment chips (oils only), "Cart · N" text link in header → Review. Tapping a row opens a **bottom sheet** (RN Modal, slide): pack-size chip grid + Custom, segment chips when multi-segment, **typed quantity field** (underlined TextInput, selectTextOnFocus) with round −/＋; bearing sheet = part no + quantity only (+ Update/Remove when already in cart). **Review = editable cart**: every line has compact typed qty + ✕, sections OILS/BEARINGS, flat text totals, Submit disabled while any qty invalid. Done screen: thin green check ring, code, "Start another order". Android back button closes the sheet (Modal onRequestClose).

**Supporting pieces:** local schema **v11** (`pack_memory` table) + `rememberPackSize/getRememberedPackSize` in order-cache.ts — the sheet pre-selects each product's last-used pack size. Bearing cart state holds the entered quantity and submits it as `quantityUnits` (server snapshots MOQ; see [[project-bearings]]).

**Web alignment:** order-dialog bearing rows = plain qty (default 1, ±1 steppers, integer≥1 validation, no multiple-of-MOQ hints); "Qty" header (no pcs); order detail shows the entered quantity without units.

**Verified live 2026-07-16** on emulator (typed qty 12, bearing qty 3, review edit 12→11, submit → server rows correct incl. bearing_moq=10 snapshot) and web dialog. 246 API + 60 mobile tests green. Test order cleaned. NOT committed, NOT deployed, not in any APK.

---

## project-offline-cache-ledger-customer.md

---
name: project-offline-cache-ledger-customer
description: "Offline read-cache for mobile ledger + customer detail: cachedFetch over performance_cache, instant-cache+revalidate, Offline banner"
metadata: 
  node_type: memory
  type: project
  originSessionId: 81771ad0-d42b-4b51-a8ef-ce7de64a6ce9
  modified: 2026-08-22T18:22:20.301Z
---

2026-08-22: Fixed the offline-caching gaps found in [[project-mobile-stress-findings]] for the SE mobile app's **ledger** and **customer-detail** screens (were online-only → bare "Couldn't load" offline; balance showed ₹0). VERIFIED live on emulator (debug build vs localhost:8787 worker, before/after screenshots): offline now shows cached statement/balance/orders/collections + a subtle "Offline — showing last synced data" banner; reconnect clears it. UNCOMMITTED. tsc clean, 208 tests pass (7 new).

**Architecture (chosen: instant-cache + revalidate):**
- NEW `src/lib/offline-cache.ts` — generic read cache over the existing `performance_cache` SQLite table (id/payload_json/cached_at): `cachedFetch(id, fetcher)` (network-first, writes on success, returns cached copy with `fromCache:true` on failure, throws only when no cache), `readCache`/`writeCache` (sync), `cachedInitial`/`cachedUpdatedAt` (seed React Query `initialData`/`initialDataUpdatedAt` so cache paints INSTANTLY then revalidates; initialData is fromCache:false so the banner never flashes online). Tests: `offline-cache.test.ts`.
- NEW `src/components/offline-banner.tsx` — subtle muted strip (cloud-offline icon + "Offline — showing last synced data").
- Ledger: `ledger-fetch.ts` adds `fetchFullLedgerCached` + `ledgerCacheId`; `app/ledger/[id].tsx` uses it, unwraps `query.data.data`, shows banner on `fromCache`.
- Customer detail: `lib/customer/queries.ts` wraps all 4 reads (header, credit, orders, collections) in cachedFetch+initialData; **removed fetchCredit's internal try/catch** (it swallowed errors → ₹0 balance; now falls back to cached credit). Screen (`app/customer/[id].tsx`) unwraps header/credit and shows one screen-level banner via `offline` flag. Sections `orders-section.tsx`/`collections-section.tsx` now take `UseQueryResult<Cached<T>>` and read `query.data?.data`.
- Photos deliberately NOT cached (data-only scope) — MI still shows its offline state.
- DRY: refactored `dues.ts` to reuse `cachedFetch` (dropped its duplicated private networkFirst).

**Test-env note:** release build CAN'T hit http://localhost (cleartext blocked by targetSdk 36); used a DEBUG build for localhost testing. `apps/mobile/.env` was temporarily pointed at localhost:8787 then RESTORED to prod. Offline was simulated via `adb reverse --remove tcp:8787` (app reaches API through adb reverse, not the emulated radio, so airplane mode wouldn't cut it). Emulator currently runs the DEBUG build logged in via localhost worker.

**Also spotted (unrelated, real):** logged in as vishnuvardhan@vardhansystems.in (login/profile name "Vishnu Vardhan Vankayalapati") but Home greeting + leaderboard "You" show **"Sandeep"** — name-source mismatch worth a look.

---

## project-offline-ledger-bulk.md

---
name: project-offline-ledger-bulk
description: Offline ledger via a bulk endpoint + on-device date-range slicing (Phase 1 of offline-first caching)
metadata: 
  node_type: memory
  type: project
  originSessionId: d04e0a17-7ca2-43db-8983-8f8516c376c6
  modified: 2026-08-09T16:08:16.583Z
---

**2026-08-09** — Making the SE app fully offline. Decided the correct architecture is **bulk endpoints + server-computed ledger + on-device slicing** (NOT the per-customer N+1 prefetch pattern the orders cache uses). User approved "go with your recommendation."

**Phase 1 — offline ledger: API DEPLOYED + FULL-OFFLINE VERIFIED on emulator 2026-08-09** (airplane mode: bulk prefetch cached all 119 ledgers → Data screen "Ledgers" 119; opened Abhiram Motors — a NEVER-opened customer — offline: closing ₹20,850 Dr matches web, Last-3-months slice with "31 d · Partially paid" FIFO ageing all computed on-device). Customers list + customer detail (orders/collections) also offline. NOT committed; needs new APK.

Build (all tests pass, tsc clean):**
- **API** `apps/api/src/services/customers.ts`: extracted the ledger assembly (merge → running balance → FIFO payoff → partiallyPaid) into a pure `assembleLedger()` shared by BOTH `getCustomerLedger` (unchanged behaviour, single/range) and the new **`getCustomerLedgersBulk(sql, context)`** — returns the FULL (all-time, from 2000-01-01, opening 0) ledger for EVERY visible customer in ~4 set-based queries (no per-customer round-trip); SE-scoped like `assertCustomerVisible`. Route `GET /customers/ledgers/bulk` (static path registered BEFORE `/:id/ledger`), roles SUPER_ADMIN/MANAGER/ACCOUNTANT/SALES_EXECUTIVE. Also exported `LedgerData` type.
- **Mobile** pure `lib/ledger.ts`: `LedgerRow`/`LedgerData` types, `FULL_LEDGER_KEY="full"`, and `sliceLedger(full, from, to)` (TDD'd `ledger.test.ts`, 4 tests) — cumulative row balances stay valid; only opening/closing/totals recomputed per window.
- **Mobile** ledger screen `app/ledger/[id].tsx`: now fetches the FULL ledger ONCE (`/customers/:id/ledger?from=2000-01-01&to=today`, cached under "full"), and slices to the selected preset **on-device** — preset switching is instant + offline; no per-range calls.
- **Mobile** `lib/sync.ts`: `prefetchLedgers()` calls `/customers/ledgers/bulk` once per sync (10-min throttle) and caches every customer's full ledger under "full" → ledgers work offline even for customers never opened.
- **Mobile** Data & storage screen: removed the "This data lets the app work with no internet" caption; relabeled Products → **"Products (oils)"**; added **Bearings** and **Ledgers** rows (`cache-admin.ts` CacheStats + clearReadCaches now also wipes `bearings` + `cached_ledger`).

Verified live (emulator, against DEPLOYED single endpoint): ledger full-fetch + local slice correct (A1 Honda: Last-3-months opening ₹0, 15-Jun sale ₹6,640 "18 d" paid, 3-Jul receipts, closing ₹640 Cr); Data screen shows Products(oils) 64 / Bearings 1834 / Ledgers count. Bulk SQL validated vs DB (Sandeep: 119 cust → 82 inv, 56 coll, 1 return). **Remaining: deploy API** → bulk prefetch populates all ~119 ledgers on sync (Ledgers count jumps to ~119, full offline). Then new APK.

**Phase 2 — bulk orders: API DEPLOYED + VERIFIED live 2026-08-09** (Clear cached data → orders 0, then Refresh repopulated to 85 via `/orders/recent-bulk`; a clean relaunch/fresh-login refilled the WHOLE cache in ~7 bulk calls: customers 119 / orders 85 / collections 41 / products 64 / bearings 1834 / ledgers 119). NOT committed; needs new APK.

Build (tsc+tests green [421 api/119 mobile]):** replaced the 119-call `prefetchCustomerOrders` N+1 with ONE windowed query. API `orders.ts` `listRecentOrdersByCustomerBulk(sql, ctx, perCustomer=5)` reuses the `ORDER_LIST_COLUMNS`/`ORDER_FROM` fragments + `row_number() over (partition by o.customer_id order by o.created_at desc) <= 5`, scoped to the SE's own customers (`created_by`). Route `GET /orders/recent-bulk` (SALES_EXECUTIVE only, static before `/:id`) → `{ orders: [...] }` each carrying `customerId`. Mobile `sync.ts prefetchCustomerOrders` now makes the single bulk call, groups by customerId, `cacheCustomerOrders` per group (same 10-min throttle). Window logic validated vs DB (Sandeep → 85, matches). **Needs API deploy to verify live.** After deploy the login sync is ~7 total calls (customers/collections/products/bearings/ledgers-bulk/orders-bulk/tasks) regardless of customer count, down from ~123-240.

**Phase 3 — delta + fold customers: API DEPLOYED + VERIFIED e2e 2026-08-09** (emulator, via `run-as … sqlite3 beyond.db`): cold pull → 119 cust/85 ord/64 prod/1834 bear/119 ledg + cursors set to server `serverTime` (cursor_orders/cursor_ledgers persisted — proves the round-trip); relaunch → DELTA sync (since=cursor) → cursors ADVANCED (14:19→14:23) while counts STAYED 119/85 (delta upsert didn't wipe unchanged = key correctness signal); Clear → sync_meta=0 + caches 0; force Refresh → full re-pull refilled all + re-set cursors (ledger pull is the slow one, ~30-40s); offline (airplane) → customers list + never-opened customer's ledger load with "Offline · last synced". Two fixes found during test: `clearReadCaches` now also wipes `sync_meta` (else post-Clear delta wouldn't refill), and Data-screen Clear now calls `kickSync(true)` (force — throttle otherwise blocks the post-Clear refill). STILL NOT committed; needs new APK.

Build (tsc+tests green [421 api/119 mobile]):**
- **Customer-scoped delta on the two heavy bulk endpoints.** `getCustomerLedgersBulk(sql, ctx, since?)` and `listRecentOrdersByCustomerBulk(sql, ctx, perCustomer, since?)` now accept `?since=` and return `serverTime` (server's own clock → client stores as next cursor, NO clock skew). On a delta pull they rebuild ONLY customers whose ledger/order-fulfillment changed since the cursor (detected via greatest(created_at,updated_at) on invoices/collections/orders + created_at on sales_returns/delivery_run_stops/invoice_line_allocations; ledger uses `= any(ids::uuid[])`). Full recompute per changed customer → removals correct. Routes pass `since`. Validated vs DB: changed-customers since now()=0, since epoch = 41 (ledger) / 46 (orders).
- **Mobile delta**: `sync_meta(key,value)` cursor table (local-db v18, wiped on logout); `getSyncMeta/setSyncMeta` in order-cache. `prefetchLedgers`/`prefetchCustomerOrders` pass `since=cursor` (unless force), UPSERT only returned customers (unchanged keep cache), advance cursor to `serverTime`.
- **Folded customers into the sync loop**: new `prefetchCustomers` (full replace-all via `fetchSeCustomers`, 10-min throttle) so customers cache at login regardless of first tab.
- **Force-full**: `kickSync(force=false)` threads `force` → all prefetches bypass throttle + cursors (full re-pull). Data screen "Refresh all data" now calls `kickSync(true)`. Catalogues (products/bearings) stay full replace-all (small; row-delta can't detect status='active' removals).
- **Needs API deploy to verify delta live.** Post-deploy check: Refresh(force)→ledgers 119/orders 85; then a normal (delta) sync must KEEP 119/85 (upsert didn't wipe unchanged) — the key correctness signal.

**Pull-to-refresh fixes (2026-08-09, mobile-only, no API deploy needed; tsc+119 tests green; NOT committed):** the **ledger screen had NO pull-to-refresh** — added `RefreshControl` → `query.refetch()`, VERIFIED live (cached_ledger cached_at advanced 19:57→20:35 = refetch + re-cache of the offline "full" ledger). Extracted `fetchFullLedger` into shared `lib/ledger-fetch.ts`. Customer-page pull now also calls `fetchFullLedger(id, token)` (targeted single-customer ledger-cache refresh, deliberately NOT a heavy full force-sync). Home pull re-reads "Today's activity" + stats AGAIN after `kickSync()` finishes. Diagnosis first proved customer-page pull already worked (cached_orders cached_at advanced on a pull) — real gaps were only the ledger screen + Home activity being local-only.

**Foreground-resume staleness fix (2026-08-09, mobile-only; tsc+119 tests green; NOT committed):** user reported on the field APK that only a FULL app kill+reopen got latest data, not a background→resume. Root cause: prefetch throttles (`lastXPrefetchAt` module vars) survive backgrounding, reset only on a full restart → on resume, `AppState "active"` → `kickSyncNow` → `kickSync()` (non-force) → prefetches SKIP (still inside 10-30 min window). Fix: added a `bypassThrottle` param — `kickSync(force=false, bypassThrottle=false)`; `kickSyncNow` (foreground + reconnect) now calls `kickSync(false, true)` → prefetches bypass the time throttle but KEEP the delta cursor (cheap changed-only pull). Catalogue (near-static, 1800+ bearings) deliberately stays throttled even on foreground (only force bypasses it). NOT live-verified (emulator lost auth on reboot; can't enter password to re-login). **The vc6 APK that finished building does NOT include this fix — needs commit + a fresh build.**

See [[project-mobile-offline-vision]], [[project-ledger-fifo-unpaid]], [[project-ledger-edit]].

---

## project-optional-mop.md

---
name: project-optional-mop
description: MOP is now optional in the price master — a product/pack can carry just an MRP
metadata: 
  node_type: memory
  type: project
  originSessionId: b77e2608-e1f9-4c8e-bf9c-0fa0ce0fbaef
  modified: 2026-08-08T12:45:39.389Z
---

**2026-08-08** — "Fix A": **MOP (selling price) is now optional** per product×pack; **MRP is the required field** for a price row. Lets you update MRP / create products with just an MRP (MOP added later) — previously the create/update path silently DROPPED any pack that didn't have BOTH MRP and MOP (schema had both `NOT NULL`), so MRP-only entries vanished.

Changes: migration **`0057_optional_mop.sql`** (`alter table product_pack_prices alter column mop drop not null`); `product-packs.ts` `packWriteArrays` now writes a price row when **MRP is present** (MOP kept as null if unset) — TDD'd in `product-packs.test.ts`; `products.ts` create/update inserts `pricedMops` as `(number|null)[]`. **Invoicing guard:** `invoicing/generate-data.ts` + `manual-data.ts` filter out null-MOP rows from `priceByKey`, so an MRP-only pack is treated as **unpriced** (the existing 409 "No price set … add it in the price master") — never invoiced at ₹0. Web catalogue pill (`products-columns.tsx`) now shows `MRP ₹…` in amber when a pack has MRP but no MOP (else `₹MOP` in primary).

**Deploy note:** migration 0057 must be applied to the DB BEFORE the API deploy — otherwise saving an MRP-only pack hits the old `mop NOT NULL` and the whole product save fails. BUILT, tsc (api+web) + 421 API tests pass; NOT committed. This is the prerequisite for the deferred bulk MRP price-list import [[project-mrp-not-reflected]] pattern. Related: [[project-invoicing-build]].

---

## project-order-fulfillment-status.md

---
name: project-order-fulfillment-status
description: "Stored orders.fulfillment_status (migration 0074) — 8-stage ladder persisted from the live FULFILLMENT_CASE, backfilled, recomputed on every order/invoice/delivery/return change via services/fulfillment.ts."
metadata: 
  node_type: memory
  type: project
  originSessionId: 749d7190-55d2-4eb5-aaf4-045985026923
  modified: 2026-09-09T18:19:02.965Z
---

**2026-09-09.** Added a STORED `orders.fulfillment_status` (migration **0074_order_fulfillment_status.sql**) — previously the ladder was only computed live in `apps/api/src/services/orders.ts` `FULFILLMENT_CASE`. Goal: give the dashboard/reports one authoritative stage per order (the trigger was redefining dashboard "Sold Oil" as delivered-based — that's a SEPARATE follow-up, not done yet).

**8 stages** (one per order, check-constrained): `ordered → partially_invoiced → invoiced → partially_delivered → delivered`, plus `partially_returned` / `returned` (returns take precedence) and `cancelled`.

**Derivation (identical in THREE places — keep in sync):** migration 0074 backfill, `services/fulfillment.ts` `recomputeOrdersFulfillment`, and `orders.ts` `FULFILLMENT_CASE` (live display). Ground truth: `invoices` (approval_status<>'rejected') + `delivery_run_stops` (delivered = invoice is on a stop) + per-SKU `invoice_line_allocations` (fully_invoiced) + `sales_return_items`. delivered vs invoiced comes from delivery_run_stops, NOT invoice coverage (user chose "persist existing ladder" over the invoice-coverage option).

**Upkeep:** `services/fulfillment.ts` exports `recomputeOrderFulfillment(orderId)` / `recomputeOrdersFulfillment(ids[])` / `recomputeFulfillmentForInvoice(invoiceId)` / `recomputeFulfillmentForSalesReturn(returnId)`. Wired (recompute after the write, mirrors `recomputeCustomerBalances`) into: orders.ts createOrder/updateOrder/cancelOrder; invoices.ts createInvoice/updateInvoice; invoicing/commit.ts commitGeneratedInvoice; deliveries.ts addStop; sales-returns.ts createSalesReturn/updateSalesReturn. Does NOT bump orders.updated_at (derived-field refresh; avoids sync churn). No invoice reject/delete or delivery-stop delete paths exist, so none to wire. manual-generate.ts (walk-in, no order_id) is intentionally not wired.

**Backfill result on prod (371 orders, validated via read replica before applying):** delivered 264 · ordered 35 · cancelled 28 · partially_delivered 16 · invoiced 11 · returned 11 · partially_returned 6. `partially_invoiced` = 0 currently (partial invoices here are already on delivery runs → partially_delivered) but is a valid future stage.

**Data reality that drove design:** orders have NO delivered/fulfilled status column (order_status is only approved/cancelled; approval_status all approved; orders.invoice_id column exists but is EMPTY — the link is invoices.order_id). delivery_runs.status is only active/ended. So "delivered" can only come from invoices + delivery_run_stops, never an order flag.

**STATUS:** code complete, apps/api tsc clean. **Migration 0074 APPLIED to prod 2026-09-09** (via `psql "$DATABASE_URL" --single-transaction -f …0074…` — root .env DATABASE_URL is the WRITABLE prod primary = neondb; the MCP run_sql tool is only a read replica). Backfill = UPDATE 371, 0 nulls, verified distribution (delivered 264/ordered 35/cancelled 28/partially_delivered 16/invoiced 11/returned 11/partially_returned 6). Orders page still computes live (unchanged, zero drift risk). REMAINING: **deploy apps/api** so the recompute wiring runs on future writes ([[project-local-web-uses-deployed-api]]); then follow-up: switch dashboard Sold Oil to delivered-based using this column. See [[project-fulfillment-pending]], [[project-invoicing-build]], [[project-dues-ledger-truth]].

**SOLD OIL FOLLOW-UP DONE (2026-09-09):** dashboard "Sold Oil" (metric key `litres`) switched from order-based to DELIVERED-based. Formula = Σ delivered invoices' oil litres (`invoices.total_litres`, approval_status<>'rejected', invoice is on a `delivery_run_stops`) MINUS oil sale-returns on those invoices (sales_returns→sales_return_items kind='oil'). Scoped by `invoice_date`; per-exec via `coalesce(invoice.sales_executive_id, order.sales_executive_id)`. New query `metrics_delivered` in dashboard-metrics.ts + rewrote the `litres` agent + customer drill-down branches (invoice-based; `bearings` split into its own now-order-based `agents_bearings`/`agent_customer_bearings`; `metrics_sales` trimmed to bearings-only → renamed `metrics_bearings`). Card subline "N deliveries · net of returns"; customer rows show the invoice number + "− Xreturned"/"delivered". Total Ordered Oils (metric `ordered`) unchanged (gross order-based). Validated on prod replica: all-time Sold Oil 15,212.2 L net (15,934.2 delivered − 722 returns, 304 deliveries); Aug-2026 6,329.3 L (148 deliveries). web+api tsc + lint clean. UNCOMMITTED (fulfillment column work was committed by user earlier; this Sold Oil change is on top). Needs api+web deploy.

**NOTE (capability):** I DO have writable prod DB access via `psql` + root `.env` DATABASE_URL (Homebrew psql 18). Prod schema migrations / backfills can be run directly when the user authorizes — apply with `--single-transaction -v ON_ERROR_STOP=1`. Never print the DATABASE_URL value.

---

## project-order-short-close.md

---
name: project-order-short-close
description: Cancelling a partially-invoiced order short-closes the un-invoiced remainder (partially_cancelled) instead of voiding the whole order
metadata: 
  node_type: memory
  type: project
  originSessionId: 211f3923-e8c9-4907-91f9-66b5620e4a50
  modified: 2026-09-11T07:40:53.645Z
---

2026-09-10: **Short-close on cancel.** Cancelling an order now branches by invoiced coverage (same Cancel button):
- nothing invoiced → full void (`order_status='cancelled'`), as before.
- partially invoiced (remaining = ordered − invoiced > 0) → **short-close**: shrink each `order_items.quantity_units` to the invoiced amount, bank the remainder in new `order_items.cancelled_units`, recompute header `total_litres` + `estimated_line_value`. New fulfillment stage **`partially_cancelled`** (REPLACES the badge; sits right after `cancelled` in FULFILLMENT_CASE, above returns).
- fully invoiced (remaining = 0) → **blocked** 409 "nothing left to cancel" (fixes old foot-gun). Cancel menu item also disabled client-side.

Decisions (user, don't re-litigate): **invoiced = filled** (delivered or not, invoiced stays); only never-invoiced qty is cancelled. Fully-invoiced-but-undelivered `partially_delivered` orders are **blocked**. **No side effects** — no stock restock, no dues change (remainder was never billed/dispatched).

UI: detail Line Items shows ORIGINAL ordered (`quantityUnits + cancelledUnits`) in Qty/Total + a purple **Cancelled** column; purple banner + timeline row; funnel summary has a `partiallyCancelled` bucket. Purple palette (`bg-purple-50 text-purple-700`) distinct from red cancelled / rose returned.

Derivation: FULFILLMENT_CASE detects short-close via `bool_or(oi.cancelled_units>0) as short_closed` added to every `skuinv` lateral (orders.ts has ~3 copies + summary + sort rank; fulfillment.ts recompute mirrors). Web detail `deriveStage` checks `cancelledUnits>0` first. Keep [[project-order-fulfillment-status]] CASE in lock-step (orders.ts / fulfillment.ts / migration).

**2026-09-11 follow-up fix (short-close side effect on "Total Ordered Oils"):** short-close shrinks `quantity_units`, and dashboard `metrics_ordered` summed the shrunk value → "Total Ordered Oils" DROPPED (Aug 7747.9 L instead of the original ~8287.4 L; 13 Aug orders short-closed, −539.5 L). User confirmed Total Ordered Oils must = ORIGINAL gross demand (raw, incl cancelled), so reverted that drop: `apps/api/src/services/dashboard-metrics.ts` `metrics_ordered` + `agents_ordered` drill-down now sum `(oi.quantity_units + coalesce(oi.cancelled_units,0)) * pack_size_litres`. ONE API fix serves BOTH web dashboard card + mobile card (both read /dashboard/metrics `orderedOils` + /dashboard/metrics/ordered/agents) — no app code change. VERIFIED live on web (Aug 1–31 card = 8287.4 L, drill-down sums to 8287.4). Order list/detail `total_litres` intentionally left shrunk (detail shows original vs cancelled). NEEDS: deploy api. metrics test 10/10, tsc clean.

**Migration 0075 APPLIED to prod + verified** (add `order_items.cancelled_units numeric default 0`, extend fulfillment_status CHECK). NEEDS: commit + deploy api + deploy web. Files: migration 0075, apps/api/src/services/{orders.ts,fulfillment.ts}, apps/web/src/features/orders/{orders-api.ts,orders-columns.tsx,orders-export.ts,orders-fulfillment-summary.tsx,order-detail.tsx,order-detail-items.tsx,orders-list.tsx}.

---

## project-orders-search-download.md

---
name: project-orders-search-download
description: "2026-08-12 Orders page — removed Apply button (live debounced search + instant filters) and added a PDF/Excel Download button (one row per SKU, by fulfillment status)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f15dbcf-7895-4d5c-b2e9-05e6df133a0a
  modified: 2026-08-12T07:10:31.395Z
---

2026-08-12: Reworked the web **Orders** page (`/dashboard/orders`).

**Part F — Sales Executive dropdown upgrade (latest):** replaced the plain shadcn `Select` in `orders-filters.tsx` with the searchable `SearchSelect` (now consistent with the City filter). Each option shows a circular **initials avatar** (`SEAvatar`/`initials`, primary tint) beside the name; the "All executives" row uses a dashed-outline `Users` icon; the trigger renders the selected exec's avatar + name. Added an optional `renderTrigger?(selected)` prop to the shared `SearchSelect` (`search-select.tsx`) to allow custom trigger content (additive; City/New-Order/Record-Collection unaffected). E2E verified: search "san" → SA Sandeep, select → trigger shows avatar chip, list filtered to 97 orders. Web-only (no API/deploy dependency). tsc + eslint clean.

**Part E — export = one row per order + honours page filters (earlier):** the PDF/Excel export switched from one-row-per-SKU to **one row per ORDER** with all its SKUs comma-joined in the "Products" cell and their quantities comma-joined (same order) in "Qty / Litres" (`buildRows` in `orders-export.ts`, now exported + unit-tested `orders-export.test.ts`). The download now also carries the page's **applied filters** — search, city, salesExecutiveId, dateFrom, dateTo — in addition to the popover's fulfillment status; `fetchAllOrders` builds the full query string (`OrdersExportFilters`), and the popover's status **defaults to the page's current fulfillment funnel** (`defaultFulfillment`, reset each open). `orders-list.tsx` passes `filters` + `defaultFulfillment` into `OrdersDownload`. Applies to BOTH PDF and Excel. E2E verified: export request carried `search=Murali&pageSize=100`; unit test confirms `TITAN 5W-30 3.5L, SYN SP 0W-20 1L` / `14 L, 4 L`. Client note: "sorting conditions" meant "respect the selected search/city/SE/date filters". Same API deploy.

**Part D — broadened search (earlier):** the single Orders search box now matches (OR) across six fields in `listOrdersPaged` (`orders.ts`): ORD code, invoice number (`exists` on non-rejected invoices), customer name, city, sales-exec name, and phone. Phone is **digits-only normalized** on both sides (`regexp_replace(c.phone,'[^0-9]','','g') ilike %digits%`) so "99597 14221" / "9959714221" / "+91…" all match. One `$N` text param reused across the text conditions; phone adds a second param only when the term has digits. Only the **web paged** query changed — the non-paged `listOrders` (mobile) still matches order code + customer name (deliberate, low blast radius). Placeholder updated to "ORD id, invoice, customer, city, phone, SE…". E2E verified live for all six field types. Same API deploy.

**Part C — column restructure (earlier same day):** columns reworked in `orders-columns.tsx` → **Ordered Date · Invoiced Date · Code · Invoice · Customer · Total Litres · Fulfillment**. Standalone **City** and **Sales Exec** columns REMOVED; they now stack inside the **Customer** cell as 3 lines: name / `City · SalesExec` / phone (phone grouped `+91 78932 84264` via local `formatPhone`). "Date" header → **"Ordered Date"**; new non-sortable **"Invoiced Date"** column (`InvoicedDateCell`) shows the earliest invoice date, and for multi-invoice orders adds "+N more" that on hover opens a Popover listing every invoice number + date (hover via onMouseEnter/Leave — this Popover is Base UI, no `asChild`). Payload change: `orders.ts` `invlist` jsonb_agg now includes `'date', iv.invoice_date` → `invoices[].date`; web `OrderInvoiceRef` gained `date: string|null`. `orders-list.tsx` composition updated (Invoice column inserted at index 3). E2E verified live incl. the 2-invoice hover panel on ORD-0089. Same API deploy covers it.

**Part A — search:** dropped the "Apply" button; search is now live (300ms debounce → `url.setFilter("search", …)`, mirroring Collections/Customers). City / Sales-Exec / Date filters apply instantly. A "Clear" button shows only when filters are active. Files: `orders-list.tsx`, `orders-filters.tsx` (removed `onApply`).

**Part B — Download:** new "Download ▾" popover beside "+ New Order" (`orders-download.tsx`) → pick a fulfillment status (all/ordered/partially_invoiced/invoiced/partially_delivered/delivered/cancelled) → PDF (jspdf via `@/lib/pdf-doc`) or Excel (dynamic `xlsx`). Export is **one row per ordered SKU** (`orders-export.ts`, `buildRows` expands `o.items`); columns = Order code, Date, Invoice ID, Customer, City, Phone, Sales Executive, Fulfillment, Product/SKU, Qty/Litres. Pages `/orders/paged?…&fulfillment=<status>` at pageSize 100.

**API changes (`apps/api/src/services/orders.ts`):** paged list query now also returns `customerPhone` (`c.phone`) and an `items` jsonb_agg (itemsagg lateral, 15 web OrderItem fields) so the list `Order` carries line items for the export. Web `Order` type gained `customerPhone` + `items: OrderItem[]`.

**Status:** BUILT, both apps tsc-clean, orders vitest green, **E2E verified locally** (live search → 7 rows; Download → paged all 214 orders, API returns populated `items[]` + `customerPhone`, Excel downloaded). NOT committed. **Needs API deploy** (customerPhone + items aggregate) before the deployed web can export SKUs — local web hits local wrangler which already has it.

Related: [[project-margin-simulator]] (same session; its promise/`use()` streaming was checked live and works — no regression, controls render outside Suspense, rows shimmer).

---

## project-org-id-removed.md

---
name: project-org-id-removed
description: "organization_id scaffolding + 28 dead tables removed from live DB (migrations 0034/0035, applied 2026-07-23)"
metadata: 
  node_type: memory
  type: project
  originSessionId: eafa86c5-123e-4b58-8774-68f5e559440d
  modified: 2026-07-23T00:40:01.622Z
---

On 2026-07-23 the multi-tenant scaffolding was fully removed from the live Neon DB and codebase:

- **Migration 0034**: dropped 28 unused tables (the 27 from `docs/DB-INVENTORY.md` + orphan `se_targets`) and dead FK columns (`customers.beat_id`/`branch_id`, `orders.beat_id`, `visits.beat_id`, `beat_plans.beat_id`, `alerts.rule_execution_id`, `teams`/`territories`/`users.branch_id`); added plain unique constraints replacing `(organization_id, X)` composites (`users.email`/`phone`, `customer_code`, `order_code`, `invoice_number`, `collection_code`, `visit_code`, `territory_code`, `products.product_name`, `daily_executive_performance(metric_date, executive_id)`, `aging_snapshots(snapshot_date, invoice_id)`).
- **Migration 0035**: dropped `organization_id` from all 35 surviving tables and dropped `organizations` itself.
- All `(select id from organizations limit 1)` INSERT subqueries removed from `apps/api` services and `packages/db` setup/seed scripts. `executive-day.ts` no longer selects/copies `beat_id`.
- Apply order was: 0034 → deploy API → 0035. Both recorded in the live `schema_migrations` table (there IS a migration tracker — name + sha256 checksum; keep it updated when applying by hand).
- Pre-migration full `pg_dump` saved at `~/Desktop/bdms-backup-pre-0034-20260723.sql`.
- Root `.env` has a working `DATABASE_URL` for live-DB psql access.
- Verified live afterwards: web dashboard/customers/orders/products (incl. product create), SE mobile API (login, products, customers, GPS batch, order create ORD-0014 — created then deleted). Neon Auth tables untouched.

**Why:** [[project-field-trial]] is live — the removal was done two-phase to avoid failed INSERTs from the previously deployed API.
**How to apply:** never reintroduce `organization_id`; new INSERTs need no org column; new unique constraints are single-org plain ones.

---

## project-overview.md

---
name: project-overview
description: "High-level overview of the Beyond Distribution Management System — purpose, tech stack, app boundaries, and current implemented status as of 2026-07-11"
metadata: 
  node_type: memory
  type: project
  originSessionId: 034d7518-f6ad-43fb-ac03-18b5dd0aff50
---

**Beyond Distribution Management System** — ops platform for a **lubricant distributor** (automotive oils/greases, NOT generic FMCG) in India. Covers field sales, customer management, order capture, invoicing, collections, GPS tracking, and executive performance.

**Why:** Multi-role B2B platform (single-client deployment). Domain terms: Products = lubricants, Customers = retailers/workshops, Sales Executives = field staff, Collections = payments collected against invoices.

**How to apply:** Understand the lubricant distribution domain before suggesting features.

## Tech Stack

- **Monorepo:** pnpm + Turborepo. `apps/api`, `apps/web`, `apps/mobile`, `packages/db`, `packages/shared`.
- **API:** Hono on Cloudflare Workers. Port 8787. No Node.js — Web-standard APIs only. Uses `@neondatabase/serverless`. R2 bucket `sri-aparajita-photos` (binding `PHOTOS`) for customer photos and task attachments.
- **Web:** Next.js (port 3000). Server components fetch data, client components handle interaction.
- **Mobile:** React Native + Expo at `apps/mobile` (rebuilt 2026-07-10, pnpm ONLY — never npm). SALES_EXECUTIVE only. Offline-first SQLite + sync queue with clientUuid idempotency.
- **DB:** PostgreSQL on Neon. Migrations in `packages/db/migrations/` (latest applied: `0012_tasks.sql`).
- **Auth (SUPER_ADMIN):** Neon Auth RS256 JWT. **Auth (others):** Own HS256 JWT in `beyond_auth` cookie (web) / Bearer (mobile).

## Role → Platform Mapping

| Role | Platform |
|------|----------|
| SUPER_ADMIN, MANAGER, ACCOUNTANT | Web (Next.js) |
| SALES_EXECUTIVE | Mobile app (`apps/mobile`, Expo) |
| LOGISTICS | No client yet (never build web UI for SE/LOGISTICS without explicit instruction) |

## Current Implemented State (as of 2026-07-11)

**Web:** login, super-admin dashboard + setup, manager/accountant dashboards, customers (list/detail, SE `created_by` scoping), orders (filters/detail/create), products, collections (list/detail/create, verify-with-reconciliation/reject), alerts, settings, and **Tasks** (`/dashboard/tasks`, all 3 office roles — creator+assignee-private visibility (changed 2026-07-11, no admin override), status lifecycle, priority, assignee, optional customer link, comments, R2 attachments, overdue highlighting; migration `0012`).

**Mobile (Phases 1–5 done, emulator-verified):** login, Home field dashboard with sync chip, search-first Customers screen, customer workspace (Add Sale with 60-day credit gate, Add Collection, last-5 histories, photo upload to R2, auto unplanned visits), GPS visit flow, offline queue + LWW status pull. Beat plan UI hidden pending manager beat-planning web feature.

**Placeholder (not implemented):** Invoices, Reports, Audit Logs, Incentives, Outstanding, Reconciliation page, Aging.

See root `AGENTS.md` for the authoritative route + table list ([[project-test-web-accounts]] has test logins for the three office roles).

## Project Config Files

- `AGENTS.md` (root) — full domain, stack, DB schema, skill guide, hard rules
- `apps/web/AGENTS.md` — web feature structure, auth pattern, sidebar nav lists, Radix/Neon quirks
- `apps/api/AGENTS.md` — Hono patterns, Workers rules, service layer conventions
- `.claude/settings.json` — allowlist for safe read-only bash commands
- `.claude/launch.json` — dev server definitions for `preview_start` (`api`, `web`)

---

## project-paged-table-shimmer.md

---
name: project-paged-table-shimmer
description: "Shared list tables now show the skeleton shimmer on SLOW (>200ms) refetches (page/filter/sort), not just first load — via usePagedTable"
metadata: 
  node_type: memory
  type: project
  originSessionId: 62e3d7c6-d6a4-498b-9f38-eea58c1f2635
  modified: 2026-08-13T16:51:01.200Z
---

2026-08-13: All shared list tables (Orders, Customers, Collections, Invoices, Products, Logistics, Audit Logs, Expenditures, Stock — everything using `usePagedTable`) now flip to the **skeleton shimmer on any refetch that runs longer than ~200ms** (Next/Prev, filter change, sort). Fast refetches keep the previous rows and swap instantly (no flash), because the hook still uses TanStack `keepPreviousData`.

**Why:** user wanted clear "loading" feedback on pagination/filter clicks, but without flashing the table on every fast (<200ms) local fetch. Choice was "shimmer only if slow", "on page+filter+sort", "all shared list tables".

**How:** `components/data-table/use-paged-table.ts` gained a `useDelayedTrue(active, delayMs)` helper (state set only from a `setTimeout` + cleanup, so it's `react-hooks/set-state-in-effect`-safe) and returns a new `showSkeleton = query.isLoading || slowRefetch` (slowRefetch = isFetching-and-not-first-load held true for 200ms). All 9 list consumers now pass `showSkeleton` to `<DataTable isLoading={...}>` (kept the hook's real `isLoading` for the "Loading… / N results" header text). `DataTable` renders the skeleton purely on that flag (data-table.tsx line ~94).

**NOTE — supersedes the AGENTS.md convention** in `apps/web/AGENTS.md` that says "On refetch with existing data, keep the rows (don't flash skeletons)." That's now only true for FAST refetches. Doc not yet updated.

Also clarified for the user: the list tables were ALREADY server-paged (8 rows/page via `/…/paged?page=&pageSize=`); the app never fetched all rows for a list. Only the Download/export loops all pages by design. BUILT tsc-clean, verified on localhost (threshold=0 proved the shimmer path; 200ms fast fetch showed instant swap). Web-only; NOT committed/deployed.

---

## project-photo-dark-watermark-fix.md

---
name: project-photo-dark-watermark-fix
description: Fix for stamped SE/Logistics photos coming out uniformly dark (view-shot opacity:0 ancestor); E2E-verified on emulator
metadata: 
  node_type: memory
  type: project
  originSessionId: 124893aa-aa85-4d61-ae10-747aa1488594
  modified: 2026-08-09T21:00:32.322Z
---

**2026-08-10** — Field bug: watermarked SE & Logistics photos come out **uniformly darker/dimmer** (whole image, only after stamping, both roles per user). Compositor is `apps/mobile/src/lib/photo-stamp.tsx` `PhotoStampHost`/`stampPhoto` — the SINGLE shared path for all 6 photo sites (SE: customer/new, customer/edit, customer/[id] market-intel, collection/new proof; Logistics: (logistics)/delivery, (logistics)/add-delivery; only caption ctx differs). One fix covers both roles.

**DIAGNOSIS (emulator Pixel_8, real flows E2E, extensive measurement):** the darkening is **INTERMITTENT, not input-driven**. Logistics camera capture: run#1 photo-region ratio 0.74 (dark), run#2 0.997 (clean), SE gallery 1.00 (clean). ~8 controlled view-shot harness captures RULED OUT opacity, ICC profile, EXIF/orientation, capture size, and source re-encoding — the compositor is color-faithful (only the intended bottom band dims). Signature = **capture race in `react-native-view-shot`**: it occasionally snapshots the off-screen `<Image>` a frame or two before the GPU texture finishes uploading → dim frame. Production captured after just ONE requestAnimationFrame (too aggressive).

**Fix (BUILT, tsc clean, NOT committed):** in `onImageReady` wait TWO rAFs + `setTimeout 120ms` before `captureRef` (texture-settle) — the real lever. Also dropped `opacity:0` from `styles.offscreen` (kept off-screen `-99999` hiding) as a precaution for the documented opacity-ancestor darkening on some real GPUs — but note that never demonstrably mattered on the emulator.

**Caveat:** emulator can't reproduce the bug on demand (intermittent), so FINAL confirmation needs a real-device APK. If the settle-wait isn't enough on real devices, the durable fix is to **abandon view-shot and composite with `@shopify/react-native-skia`** (draw image+band to a canvas, encode — no capture race). User asked "what is Skia?" and is open to switching (watermark is a client requirement). Verified no junk created on live trial (backed out of forms; logistics run not submitted).

**Remaining:** decide view-shot-hardening APK first vs go straight to Skia; commit + build APK (carry committed heartbeat-7PM + pull-to-refresh fixes too). Related: [[project-photo-watermark-size-r2cold]], [[project-photo-stamping-pending]].

---

## project-photo-stamping-pending.md

---
name: project-photo-stamping-pending
description: "Photo-stamping (address+date/time burned on SE/Logistics photos) — core BUILT 2026-07-28 (geocode endpoint deployed, stamp util + all 6 surfaces wired); needs Google key + APK to validate; address-backfill phase not built"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2bc6b80a-4a46-494e-b2d5-942c6fda98a4
  modified: 2026-07-27T20:03:10.292Z
---

**Photo stamping** — burn **address + date + time + SE/driver name + coords + customer + "Beyond
Automobile"** as a dark bottom band onto every SE/Logistics photo (like GPS Map Camera). Full spec:
`docs/PENDING-PHOTO-STAMPING.md`. Decisions settled 2026-07-25; open forks answered 2026-07-28:
engine=**react-native-view-shot** (v5.1.1, added); no-GPS→stamp **"Location unavailable"**;
customer guard n/a here; **address backfill in DB = YES** (still to build); defaults: stamp failure
never blocks (upload original), gallery=current pick-time.

**BUILT 2026-07-28 (core, typechecks; NOT yet validated on-device):**
- API: `apps/api/src/routes/geocode.ts` → `POST /geocode/reverse {lat,lng}` proxies Google Geocoding
  server-side, ~3s timeout, coords-only fallback (returns `{address:null}` when no key / timeout /
  error — never blocks). Auth SE+LOGISTICS+office. Binding `GOOGLE_GEOCODING_API_KEY` in types.ts;
  registered in index.ts. 4 tests (geocode.test.ts). **DEPLOYED** (returns null until secret set).
- Mobile: `apps/mobile/src/lib/photo-stamp.tsx` — `stampPhoto(photo,{userName,customerName?})` +
  `PhotoStampHost` (mounted once in root `_layout.tsx`). GPS via `getCheckInFix` → geocode → off-screen
  `captureRef` composer (Image + band) → JPEG. Layered: online=address+coords, offline=coords,
  no-GPS="Location unavailable". Fails open (returns original photo). IST date via manual UTC+5:30.
- Wired into all 6 capture sites (after pick, before persist/upload): customer new/[id]/edit,
  collection new, logistics delivery (odometer) + add-delivery. `react-native-view-shot@5.1.1` added.

**STILL NEEDED before it works for real:**
1. **Google server Geocoding key** from user → `wrangler secret put GOOGLE_GEOCODING_API_KEY` (the repo's
   NEXT_PUBLIC key is browser/referrer-restricted, rejected server-side).
2. **New EAS APK** (native dep react-native-view-shot — no OTA) + on-device test (camera/gallery,
   online/airplane). Off-screen capture sizing/memory likely needs tuning on-device.
3. **Address-backfill phase (decision=YES) NOT built:** add lat/lng + geocoded_address columns to
   `customer_photos`, `payment_proofs`, `delivery_photos`; thread coords/address through the 3 upload
   endpoints + the offline SQLite sync queue (collection/delivery) so an offline coords-only photo gets
   its street address recorded once synced online (burned pixels stay coords-only). Recommended to build
   AFTER core validated on-device.

---

## project-photo-watermark-size-r2cold.md

---
name: project-photo-watermark-size-r2cold
description: "SE photo stamp title=customer, smaller images, and all R2 objects moved to cold (Infrequent Access)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-08T06:55:03.727Z
---

**2026-08-08** — three changes to SE/Logistics photos (stamping is already live; this refines it). BUILT, tsc + 113 mobile + 421 API tests pass; NOT committed. Mobile parts need a new APK; API part needs a deploy.

**1. Watermark title = customer name** (`apps/mobile/src/lib/photo-stamp.tsx`, `buildLines`): the pin title was hardcoded `📍 Beyond Automobile`; now it's the **customer name** (the pin labels the shop being visited). Fallback when no customer is linked: the **street address**, then `Beyond Automobile`. The separate `Customer: X` line is dropped (redundant). Rest of the stamp is unchanged (address, coords, `date · time · SE`) — user chose "keep what we have today" for the layout after considering a 2-line version. **Photo pixels are deliberately NOT altered** — user explicitly said don't brighten/darken; the "too dark" complaint is camera underexposure/backlight, and the stamp only ever darkened the bottom band.

**2. Smaller stored images** (same file): stamped output capped at `MAX_WIDTH = 1080` (was 1600) and `STAMP_JPEG_QUALITY = 0.6` (was 0.8) via `captureRef`. Roughly 150–300 KB/photo. Note: only the stamped path resizes; a fail-open (stamp error → original returned) keeps full size.

**3. All R2 objects → cold (Infrequent Access)** (`apps/api`): new `src/lib/r2.ts` exports `R2_COLD_STORAGE_CLASS = "InfrequentAccess"`; added `storageClass: R2_COLD_STORAGE_CLASS` to **all 10** `bucket.put(...)` sites (photos, collection-proofs, tasks, deliveries, expenditures, invoices ×2, sales-returns ×2, invoicing-pdf). Bucket is `sri-aparajita-photos` (binding `PHOTOS`). Caveats: IA = cheaper per-GB storage but adds a per-retrieval fee + 30-day minimum storage; **only affects objects written after deploy** — existing objects stay Standard. No wrangler change needed (storage class is per-object at put time).

Related: [[project-photo-stamping-pending]] (original stamp spec, now shipped), [[project-expenditures]], [[project-invoices-section]].

---

## project-privacy-policy-page.md

---
name: project-privacy-policy-page
description: "Public /privacy-policy page in apps/web for the Play-listing privacy policy (Beyond Automobile app), fixes Google's 'app/developer details don't match' rejection."
metadata: 
  node_type: memory
  type: project
  originSessionId: a4af4198-1eab-462b-9a29-d51b76f12a8b
  modified: 2026-09-09T03:51:00.818Z
---

**2026-09-09.** Created **`apps/web/src/app/privacy-policy/page.tsx`** — a PUBLIC (no-auth) static Next.js route, served at `/privacy-policy` (intended URL `https://bdms.vardhansystems.in/privacy-policy`). Written to satisfy the Google Play Console rejection "Privacy Policy … App or developer details don't match" (the old `vardhansystems.in/privacy` didn't name the app/entity).

**Key facts baked into the policy (confirmed with user):**
- App: **Beyond Automobile**, Android package **com.vardhansystems.sriaparajita** (app.json name="Beyond Automobile", v1.1.1).
- Legal entity / Play developer: **Beyond Distribution Systems** (matches the Play listing developer name — the fix Google required).
- Contact/grievance: **support@vardhansystems.in**. Jurisdiction India. No full postal address (user chose "recommend me" → email+entity+India only; can add city/state later).
- Data documented (accurate from code): precise + **background** location (SE work-day route Start Day→7PM IST auto-stop, visit check-in GPS, foreground-service notice), camera/photos (shops/receipts), account info (name/phone/email/role/territory, admin-created), business records (orders/collections/visits/tasks), device/technical (model/OS, battery, network, push token, error logs). Processors: Cloudflare (hosting+R2), Neon (Postgres), Expo+Google FCM (push), Google Maps/Play (mobile maps). NO selling, NO ads, NO 3rd-party analytics. Includes a data-deletion request path (Google requires it) + children (18+) + retention + security + India IT-Rules grievance contact.

Root layout has no global auth guard (getSessionRole→null when signed out), so a top-level route is public by construction; verified it renders without login. tsc+lint clean. UNCOMMITTED on branch `feat/vardhan-maps-integration`.

**NEXT (user's steps):** deploy apps/web; ensure `bdms.vardhansystems.in` routes to the web app; in Play Console → App content → Privacy policy, set URL to `https://bdms.vardhansystems.in/privacy-policy` and resubmit for review.

---

## project-reports-emails.md

---
name: project-reports-emails
description: "Reports page (per-report Excel/PDF download + from–to range picker). 9PM email DELETED 2026-08-28 — react-email rebuild later."
metadata: 
  node_type: memory
  type: project
  originSessionId: 83399742-4811-416d-a6a9-2c186cf7bcab
  modified: 2026-09-07T22:10:51.591Z
---

**Total-invoiced KPI tiles (2026-09-08, UNCOMMITTED — needs api+web deploy).** User wanted a "total invoiced amount" stat, before AND after GST; asked me to suggest placement. Chose the **Reports KPI strip** (dashboard finance stat cards were deliberately removed — [[project-dashboard-finance-cards]] — so Reports is the consistent home + naturally period-bounded by the from–to picker). Added **two tiles**: "Invoiced (pre-GST)" = `sum(invoice_net_value... taxable_value)` and "Invoiced (with GST)" = `sum(invoice_net_value)`, over `invoices.invoice_date` in the resolved period, **ALL invoices (no approval_status filter — user chose include-everything)**. Backend: extended the existing `reports_sum_billed` query in `buildSummary` (`services/reports.ts`) to also `sum(taxable_value) as "t"`; added `invoicedPreGst`/`invoicedWithGst` to `ReportsSummary` (api + web `reports-types.ts`). Web: `reports-kpi-strip.tsx` now 8 tiles (KPI_LABELS + values), grid changed `sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0` → `sm:grid-cols-4` (2 rows of 4). NOTE `rupees(0)` renders "—" so zero periods show a dash. Verified live (01 Jul–28 Aug 2026): pre-GST ₹33,70,566.92 / with-GST ₹39,76,034.20 — cross-checked against prod DB exactly (205 invoices, taxable 3370566.92, net 3976034.20; GST ~18%). NOTE the pre-existing `billedValue` field is mislabeled "(before GST)" in a comment but actually sums invoice_net_value (after GST) — left untouched (feeds SKU-card teasers); the new explicit fields are the source of truth for the tiles. tsc+lint clean both apps; no reports.test assertions on summary shape.

**2026-08-28 — 9PM EMAIL DELETED + Reports page refactored (UNCOMMITTED, needs api+web deploy).** User: "delete the email we are sending at 9pm, use react email later" + wants the reports page maintainable, every reports file <100 lines. Done:
- **API email fully removed:** deleted `report-email.ts` + `report-charts.ts`; removed `buildReports` orchestrator from `services/reports.ts` (kept `buildOneReport`/`buildSummary` + all slice builders); removed `REPORTS_CRON`, the `if(controller.cron===REPORTS_CRON)` branch + email imports from `index.ts`; removed `"30 15 * * *"` from `wrangler.jsonc` crons (now just `["*/3 * * * *"]`); `routes/reports.ts` dropped `.post("/send-test")` + the `report=all`→buildReports branch (absent/unknown `report` now defaults to `summary`). **RESEND secret binding LEFT in place** for the future react-email rebuild. Uptime monitor (`runHealthMonitor`/`inStatusWindow`) is independent — KEPT. api tsc clean, 14 reports tests pass.
- **Web reports page:** from–to range picker only (default today, NO presets, NO top-bar download) via new `reports-range-picker.tsx` (`todayRange()`); download moved INTO each opened report (drill-in) as Excel+PDF buttons (`reports-download-buttons.tsx` → `reports-download.ts` per-report, dynamic xlsx/jspdf import of the already-fetched slice). Removed `fetchReports` (no more full-bundle fetch). **Header layout:** the picker sits as the `PageHeader` `action` (top-right, next to the "Reports" title/subtitle). To keep the picker's client range state co-located, the `PageHeader` was MOVED OUT of the server `page.tsx` INTO the client `ReportsView` (title/subtitle consts `REPORTS_TITLE`/`REPORTS_SUBTITLE` in `reports-catalog.ts`, also rendered by `ReportsPageSkeleton` so the title shows instantly with no flash while the ssr:false chunk loads).
- **<100-line split (every reports file <100):** types → `reports-types.ts` + `reports-row-types.ts`; catalog (titles/short/column-counts) → `reports-catalog.ts`; KpiStrip → `reports-kpi-strip.tsx`; tables split into `reports-table-kit.tsx` (RIGHT/EmptyRow/**SegmentTable** generic for sales+collections), `reports-tables-sku.tsx` (**SkuTable** generic for oilsSku+bearingsSku), `reports-grouped-table.tsx` (**GroupedTable** generic for backlog+ordered), plus `-people`/`-oils`/`-bearings`/`-customers`; dispatcher → `reports-table.tsx`; AoA export → `reports-aoa-flat.ts`+`reports-aoa.ts`. Verified LIVE (localhost web+api): overview, backlog grouped table, oilsSku SkuTable all render real data; drill-in Excel/PDF buttons run without error. tsc+lint clean. Page subtitle updated (no more "9 PM email").

**CHARTS + CRON FIX (2026-08-06, uncommitted/undeployed):** Client said the email was "too lengthy" and wanted graphs. Reworked to **charts-first**: new `report-charts.ts` renders **QuickChart.io image URLs** (email can't run JS; Workers has no headless browser) — **pinned `?v=4`** so Chart.js v4 config (indexAxis/stacked/plugins.legend) works. Each of the 7 sections = one chart + a one-line summary; the big tables are **removed** (detail lives on the web Reports page, link already in the footer). Charts: 1 sales = horizontal STACKED bar per SE by segment; 2 collections / 3 distance / 4 onboarding = horizontal bars; 5 oils = **pie** of segment share; 6 backlog / 7 ordered = horizontal bars by SE (value/litres). Email ~9.4 KB (was table-heavy). Verified live (rendered vs real Neon monthly data, all charts load). **Cron "nothing arrived yesterday" fix:** hardened the 9 PM scheduler — `dispatchScheduledReports` now isolates each cadence in try/catch (one failing report no longer aborts the batch) and `index.ts` logs `[reports] dispatch complete/crashed` + a clear message when RESEND_API_KEY is missing. wrangler already has cron `30 15 * * *` (=21:00 IST) + `observability.enabled`. **Likely root cause = the reports cron isn't active on the DEPLOYED worker (this feature's deploy was pending) → must REDEPLOY apps/api to activate it; then check CF observability logs for `[reports] dispatch complete`.**

2026-08-04: Built a Reports feature + scheduled client emails (branch `reports`, NOT yet committed/deployed). Six reports, all IST periods, per-executive reports list all active SEs:
1 Executive sales by segment — oil LITRES per segment (orders, net of returns)
2 Collections by segment — ₹, attributed to the CUSTOMER's segment(s), verified+pending, split equally across multi-segment customers (columns dynamic = segments present)
3 Travelled distance — total km per SE **+ LOGISTICS**, from `gps_tracking_sessions.total_distance_km`
4 New-customer onboarding — count per SE (`customers.created_by`/`created_at`)
5 Oils analytics by segment — oils ranked by litres + share (oils only, per client)
6 Backlog — invoices with no `delivery_run_stops` row (a CURRENT snapshot, not period-bounded), grouped by SE. **Age (Days) column removed 2026-08-04** (misleading: 28 of 34 backlog invoices predate delivery-tracking launched 2026-07-29, so they show as "pending" though delivered — backlog-scoping fix still OPEN, user deferred it).
7 Ordered, not yet invoiced (added 2026-08-04) — oil litres ordered but not yet billed = order_items.total_litres − Σ invoice_line_allocations.litres, remaining > 0; grouped by SE (order code, customer, pending litres); CURRENT snapshot. Email width widened 720→900px same day.

**Backend (Phases 1–4, verified against real Neon data via a smoke test):**
- migration `0052_report_email_log.sql` (idempotency: partial unique index on (cadence, period_start) where status='sent') — **NOT applied to DB yet**.
- `apps/api/src/services/reports.ts` (`buildReports`, `resolvePeriod`) + `routes/reports.ts` (`GET /reports?cadence=&anchor=` for SA/Mgr/Acct; `POST /reports/send-test` SA-only, force send) + `services/reports.test.ts` (8 period-math tests pass).
- `services/report-email.ts` — email-safe HTML renderer + Resend REST send (`fetch` https://api.resend.com/emails) + `dispatchScheduledReports` (IST cadence detection) + `resolveReportConfig(env)`.
- Cron `30 15 * * *` (9PM IST) added to `wrangler.jsonc`; `index.ts` scheduled handler branches on `controller.cron` (reports on the 9PM cron, maintenance on */3).
- New env bindings (types.ts): RESEND_API_KEY (secret), REPORTS_FROM (default `reports@updates.vardhansystems.in`), REPORTS_TO (default `bhaskar10konda@gmail.com`), REPORTS_WEB_BASE_URL.

**Frontend robustness (2026-08-04):** Reports page got context-aware table skeletons (`reports-skeletons.tsx` — shimmer shaped like each report), lazy loading (`LazySection` IntersectionObserver defers off-screen sections + `reports-view-lazy.tsx` code-splits the view via next/dynamic ssr:false), and an inline fetch-error card (`reports-error.tsx` — offline/session/server variants, keeps chrome, Retry; `isAuthError` gates query retry so 4xx never retries). Query uses `placeholderData: keepPreviousData` for smooth cadence switches. Data stays ONE fetch (server computes all 7 in parallel; splitting would break snapshot consistency + downloads). Verified live (error card + retry recovery, 55 skeleton cells, deferred sections). Kept the shared dashboard `error.tsx` for render crashes.

**Reports page UI (2026-08-04, redesigned):** Overview = a KPI strip + grid of 7 cards (NO "1./2." numbers on titles); click a card to drill into that one report (no long scroll). LAZY per-report fetching: `GET /reports?report=summary` feeds the KPI/cards (light aggregates, `buildSummary`); `?report=<key>` fetches ONE report's detail on card click (`buildOneReport`) with a context-aware `TableSkeleton` shimmer; `?report=all`/absent = full bundle, used only by the Excel/PDF export (fetched on the download click). Verified E2E across Daily/Weekly/15-Day/Monthly. `reports-cards.tsx` (KPI+cards), `reports-view.tsx` (summaryQuery + per-report reportQuery), `reports-skeletons.tsx` (overview + TableSkeleton).

**Web (Phase 5):** `app/dashboard/reports/page.tsx` + `features/reports/*` (reports-view, reports-tables, reports-export using `xlsx` + `jspdf`/`jspdf-autotable`; Excel = one sheet/report, PDF = autotable). Nav "Reports" href now `/dashboard/reports` (all 3 roles). Page mounts + renders (verified in browser); data pending API deploy.

**Remaining (Phase 6, needs user):** apply migration 0052; deploy API (adds route+cron) + web; add `RESEND_API_KEY` secret (`wrangler secret put`); verify `updates.vardhansystems.in` in Resend (DNS); set REPORTS_WEB_BASE_URL to the deployed web URL; then `POST /reports/send-test` to confirm real email. Email = HTML tables + "View in Beyond" link (no attachments; Excel/PDF are page-download only). Related: [[project-invoices-section]] [[project-se-targets]] [[project-dialog-system]].

---

## project-se-leaderboard.md

---
name: project-se-leaderboard
description: "SE peer leaderboard (mobile) — every active SE ranked by total oil litres, day/week/month"
metadata: 
  node_type: memory
  type: project
  originSessionId: d04e0a17-7ca2-43db-8983-8f8516c376c6
  modified: 2026-08-09T09:18:33.867Z
---

**2026-08-08** — client asked for a **peer leaderboard**: every Sales Executive sees all SEs ranked, by **total oil litres** (all 7 segments summed), for **Today / Week / Month**. Client decisions: mobile SE app only; rank by raw oil litres (NOT % of target, NOT bearings); Day = raw actuals (targets are week/month only); hide zero-sale SEs; highlight the viewer's own row.

Build (TDD, small files; BUILT, tsc + 421 API + 115 mobile tests pass; NOT committed):
- **API** `GET /leaderboard` (role SALES_EXECUTIVE) — `services/leaderboard.ts` `oilLeaderboard(sql)` returns one row per active SE `{userId, name, today, week, month}` litres, using the SAME litre definition as the Home performance card (orders non-cancelled, oil lines `product_id is not null`, net of `sales_return_items kind='oil'`, IST day/week(Mon)/month). Route `routes/leaderboard.ts`, registered in `index.ts`.
- **Mobile** — pure `lib/leaderboard.ts` `rankByPeriod(rows, period, myId)` (filter litres>0, sort desc, ties by name, rank 1..n, flag isMe) TDD'd in `leaderboard.test.ts`. **2026-08-09 redesign:** the standalone screen `app/leaderboard.tsx` and its tappable Home nav card were REMOVED; leaderboard is now an **inline card on Home** (`components/leaderboard-card.tsx`) placed directly **below My Performance**, styled to match the performance card (framed `rounded-3xl` card, same segmented Today/Week/Month pill toggle, "OIL LITRES RANKING" subtitle). **Ranking is a HORIZONTAL scrollable strip of tiles** (not a vertical list) so it scales past 4 SEs — each tile: medal (🥇🥈🥉) or numbered circle on top, name, litres, then "You" on the viewer's own tile. **Top-3 tiles carry gold/silver/bronze tinted backgrounds** (rank 1 `bg-amber-100`/`border-amber-300`, rank 2 `bg-slate-100`/`border-slate-300`, rank 3 `bg-orange-100`/`border-orange-300`; ranks 4+ neutral `bg-secondary`). The viewer's own tile keeps its rank bg but overrides the border to `border-primary` so both the medal colour and the "You" identity show; wrapped in a horizontal `ScrollView`, extra SEs scroll off to the right. Skeleton/error/empty states; refetches on Home pull-to-refresh via `refreshSignal`. Default tab "today" (mirrors perf card → empty on Today when no sales). Rendered in `app/(tabs)/index.tsx` as `<LeaderboardCard refreshSignal={refreshKey} />`.

Verified: query run on prod (Month: Murali 1444.7 L, Sandeep 768, Srikanth 104, Upendar 33.1; two 0-SEs hidden; Today all 0 → empty state). Inline card verified live on emulator against the DEPLOYED API (Week: 🥇Murali 1109.2 / 🥈Sandeep·You 709 / 🥉Srikanth 104 / 4 Upendar 33.1). Needs a new APK for field devices. Related: [[project-se-targets]], [[project-admin-dashboard]].

---

## project-se-targets.md

---
name: project-se-targets
description: "SE actual-vs-target feature (migration 0036, 2026-07-23) — weekly+monthly targets, dashboard Targets card, mobile Home performance card"
metadata: 
  node_type: memory
  type: project
  originSessionId: eafa86c5-123e-4b58-8774-68f5e559440d
  modified: 2026-07-23T04:16:55.929Z
---

Built 2026-07-23 (the `se_targets` orphan table dropped in [[project-org-id-removed]] was recreated properly as migration `0036_se_targets.sql`, applied live):

- **Table**: `se_targets` — per-SE `period_type` week|month, `period_start` (Monday / 1st, IST), targets for **litres + bearings qty ONLY** (collections/visits target columns DROPPED in migration `0038`, 2026-07-24 — user decision; API/web/mobile all show just the two metrics, and the SE Home has no collections/visits numbers at all now).
- **API** (deployed): `GET /targets/me` (SE), `GET /targets` + `PUT /targets/:userId` (SA/Manager). Actuals: order_items litres/bearings (orders not cancelled), collections non-rejected by collection_date, visits by visit_date; all ranges IST, week starts Monday. **CORS gotcha fixed**: PUT was missing from the API's `allowMethods` — added.
- **Web**: `features/targets/` — TargetsPanel on its own page `/dashboard/targets` under the sidebar "Configure" section for BOTH SA and Manager (moved off the dashboard 2026-07-24; Manager gained a Configure section): per-SE 4-metric progress bars, This Week/This Month toggle, Set/Edit dialog. Verified E2E via local web → prod API.
- **Mobile**: `components/performance-card.tsx` + `lib/performance.ts` on SE Home — Today/Week/Month segmented card; Today = actuals only (user's explicit choice), Week/Month = bars vs target; offline via `performance_cache` SQLite table. Verified on emulator.
- Spec decisions (user-confirmed): targets weekly + monthly separately (no daily targets); collections count when recorded, not when verified; targets editable right on the dashboard home.
- Test targets exist for test SE (test@test.com): week 500L/₹1L/30/50, month 2000L/₹4L/120/200 — real ones replace them when the user sets targets.
- Ship state: API deployed; web NOT deployed (uncommitted, user reviews first); mobile needs the next APK (JS-only change, but an APK build was already pending for the 7PM cutoff native change).

## MAJOR REWRITE 2026-07-25 — per-segment oils + bearing VALUE (migration 0041)

Superseded the single total-oil + bearing-qty model. Now:
- **Oils = a litre target PER SEGMENT** (Cars, Commercial, 2W, 3W, Tractors, Industrial, Gear Oil — 7). Overall oil target = their sum. Actuals group by `order_items.segment` (the segment the SE picked on each order line — one per line, matches the dashboard "Oils — by segment"). User decision: same as the dashboard segment table.
- **Bearings = a single VALUE target in ₹** (not quantity). **Key discovery:** orders store NO price for bearing lines (only qty) — in fact no order line stores money. So bearing actual VALUE comes from uploaded **invoices**: sum of `line_items` amounts where `kind='bearing'` (before GST), attributed to the SE via `invoices.sales_executive_id`, by `invoice_date`. This means **oils are measured from ORDERS, bearings from INVOICES** (billed) — different sources/timing, explicitly accepted by the user.
- **DB (migration 0041, applied live):** `se_targets` dropped `target_litres`/`target_bearings`, added `target_bearing_value`; new child `se_segment_targets (se_target_id, segment, target_litres)`. Old targets cleared (start fresh — can't split a total into segments).
- **API:** `services/targets.ts` fully rewritten — `getOilActuals` (per-segment from orders), `getBearingActualValues` (from invoices line_items), `getTargetsFor`, `getMyPerformance`, `listExecutiveTargets`, `upsertTarget`. `PUT /targets/:userId` body: `{periodType, segments:{[seg]:litres}, bearingValue}`. New response shape has `oilActual[]`/`oilTarget[]` (SegmentLitres) + `bearingActualValue`/`bearingTargetValue`.
- **Web:** `features/targets/*` rewritten — edit dialog has 7 segment inputs + a bearing ₹ value input; panel shows 7 oil bars + a Bearings ₹ bar + an "Oil total" line.
- **Mobile:** `performance-card.tsx` + `performance.ts` — per-segment oil bars + a "Bearings (billed ₹)" bar for week/month; today = actuals only.
- **Verified live 2026-07-25** end-to-end via API with seeded data: oil actuals (Cars 50/Commercial 20/2W 6) and bearing ₹4500 (=3000+1500 invoice bearing lines) reconciled exactly on both `GET /targets` and `GET /targets/me`; and via the real SA login in the browser (set Cars 120/Commercial 60/₹15000 for Murali → displayed with Oil total 180 L). All seeded data + the test target then deleted.
- **Real SA web login works via the /login password form:** `vardhanv1999@gmail.com` / `vardhanv1999@gmail.com` (user-provided). Local dev browser pane couldn't reach localhost during this session, so testing used the DEPLOYED site `bdms.vardhansystems.in`.
- Ship state: migration 0041 applied live, API deployed, web deployed, **APK build in progress** (per-segment mobile card; JS change). Everything left uncommitted for user review.

---

## project-section-badges.md

---
name: project-section-badges
description: "2026-08-01 — \"New since you last looked\" sidebar badges + in-page banner/row-highlight for Orders & Collections (unseen-counter model, per-user section_seen). Built, needs API+web deploy for E2E."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a8263a9-b31c-43d3-becd-1cb8753fd52c
  modified: 2026-08-01T00:25:47.396Z
---

Feature: sidebar notification numbers on **Orders** and **Collections** (like Tasks/Alerts), plus in-page awareness of new items. **Semantics chosen: "new since you last looked"** — an unseen counter that clears when you open the page (NOT a state count). All office roles, system-wide counts.

**DB — migration `0048_section_seen.sql` (APPLIED):** `section_seen(user_id, section, last_seen_at, pk(user_id,section))`, section ∈ 'orders'|'collections'. Seeded existing office users at now() so counts start from deploy, not all history.

**API (`apps/api`) — deployed? NO:**
- `getBadgeCounts` (badges.ts) now also returns `ordersNew`/`collectionsNew` = count(created_at > coalesce(last_seen, now())), office roles only. New users see 0 until first visit (coalesce now).
- `services/section-seen.ts`: `markSectionSeen(userId,section)` upserts last_seen=now, returns `{previousSeenAt, now}`; `countSectionUpdates(section,since)` counts created_at>since (literal per-table queries — Neon serverless has NO `sql.unsafe`). 7 unit tests.
- `routes/me.ts` (office roles): `POST /me/section-seen {section}`, `GET /me/section-updates?section=&since=`.

**Web (`apps/web`) — deployed? NO:**
- `/api/badge-counts` proxy forwards the two new fields; `sidebar-nav.tsx` BadgeCounts type + countFor add orders/collections (also fixed the queryFn fallback object to include all 4 fields or tsc breaks).
- `DataTable` got an optional `rowClassName?(row)=>string` prop (highlight new rows) — non-breaking.
- `features/shell/use-section-notifications.ts` hook: on mount POST section-seen (clears badge via `refreshBadges()`, captures `highlightSince`=previousSeenAt + `openedAt`=now), polls `/me/section-updates?since=openedAt` every 60s → `newCount`, `acknowledge()` re-marks + re-baselines. `features/shell/new-items-banner.tsx` = the "N new … click to load" strip.
- Orders & Collections lists: banner above the table (onLoad → acknowledge + invalidateQueries) + `rowClassName` highlighting `createdAt > highlightSince` (bg-blue-50/60).

**Verified:** API 377 tests pass; web tsc clean; both pages render cleanly with graceful degradation (endpoints 404 pre-deploy → no badge/banner/highlight, no crash).

**VERIFIED E2E 2026-08-01** (API+web deployed by user; simulated SE-created items via DB inserts with created_at=now()): Orders + Collections sidebar badge increments on a new item ✓; opening the page clears the badge + highlights new rows (bg-blue-50/60, older rows plain) ✓; a new arrival while viewing surfaces the "N new — click to load" banner ✓; clicking it loads the item, highlights only the fresh batch, and clears the banner ✓. QA rows deleted after.

**Known minor:** on the FIRST open the sidebar badge clears a few seconds late (Neon serverless read-after-write / refetch race) — settles by the next 60s poll or navigation; functionally correct. Could later optimistically zero the section in the sidebar on the seen-event if instant clear is wanted.

Related: [[project-assign-tasks-to-se]] (reuses refreshBadges + badge pattern).

---

## project-selfhosted-vector-basemap.md

---
name: project-selfhosted-vector-basemap
description: "Self-hosted OpenStreetMap vector basemap (Planetiler pmtiles + MapLibre-under-Leaflet via vardhan-maps) replacing Esri/CARTO tiles on the Beyond web maps — light-grey, roads+labels, no POI."
metadata: 
  node_type: memory
  type: project
  originSessionId: d01150c9-06e1-4aeb-ba60-3bf555c88727
  modified: 2026-09-09T08:28:32.216Z
---

**2026-09-09.** Replaced the third-party raster basemap (Esri Light Gray) on BOTH Beyond web maps with a **self-hosted OpenStreetMap vector basemap** the user owns end-to-end. Driven by user goals: "build on OSM not someone else", "latest roads", "light-grey minimal", "POI icons completely gone", "state bold + district(customer-only) faint borders". See [[project-dashboard-osm-map]] and [[project-vardhan-maps]].

**Pipeline (tiles):** fresh OSM extract → Planetiler → `.pmtiles` (OpenMapTiles schema).
- Data source: **OSM France** per-state India extracts (`https://download.openstreetmap.fr/extracts/asia/india/telangana.osm.pbf` + `andhra_pradesh.osm.pbf`), updated DAILY (Geofabrik has no per-state India extracts; the Protomaps public planet on source.coop is ~1yr stale — that was the original "roads not latest" complaint).
- Build: **Planetiler** (`java -jar planetiler.jar --osm-path=X --bounds=76,12,85.5,20.5 --download --output=Y.pmtiles`). Needs Java 21+ — the Mac already had `/opt/homebrew/opt/openjdk` (openjdk 26); `/usr/bin/java` is just a stub. `--download` fetches natural_earth + water_polygons (~1GB, cached in data/sources).
- MERGE GOTCHA: `osmium merge` of two adjacent state extracts leaves duplicate border node IDs → Planetiler dies "Nodes must be sorted ascending by ID, N came after N". Fix: extract ONE region from the single India extract with `osmium extract -b <bbox> india.osm.pbf` (no dup nodes). For the quick first render I built **Telangana-only** (`beyond-tg.pmtiles`, 34MB); the full TG+AP build (from India extract) was the next step.
- Glyphs (labels need them): mirrored the OFL-licensed **"Noto Sans Regular"** PBF fontstack (256 range files) from `protomaps/basemaps-assets` (`https://protomaps.github.io/basemaps-assets/fonts/Noto%20Sans%20Regular/{range}.pbf`) to self-host.

**Rendering:** `vardhan-maps` upgraded (v0.5.0, local `file:` link into apps/web, NOT yet published). Rewrote `src/react/vector.ts` → `vectorBasemapStyle({pmtilesUrl, glyphsUrl, fontStack, colors, lang})` builds a hand-authored **OpenMapTiles-schema** MapLibre style: light-grey palette, water/waterway/landcover, roads by class (casing+fill, width ramps), road-name + place labels (city/town/village), and **NO `poi` layer** (POI icons gone by omission). Dropped the old Protomaps-schema/`protomaps-themes-base` version. `IndiaLeafletMap` renders it via `@maplibre/maplibre-gl-leaflet` (`L.maplibreGL`) UNDER the Leaflet boundary/marker overlays, registering the `pmtiles` protocol once. Beyond: `apps/web/src/lib/basemap.ts` exports `basemapStyle` + `addVectorBasemap(L,map)` (for the custom customers map); tracking map passes `vectorStyle={basemapStyle}` to `<IndiaMap>`. Origin via `NEXT_PUBLIC_BASEMAP_ORIGIN` (default local `http://localhost:8099`) + `NEXT_PUBLIC_BASEMAP_PMTILES`.

**TWO gotchas that cost real time:**
1. **maplibre-gl v6 silently breaks the pmtiles source** — style/source never load (`isStyleLoaded()`/`isSourceLoaded()` stay false, no error thrown, only the background-color layer paints → "borders but no roads"). Pinning **`maplibre-gl@^4.7.1`** fixes it (the standalone proof page used 4.7.1 and always worked). `@maplibre/maplibre-gl-leaflet@0.1.4` claims v6 support but it does not work with pmtiles v4.5. vardhan-maps peer set to `maplibre-gl: ">=3 <5"`.
2. **`maplibregl.__vmPmtiles = true` throws** "object is not extensible" — the maplibre ESM module namespace is frozen. Track "protocol registered" with a module-scoped `let` flag instead (fixed in both IndiaLeafletMap.tsx and basemap.ts).
- Also: after any `pnpm add file:../vardhan-maps` refresh, MUST kill web dev server + `rm -rf apps/web/.next` (+ `node_modules/.cache`) + restart, or Turbopack serves the stale compiled chunk.

**VERIFIED live (localhost, TG tiles):** Hyderabad z13 shows full road network + dense locality labels (Khairatabad/Abids/Koti/Malakpet…) + Hussain Sagar, light-grey, zero POI. Tracking map shows Warangal/Khammam/Nalgonda/Miryalaguda + roads + exec chips + routes + faint customer-district borders + bold state outline. tsc clean.

**DONE 2026-09-09 (R2 hosting + full TG+AP):**
- Full **TG+AP** pmtiles built: `osmium extract -b 76.6,12.5,85.0,20.0 india.osm.pbf` → Planetiler → `beyond-tgap.pmtiles` (**367MB** — big because OMT includes buildings/landuse layers we don't even render; pmtiles range-reads only visible tiles so browser load stays small). A bbox (not polygon) so neighbour-state slivers are in the file but the maps' dim mask hides them; a few neighbour city labels (Bengaluru/Chennai/Kalaburagi) leak faintly under the mask — cosmetic.
- **Cloudflare R2**: NEW public bucket **`sri-aparajita-basemap`** (private `sri-aparajita-photos` untouched). Uploaded via **rclone** (S3 API, R2_* keys): `beyond-tgap.pmtiles` + `fonts/Noto Sans Regular/` (256 glyphs). Custom domain **`maps.vardhansystems.in`** bound via CF API (`POST .../r2/buckets/sri-aparajita-basemap/domains/custom` with zoneId 5cfc4ccd603fe9cceb1357aa04af2598) — DNS auto-created, SSL live in ~1min. CORS set (`PUT .../cors`, origins `*`, GET/HEAD, range + expose etag/content-range/accept-ranges). Verified: `https://maps.vardhansystems.in/beyond-tgap.pmtiles` → 206 range + ACAO:*.
- Beyond `apps/web/.env.local`: `NEXT_PUBLIC_BASEMAP_ORIGIN=https://maps.vardhansystems.in` + `NEXT_PUBLIC_BASEMAP_PMTILES=beyond-tgap.pmtiles`. VERIFIED live: both maps render full TG+AP from R2 (customers map shows Vijayawada/Visakhapatnam/Kakinada/Nellore = AP now covered; tracking shows Warangal/Khammam/Nalgonda + roads + routes).

**vardhan-maps 0.6.0 (2026-09-09, "batteries-included"):** DECISION (user): keep the npm package (don't vendor into app); combine tiles+code conceptually by **baking the R2 URL as the package default** (Vardhan-branded default, accepted that public installers would hit the R2 + get TG+AP-only tiles). Implemented: `<IndiaMap vector />` shortcut renders the default basemap zero-config; `vectorBasemapStyle()` args now optional → default to `https://maps.vardhansystems.in/beyond-tgap.pmtiles` + glyphs; exported `VARDHAN_TILES_ORIGIN`; **fixed default fontStack bug** (`NotoSans-Regular` → `Noto Sans Regular`, matching the hosted glyphs). README rewritten (vector-basemap section, maplibre v3/v4-only warning, build-your-own-tiles guide), package.json description+keywords, CHANGELOG. Published 0.5.0 then 0.6.0 (user runs OTP publish). Beyond swapped 0.5.0 file-link → npm `0.5.0`; NEXT: upgrade to 0.6.0 + simplify tracking to `vector` prop + drop NEXT_PUBLIC_BASEMAP_* env + basemap.ts URL plumbing.
- Also 0.5.0 added: `lockBounds` (custom pan/zoom region), `maskStates` (dim outside named states), `maskOpacity`, `attributionPrefix=""` (drop Leaflet prefix). Live Tracking now locks+masks to TG+AP (was showing whole world) via `lockBounds={REGION_BOUNDS}` + `maskStates=["Telangana","Andhra Pradesh"]` + `maskOpacity=0.6`; attribution cleaned to just "© OpenStreetMap contributors" on both maps.

**0.6.0 LIVE + Beyond simplified (2026-09-09):** vardhan-maps 0.6.0 published to npm (user ran OTP) + committed. Beyond upgraded `file:`→ then `0.5.0` → **`vardhan-maps@0.6.0`**. Simplified: tracking-map uses **`vector`** prop (dropped `basemapStyle` import); `lib/basemap.ts` `addVectorBasemap` now calls `vectorBasemapStyle()` (no args → R2 default), dropped the `basemapStyle` export + `NEXT_PUBLIC_BASEMAP_ORIGIN/PMTILES` env logic; removed those two lines from `apps/web/.env.local`. **Production deploy NO LONGER needs the NEXT_PUBLIC_BASEMAP_* env vars** (default baked into the package). Local `:8099` http-server stopped (no longer used). VERIFIED live: both maps render full TG+AP from R2 via zero-config, tsc clean. Also cleaned vardhan-maps repo: removed dead `scripts/probe-levels.mjs`, stray `.DS_Store`/logs, rewrote stale ROADMAP.md; added `SKILL.md` (agent integration playbook, ships in tarball).

**STILL REMAINING (as of end 2026-09-09):** (1) **Auto-refresh CI** — files written in vardhan-maps repo but UNCOMMITTED; user must commit+push + add **3** GitHub repo secrets (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID — no CF token needed anymore) + run once. **CI debugged 2026-09-09 (2 failures, both VERIFIED fixed):** (a) Build tiles `SocketException: Connection reset` = Planetiler's HTTP client dropping the 886MB water-polygons download → fixed in build-tiles.sh by pre-fetching water-polygons + natural-earth with `curl --retry-all-errors` into `data/sources/` (Planetiler `refresh_sources=false` default → uses present files, skips flaky fetch) + planetiler retry loop; user re-run PASSED Build tiles (367M) + Upload. (b) then "Purge Cloudflare cache" step `curl 401` (token lacked Cache-Purge perm) → REMOVED the purge step; rclone upload now sets `--header-upload "Cache-Control: no-store"` so CF never caches the range-read pmtiles (verified live: serves `cache-control: no-store` + `cf-cache-status: DYNAMIC`). Job now has no failing step; user must commit+push the workflow change + re-run. (2) Deploy apps/web + apps/api (prod env no longer needs any basemap vars — default baked in). (3) OPTIONAL: slim the 384MB pmtiles via polygon-clip / dropping unused OMT layers. (4) Customers map still uses custom Leaflet + `addVectorBasemap` (not `<IndiaMap vector />`) — acceptable. NOTE: earlier remaining items now DONE — 0.6.0 published, app on npm 0.6.0 + zero-config `vector`, deploy env simplified.

---

## project-shared-account-logout-bug.md

---
name: project-shared-account-logout-bug
description: Logout on a shared field account stopped the worker's live GPS tracking; fixed server-side (deployed) + mobile (APK)
metadata:
  type: project
---

2026-08-05: **Field workers' live tracking was being killed by a logout.** Field
accounts are SHARED — a manager/client opens the worker's OWN account (same login)
on a second device just to view the mobile app's data. The gps tracking session is
per-USER, and mobile `logout()` → `stopDayTracking()` → `endGpsSession(userId)`
(`/visits/gps/end`, user-scoped) ended the worker's active session; the worker's
phone then reconciled, saw `ended`, and stopped tracking itself.

Confirmed in data: **Sandeep** session ended 16:00 (an admin's brief login+logout),
**LAXMAN** ended 19:07 (client's logout) — both NULL `ended_reason` (NOT the SE 7 PM
`server_7pm_closure` cron). NOT a 7 PM cutoff (my first theory was wrong). LAXMAN is
single-role LOGISTICS, never SE — see [[project-logistics-delivery]].

**Fix (two parts):**
- **Server stopgap (DEPLOYED, api v3ec7c4b6):** `endGpsSession` (`/visits/gps/end`)
  refuses to end a session that pinged in the last 10 min — a viewer's logout can't
  kill a live run. Real "End run" uses the session-specific `/tracking-sessions/:id/end`,
  untouched. Verified live: active+fresh-ping → `ended:false`; ping aged 30 min → `ended:true`.
- **Mobile (commit 805f2e4; APK build 9a8e0e00, versionCode 4):** `stopDayTracking()`
  gained `endServerSession` (default true). Logout + reconcile-after-server-close +
  stale-day cleanup are now **local-only**; only the **SE 7 PM cron** and **Logistics
  "End run"** end the server session. NEEDS the new APK installed on field phones.

Latent bug also found (not yet fixed): login role resolver in `auth.ts` (`order by
u.created_at desc limit 1` over a per-role join) returns an ARBITRARY role for
multi-role users — a multi-role Logistics driver could resolve to SE and get the 7 PM cutoff.

---

## project-sku-analytics.md

---
name: project-sku-analytics
description: SKU analytics BUILT 2026-07-23 per the agreed spec — billed-from-invoices dashboard section; full spec in docs/SKU-ANALYTICS-SPEC.md
metadata:
  type: project
---

Discussion-only session 2026-07-23; full agreed spec lives in `docs/SKU-ANALYTICS-SPEC.md`. Key decisions: source = invoice line_items (only place with prices); dashboard section for SA+Manager labeled "Billed (from invoices)" alongside the order-based cards (label, don't merge the two truths); oils + separate bearings tables; row = base product expandable to pack sizes; default sort litres, ₹-before-GST as a column; expand → top-5 buyers; brand/segment revenue roll-ups + 6-month trends; same period switcher as the dashboard.

**Status: BUILT and deployed 2026-07-23.** `GET /dashboard/sku-analytics` (services/sku-analytics.ts) + web `features/dashboard/sku-analytics(.tsx/-tables.tsx)` under the order-based tables. Gotchas encoded: catalogue names use hyphenated grades ("10W-30") vs invoice "10W30" — matching normalizes to letters+digits only; the products catalogue has NO brands filled, so the brand roll-up shows "Unmatched" until brands are set on products (segments match fine). Also: the 7 PM cutoff made time-dependent API tests fail after 19:00 IST — tracking-sessions + visits test suites now pin Date with vi.useFakeTimers({toFake:["Date"]}).

---

## project-sound-notifications.md

---
name: project-sound-notifications
description: "Web audio alerts for new orders/collections/visits (SoundNotifier), browser-audio gotchas, client-nav fix, coin sound + background desktop/tab alerts"
metadata: 
  node_type: memory
  type: project
  originSessionId: ec2ba780-d7df-482c-b7d1-77177c4f3ca2
  modified: 2026-08-17T10:45:26.874Z
---

2026-08-14: Web dashboard plays a **sound alert** when a new order, collection, or field check-in ("visit") shows up. DEPLOYED + live-verified on prod.

**How it works:** `features/shell/sound-notifier.tsx` — a `SoundNotifier` client island mounted in the top bar (`dashboard-shell.tsx`), on every dashboard page. It polls the same-origin `/api/badge-counts` every **20s** and, when `ordersNew` / `collectionsNew` / `visitsNew` **rises** between polls, plays the matching chime once. Three WAVs in `apps/web/public/sounds/` (order = warm ding-dong, collection = metallic ka-ching, visit = low marimba arrival), generated with a numpy synth script. Per-user **🔊 top-bar toggle** (off by default, saved in `localStorage 'beyond:sound-on'` via `useSyncExternalStore`). `visitsNew` = today's check-ins (IST), added to `services/badges.ts` + the me.ts route + the Next proxy route — office roles only; exists ONLY to drive the sound (no sidebar badge).

**Browser-audio gotchas (the hard part):**
- Browsers block audio until a **user gesture** per document load. So sound is opt-in; the toggle click (or the "Click to enable sound" amber hint, or any pointerdown/keydown) unlocks it.
- The unlock flag `audioUnlocked` is **module-level** (not a per-component ref) so it survives the SoundNotifier remounting on navigation.
- **CRITICAL FIX (same day):** the sidebar + top-bar links were plain `<a href>` → every nav was a FULL PAGE RELOAD → re-locked audio every page → sounds silently died as the user navigated (the exact bug reported). Fixed by converting them to Next `<Link>` (client-side nav) in `sidebar-nav.tsx` + `dashboard-shell.tsx`. Now the document persists across nav, so one unlock lasts the whole session. A hard refresh (F5) / new tab still needs one click → the amber **"Click to enable sound"** hint (shows only when on-but-locked) makes that obvious.
- Background tab: keeps polling + plays out loud once unlocked, but background timers throttle (chime lagged up to ~1 min) and Chrome Memory Saver / Edge Sleeping Tabs can freeze the tab (pin it / exclude from sleeping for an all-day monitor).

**Tested:** 5 integration tests in `sound-notifier.test.tsx` (drives the real component, mocks fetch + play); DB-level detection E2E with dummy rows (created+deleted); live-verified on prod by minting a short-lived HS256 diagnostic token (JWT `{sub,iss:'beyond-distribution',iat,exp}` signed with `.env` JWT_SECRET, set as `beyond_auth` cookie) and instrumenting `HTMLMediaElement.play` — visit chime played `ok` after a check-in, persisted across a client nav.

**2026-08-17 update (DEPLOYED web+api):**
- **Collection sound → coin mp3.** `collection.wav` replaced by `public/sounds/collection.mp3` (user-supplied freesound coin); `COLLECTION_SRC` updated; old wav removed. Order/visit chimes unchanged. `new Audio()` plays mp3 fine.
- **Background alerts when the tab is NOT focused.** New `features/shell/tab-alert.ts` (+ wired into `sound-notifier.tsx`): on a rise **while `document.hidden`**, it (1) pops a **desktop OS Notification** ("Beyond · New collection received", tag per type; count/type-based, NOT amount/customer — badge-counts returns only counts), and (2) **flashes the tab**: title → "🔔 N new alerts" + a canvas-drawn **red-badge favicon** with the count, pulsing every 900ms until `visibilitychange`→visible calls `clearTabAlert()`. Visible tab = chime only (no popup/flash). Notification permission requested on the 🔊 unlock gesture (`unlockNow` + passive unlock). Scope = **tab-open only, NO service worker** (browser-fully-closed → Web Push, deferred). Same background-throttle caveat: up to ~1 min late when hidden. `NotificationOptions.renotify` is not in TS DOM types — omitted (tag alone coalesces). 3 tests in `tab-alert.test.ts` (jsdom getContext unimplemented → badgeDataUrl handles null ctx, harmless warning).

**2026-08-17 follow-up (DEPLOYED web+api):**
- **Enriched notification body.** `getBadgeCounts` (`services/badges.ts`) now also returns `latestCollection {amount,customer}` / `latestOrder {value,customer}` / `latestVisit {customer}` (json_build_object of the newest row + customer legal_name; office roles only, else null). Threaded through the Next proxy `app/api/badge-counts/route.ts` → client builds bodies: collection "₹3,000 from <customer>", order "<customer> · ₹X" (bearing-only orders have null value → customer only), visit "<customer> checked in". `alertHidden` now takes `{title,body,tag}` (per-type title). ₹ via `inr()` = `toLocaleString("en-IN")`.
- **Permission-prompt bug FIXED.** The OS-notification prompt never appeared for already-sound-ON users because `requestNotifyPermission()` was only in `unlockNow` (toggle/hint path); an already-on user unlocks via the PASSIVE first-gesture handler. Added the request into that passive `unlock()` too. Caveat: if the user previously blocked/dismissed site notifications, Chrome won't re-prompt — must reset via address-bar lock → Site settings → Notifications.

---

## project-srikanth-tracking-stall.md

---
name: project-srikanth-tracking-stall
description: "Srikanth's missing GPS pings = chronic device-side capture-stall, not a pipeline bug — how to diagnose"
metadata: 
  node_type: memory
  type: project
  originSessionId: e0779741-786e-4ffd-b0de-e5dad287996f
  modified: 2026-08-22T04:15:52.681Z
---

2026-08-22: Investigated "Srikanth logged in + attendance shows + alerts firing, but NO pings on the Live Tracking map." **Root cause = device-side location CAPTURE-STALL, not a server/pipeline bug** (Upendar + Murali pinged fine the same morning through the same endpoint).

Evidence from prod DB (read via MCP run_sql):
- Srikanth: `gps_tracking_sessions` **active**, started 09:15 IST (he DID tap Start day) → this is why **attendance shows present** (attendance keys off the session, not off points). But `gps_points` today = **0**; last real fix was **Aug 19**.
- `tracking_device_heartbeats` (latest today): fg+bg permission **granted**, `is_location_enabled` true, battery-opt **unrestricted**, low-power false, batt 87%, connected, **queued_point_count 0**, heartbeats every few seconds. App is HEALTHY yet produces zero location fixes → `getCurrentLocation` returns null/stale, no point ever created/queued/sent.
- GPS ingestion `services/visits.ts` inserts EVERY point (`on conflict (user_id, recorded_at) do nothing`, no accuracy/quality rejection) → "no accepted location" in the alert means the phone SENT nothing, not that the server refused it.
- The office "alert" = `alerts.alert_type = 'TRACKING_COMMUNICATION_INTERRUPTED'` (high), generated by `services/tracking-maintenance.ts` when >15 min pass with no heartbeat AND no new point. **Chronic for Srikanth's device** — same alert Aug 8,10,11,12,13,14,17,19,22 (nearly every working day). Device: **Motorola moto g84 5G, Android 15, app 1.1.0**.

**Why the map hides him:** `listTrackedExecutives` (services/tracking.ts:164) lists only SEs with `gps_points` for that IST date. The **Device health** tab (`listDeviceHealth`) shows all active SEs incl. zero-point ones — that's the diagnostic view.

Diagnostic signature to reuse: session active + heartbeats healthy + permissions/location all green + queued 0 + **0 points** = capture-stall (vs OEM full-kill = heartbeats also 0). This is the exact failure specced (not built) in `docs/PENDING-TRACKING-CAPTURE-RELIABILITY.md`. See [[project-location-health-guard]], [[project-tracking-screen-off]]. User chose "just the diagnosis" 2026-08-22 — no fix built. Field workaround = force-stop+reopen app / re-tap Start day / toggle location / restart phone.

---

## project-stock-inventory.md

---
name: project-stock-inventory
description: "Stock Journal (inventory) folded into the Products page — schema, seed, per-pack/bearing display, add/adjust/history, PDF export, auto-deduct on invoice"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-11T08:16:33.289Z
---

Stock Journal / inventory module (built 2026-08-07). ~~Decided to live ON the Products page~~ **SUPERSEDED 2026-08-11: moved to its own dedicated `/dashboard/stock` "Stock Journal" page; Products page is now pure catalogue (all stock UI stripped + old products/stock-*.tsx files deleted).**

**2026-08-11 Stock Journal page (BUILT, tsc+tests green, NOT committed/deployed):** new sidebar "Stock Journal" (SA/Manager Management, Accountant Finance). Master-detail: left rail = every catalogue SKU + balance (from `listManagedProducts`/`listManagedBearings` which still carry stockItemId/stockQty — do NOT remove those); right = selected SKU journal + Add; top toggle "By item ↔ All movements". **Add** dialog = 5 types (stock_in, opening, adjustment [set-to], write_off, damage). **Modify** = "Correct" button → posts an adjustment (journal stays append-only per user). Migration **`0059_stock_reasons.sql`** widens `stock_movements.reason` CHECK to add write_off+damage (MUST apply to Neon before API deploy). New API: `adjustStock` takes reason, `removeStock` (write_off/damage → POST /stock/remove), `listAllMovements` (GET /stock/movements, filters). Feature at `apps/web/src/features/stock/*`. **DEPLOYED + E2E-VERIFIED on prod (bdms.vardhansystems.in) 2026-08-11** (user applied migr 0059 + deployed API+web): drove Stock-in/Write-off/Damage/Adjustment on "15W40 CH4 UNIVERSAL 2.5 L" — balance+rail+journal all update per action (router.refresh), write_off/damage confirm migr 0059 live, All-movements shows 316 incl. invoice auto-deductions (System), reason filter works. Left 4 "E2E test" movements on that SKU (balance restored to 0). **UX FIX (tsc-clean, NOT committed, needs redeploy):** the Add-dialog entry-type dropdown clipped its long "label — hint" options (base Select popup = `w-(--anchor-width)`); fixed in stock-add-dialog.tsx → short option labels + contextual hint line below + `w-full` trigger. Other stock dropdowns (rail category, reason/category filters) are fine (short options). Next client ask: custom **GST** section (no spec yet).

**Schema** (migration `0055_stock.sql`, applied to the shared Neon DB): `stock_items` (current balance per SKU — oils by product_id+pack_size_litres, bearings by bearing_id; PARTIAL unique indexes so null-id standalone rows are allowed; unit default 'Pcs'; negatives allowed) + `stock_movements` (journal: reason opening/stock_in/invoice/adjustment, delta, ref_type/ref_id, note, created_by). Balance+movement updated together in one `move()` transaction.

**Seed**: opening stock from client CSVs (Fuchs oils + Texspin bearings, "Group Stock Status" 07-08-2026). Matched **282** SKUs (23 oils/600 + 259 bearings/4660 = 5260 pcs). **92 rows left flagged/unmatched** (user chose "Leave flagged; I'll fix catalogue" — missing packs + name-order diffs for oils, absent bearings/greases); reference file was `<scratchpad>/stock-unmatched.txt`. Bearing match needs alphanumeric-normalization (catalogue `TX-007` vs data `TX007`).

**API** (`services/stock.ts`, `routes/stock.ts`, mounted `/stock`): OFFICE=[SA,MANAGER,ACCOUNTANT]. `GET /` list (category/search/sort/page), `POST /add` (stock-in, +delta), `POST /adjust` (set exact figure; accepts stockItemId OR a SkuRef which it ensures at 0 first), `GET /:id/movements`. Products/bearings `/paged` now LEFT JOIN stock_items to return per-pack/per-bearing `stockItemId`+`stockQty`; their GET routes now allow ACCOUNTANT (read-only catalogue).

**Auto-deduct on invoice** (allows negative, best-effort `.catch`): generated + manual invoices deduct via `ComputedInvoice.stockLines` (oils, productId+packSize, qty=packs) in `commit.ts`/`manual-generate.ts`; uploaded BAL-PDF invoices deduct via `deductForUploadedInvoice()` reading invoice_line_allocations→order_items (oils by product+pack; **bearings in PIECES = quantity_units × MOQ** — ASSUMPTION, consistent with Texspin pieces seed but not user-confirmed for the upload path; in-app invoicing is oils-only so bearings only arrive via uploads).

**Web** (all in `features/products/`): `stock-types.ts`, `stock-client.ts`, `stock-cell.tsx` (OilStockCell per-pack chips + BearingStockCell, negatives red via `stock-format.ts`), `stock-actions-menu.tsx` (Popover ⋯: Stock in/Adjust/History + Edit/Delete gated by canManage), `stock-in-dialog`/`stock-adjust-dialog` (+ `stock-sku-picker` for multi-pack oils), `stock-history-drawer` (TanStack Query journal), `stock-export.ts` (jsPDF via shared `lib/pdf-doc.ts`, "Group Stock Status" layout). Products page + nav now include ACCOUNTANT (canManage = role !== ACCOUNTANT: Accountant views catalogue + does stock actions, can't edit catalogue).

**Status**: COMMITTED + tested by user, working fine (2026-08-07). Bearing deduction unit CONFIRMED as qty × MOQ (pieces). Deploy state: verify whether prod API deployed before assuming `/stock` is live (local web→local API 8787 during build). Related: [[project-invoicing-build]], [[project-fulfillment-pending]], [[project-fuchs-catalogue-segments]].

---

## project-test-web-accounts.md

---
name: project-test-web-accounts
description: Local test login credentials for MANAGER and ACCOUNTANT web roles (created 2026-07-11 via Setup > Add User)
metadata: 
  node_type: memory
  type: project
  originSessionId: 6da298a3-8e15-40aa-b01f-22bbd9ca0284
  modified: 2026-07-27T05:20:46.645Z
---

Test accounts for the web dashboard (local Neon DB), created by the Super Admin "Add User" flow on 2026-07-11 for role-based verification. Login at `/login` (HS256 `beyond_auth` cookie path).

- MANAGER — Test Manager — `test.manager@beyond.local` / `PnXatUtpN9GP`
- ACCOUNTANT — Test Accountant — `test.accountant@beyond.local` / `Jwf9YY$UTA7Z`
- SALES_EXECUTIVE (mobile app) — `test@test.com` / `TestSE#2026` (password reset 2026-07-14 during login-validation testing; was `QJg2vfAdzkh$`, which had stopped working)
- SALES_EXECUTIVE (GPS testing, passwords reset 2026-07-11) — Jayadev `jdsamineni@gmail.com` / `TestGps#2026`, Sales1 `sales1@gmail.com` / `TestGps#2026`
- Older LOGISTICS test login `logistics@test.com` / `LogiTest#2026` still exists — see [[project-logistics-delivery]].

**adb-typing note:** passwords with `#` (e.g. `TestSE#2026`, `LogiTest#2026`) break `adb shell input text` — the device shell treats `#…` as a comment and drops it. Wrap the whole command: `adb shell "input text 'Pass#2026'"`. Prefer no-special-char passwords for accounts you'll type via adb.

**Deleted 2026-07-27 (hard delete on prod, user-requested cleanup):** the throwaway users made during on-device testing — `logistics2@test.com` (Ravi Delivery), `se2@test.com` (Suresh Sales), `logi3@test.com` (Kiran Logistics) — plus the seeded `zzse@test.com` (ZZ Test SE) and its `ZZ Test Shop` customer (+ logistics2's delivery-run/GPS test data). These no longer exist — do not reference them.

**Why:** the user asked to keep these in memory so role-specific web features (e.g. Tasks) can be verified as all three office roles without recreating users. Passwords are only shown once at creation.

---

## project-tracking-customers-visits.md

---
name: project-tracking-customers-visits
description: "Live Tracking web map now shows all customers as dots + selected exec's visit check-ins as flag markers with outcome popups"
metadata: 
  node_type: memory
  type: project
  originSessionId: 211f3923-e8c9-4907-91f9-66b5620e4a50
  modified: 2026-09-10T07:15:08.142Z
---

2026-09-10: **Customers + visit flags on the web Live Tracking map** (/tracking, SA+MGR).
- **Customer base layer**: all active customers with coords plotted as faint grey dots (radius 3), click → customer page. Reuses the `/dashboard/map` customers query already fetched for the district overlay (no new endpoint).
- **Visit highlights**: the SELECTED executive's check-ins for the viewed day drawn as FLAG icons (green=planned, orange=unplanned), date-following + live-polled (60s). Tap opens a popup: customer name, check-in time, planned/unplanned, visit OUTCOMES (orders litres/bearing qty → /orders/:id, collections ₹ → /collections/:id), and a "View customer →" link. Outcomes inferred by same exec+customer+date (same rule as [[project-visit-outcomes]] dashboard drill-down).
- **API**: `GET /tracking/checkins?userId=&date=` (services/tracking.ts `getExecutiveCheckins`; route in routes/tracking.ts). Returns check-ins with GPS fix + planned/unplanned + orders/collections.
- **Package**: needed real marker icons — added to **vardhan-maps 0.9.0** (Leaflet only): `MapMarker.icon` (HTML/SVG → divIcon), `iconSize`, `iconAnchor`, `popup` (click popup HTML). PUBLISHED by user; web bumped 0.7.0→0.9.0.
- **Bug fixed**: clicking a flag navigated to the customer page (a check-in's GPS point often equals the customer's stored coord, so the shared onMarkerClick matched a customer dot). Fix: onMarkerClick guards `if (m.icon) return` — flags are the only markers with an icon; they open their popup instead. Verified live in-browser (flag→popup, no nav; View-customer link navigates).

Web files: features/tracking/{tracking-map.tsx, tracking-map-markers.ts (new), tracking-view.tsx, tracking-api.ts}.
STATE: code complete + verified against LOCAL api (apps/web/.env.local temporarily → localhost:8787). NEEDS: commit + deploy api + deploy web. Restore .env.local to prod API URL when done testing (gitignored).

---

## project-tracking-live-upload.md

---
name: project-tracking-live-upload
description: Root cause + fix for SE live-tracking not being live — native direct upload + heartbeat-timer bug
metadata: 
  node_type: memory
  type: project
  originSessionId: 20187f1c-6ba8-4fa9-a93a-4abdccf7fb35
  modified: 2026-08-08T06:03:52.916Z
---

**Diagnosed 2026-08-08 from real Sandeep/Murali gps_points (prod Neon).** The SE live map wasn't updating every 3 min. Root cause: **capture is fine; upload was foreground-gated.** The native Android foreground service (`plugins/native-tracking/ForegroundLocationService.kt`) captures a fix every ~3 min to local SQLite `gps_pings` even in Doze, but it did NOT upload — upload only happened via JS `kickSync()`, and Android **suspends the JS runtime when the app is backgrounded**. So pockets-in-bag SEs buffered points locally and they only flushed when the app was next opened.

Evidence: **Murali** (realme, capture excellent, max gap 7 min) had **median upload lag ~17 HOURS** — his whole afternoon uploaded the next morning; `queued_point_count` peaked at 82. **Sandeep** (vivo) uploaded promptly but had a *capture* problem (gaps of 51/146 min, service killed by OEM) — different failure mode. Both phones had all perms granted + battery-opt "unrestricted", so it's NOT permissions. Server keeps late uploads (19:00 cutoff is judged by `recorded_at`, not arrival), so no server-side loss.

**Fixes shipped (BUILT 2026-08-08, tsc + 112 mobile tests pass; NOT committed; needs a new EAS APK to take effect — native changes can't run on the JS emulator/tests):**
- **A — native direct upload:** the service now POSTs queued pings itself off the main thread (single-thread executor) after each capture → `POST {baseUrl}/tracking-sessions/{serverSessionId}/points/batch` (falls back to `/visits/gps/batch` when no session), `Authorization: Bearer <token>`, then marks rows `synced=1`. Token+baseUrl bridged from JS via new native `setUploadContext(token, baseUrl)` (called from `startNativeForegroundTracking` + `setNativeSignedIn(true)`; token TTL 7 days; cleared on logout). Uses `HttpURLConnection` (no dep). Idempotent vs the JS flush (server dedupes by `location_point_id`). Guarded by a source test in `android-native-tracking.test.ts`.
- **C — heartbeat/timer bug:** `sync.ts` heartbeat timer compared `dayOn === "1"` but the day flag now stores an IST date string → the 3-min heartbeat NEVER fired. Fixed to `dayFlagIsForToday(dayOn)`, and the same tick now also calls `kickSync()` (there was otherwise no periodic uploader even in foreground).

- **B — OEM capture hardening (Sandeep's vivo failure mode), shipped 2026-08-08:** (1) native `openAutostartSettings()` in `NativeTrackingModule.kt` — the JS `maybePromptAutostart` (Start-day step 7, one-time per install on aggressive OEMs) already existed but the native method was MISSING, so the button was a silent no-op; now it launches per-OEM autostart components (Xiaomi/vivo/Oppo/Realme/OnePlus/Huawei) with an app-details fallback. (2) `TrackingWatchdogWorker.kt` — a WorkManager periodic (15-min) backstop that re-launches the service via `ACTION_BOOT_RECOVERY` whenever a day is still active+signed-in+pre-cutoff, so a killed service recovers WITHOUT the app being foregrounded (the old JS watchdog only restarted on app-foreground). Enqueued (KEEP) on service start, cancelled on stop; needs `androidx.work:work-runtime:2.9.1` (added via the config plugin). Note: on a full force-stop/stopped-state, only the autostart whitelist + reopening helps — WorkManager/alarms are blocked then; that's why (1) is the primary defense.

- **D — JS uploader wedge, ROOT-CAUSED + fixed 2026-08-08 (the ACTUAL Murali mechanism):** heartbeat data proved the phone was ONLINE all afternoon (heartbeats every few min, `is_connected=true`) yet GPS upload froze at 13:46 with `queued_point_count` climbing 0→27+ and `last_successful_sync` stuck. Cause: `kickSync()` guards with a module `flushing=true` (try/finally resets only on throw), but `apiFetch`'s abort timeout covered only `fetch()`, NOT `await res.json()` — a stalled response body hung forever, wedging `flushing=true` permanently; later GPS flushes hit `if (flushing) return` while `AppState`-active heartbeats (outside the guard) kept flowing and masked it. Cleared only on next-morning restart. Fix (plain JS, testable): (1) `api.ts` — keep the AbortController armed through `res.json()` in `apiFetch`+`apiUpload`; (2) `sync.ts` — stuck-guard watchdog: `kickSync` force-passes if `flushing` has been set >90s (`flushStartedAt`/`FLUSH_STUCK_MS`). A already bypassed this via native upload; D fixes the JS fallback so it can't silently die.

**A + C + B + D are BUILT (tsc + 113 mobile tests pass) but NOT committed. A + B are native/config-plugin → need a new EAS APK; C + D are plain JS (testable / OTA-able). NOT yet proven on-device.**

**How to re-verify after the APK ships:** re-run the recorded_at-vs-created_at lag query per user; Murali's median lag should drop from ~17h to seconds. Related: [[project-tracking-screen-off]], [[project-7pm-cutoff-checkin]], [[project-shared-account-logout-bug]].

---

## project-tracking-screen-off.md

---
name: project-tracking-screen-off
description: "Android background-location gotchas solved during 2026-07-21 field debugging (screen-off pings, indoor fixes, permission reporting)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 327fa338-d598-4d60-a89b-b1689f48ddbe
  modified: 2026-07-21T05:22:46.109Z
---

Live field-debugging of SE background GPS tracking on 2026-07-21 (stock Android, EAS APK v8/versionCode 8) surfaced four non-obvious native gotchas. All fixed and verified in production (session 52ac0ce0 Vishnu vardhan: 3 stationary points at identical coords during a confirmed screen-off window).

1. **Screen-off freeze — the big one.** `Handler.postDelayed` is scheduled on CPU *uptime*, which FREEZES when the screen turns off and the CPU deep-sleeps, so the poll only fired when the screen was on. A foreground service keeps the *process* alive but does NOT keep the *CPU* awake. Fix: drive the periodic poll with `AlarmManager.setExactAndAllowWhileIdle(ELAPSED_REALTIME_WAKEUP,...)` (wake-up alarm, honored in sleep/Doze), re-armed each fire via an `ACTION_POLL` self-intent (`ForegroundLocationService.kt`).

2. **Indoor null fixes.** `getCurrentLocation(PRIORITY_HIGH_ACCURACY)` waits for a GPS lock and returns **null** indoors → no point. Every real fix in this environment is ~100 m network accuracy. Use `PRIORITY_BALANCED_POWER_ACCURACY` (network/wifi) + `lastLocation` fallback.

3. **Passive updates stop when stationary.** `requestLocationUpdates` alone goes silent with no movement; you must *actively* pull a fix each interval (the alarm-driven `getCurrentLocation`), not just wait for callbacks.

4. **Background permission false-alarm.** expo `getBackgroundPermissionsAsync()` returns `"undetermined"` even after the user grants "Allow all the time" — and it doesn't matter: the foreground service tracks fine with only foreground permission. The API freshness classifier (`apps/api/src/services/tracking.ts` `classifyTrackingFreshness`) must NOT treat background-not-granted as `permission_missing` (only foreground denial is a real blocker), and must be heartbeat-aware (a reachable phone with a stale GPS fix is `locating`, not `tracking_interrupted`). See [[project-admin-dashboard]].

**How to apply:** for any future mobile background work, wake-up alarms (not Handler/JS timers) are mandatory for screen-off periodicity; battery optimization must be Unrestricted to avoid Doze throttling the alarms; test with the screen genuinely OFF (screen-on masks the bug). Commits: 3ddc2e9 (classifier), d1bacc9 (wake alarm), fa77d11 (BALANCED), ca66576 (active poll), 7a1aa91 (heartbeat-aware).

---

## project-url-flatten.md

---
name: project-url-flatten
description: "Removed the /dashboard URL prefix — pages moved to a route group, role-neutral / home"
metadata: 
  node_type: memory
  type: project
  originSessionId: efc146e4-3072-4418-b423-544f183ed7d7
  modified: 2026-08-21T19:23:54.083Z
---

2026-08-21: **Removed the `/dashboard` URL prefix** from the web app (user disliked it). UNCOMMITTED, needs web+api deploy.

- **Route group:** renamed `src/app/dashboard/` → `src/app/(dashboard)/` (parens = route group, groups files but adds NO URL segment). So `/dashboard/customers` → **`/customers`**, `/orders`, `/collections`, `/kpis`, etc. Same directory depth, so relative imports unchanged.
- **Role-neutral home:** the per-role landings (`/dashboard/{super-admin,manager,accountant}`) were DELETED and merged into `src/app/page.tsx` (`/`), which renders the dashboard from the session role (SA/Manager → `DashboardExperience`; Accountant → `KpisOverview`). Deleted the old `(dashboard)/page.tsx` redirect-index (it collided with `/`). `dashboardForRole`/`ROLE_DASHBOARD` (auth-role.ts), `ROLE_HOME` (dashboard-shell.tsx), and nav `dashboardHref` all now return `/`.
- **Users & Teams moved:** `(dashboard)/super-admin/setup` → `(dashboard)/settings/users` → URL **`/settings/users`** (nav href updated; `/dashboard/settings` avatar link → `/settings`).
- **Bulk update:** ~166 absolute route strings across ~60 files changed `/dashboard/x`→`/x` and bare `/dashboard`→`/`. CRITICAL: EXCLUDED `src/features/dashboard/*` — those `/dashboard/...` are **API endpoints** (`/dashboard/metrics`, `/dashboard/analytics/*`, `/dashboard/sku-analytics`, `/dashboard/${roleSlug}`) that MUST stay; also the API's own `v1.route("/dashboard", dashboardRoutes)` namespace stays. Only matched quote/backtick-prefixed absolute paths so module import paths (`features/dashboard/...`) weren't corrupted.
- **Redirects:** `next.config.ts` `redirects()` maps old `/dashboard/*`→`/*` (307), with specific rules first (`/dashboard/super-admin/setup`→`/settings/users`; `/dashboard/{role}`→`/`; `/dashboard`→`/`).
- **API deep-links:** notification/alert `url:` fields in `apps/api` (visits.ts `/tracking`, collections.ts `/collections`, orders.ts `/orders`) updated off `/dashboard/*`.

**Bug found+fixed during Manager E2E (2026-08-21):** the moved Users&Teams page (`(dashboard)/settings/users/page.tsx`) had NO role gate — it relied on the nav hiding it, so a non-SA hitting `/settings/users` directly 500'd (SA-only setup fetch → 403 → SSR throw). Added `requireSessionRole()` + `if role !== SUPER_ADMIN redirect(dashboardForRole)` (→ `/`), matching the other SA-only pages. Verified: Manager now redirects to `/` (200).

**2 more stale-redirect bugs fixed during Accountant E2E (2026-08-21):** (a) `kpis/page.tsx` still redirected Accountant to `/accountant` (deleted landing → 404) → changed to `/`. (b) `super-admin-setup.tsx` breadcrumb `href="/super-admin"` (deleted landing → 404) → changed to `/` ("Dashboard"). Root cause: the bulk replace turned `/dashboard/{role}` → `/{role}` but those role landings were deleted (folded into `/`). NOTE: the `/super-admin/*` strings in `features/super-admin/*` (users/teams/territories/setup) are API endpoints (apiRequest/serverApiFetch) — correctly preserved, NOT web routes.

Verified live (logged in SA): `/` renders dashboard; `/customers`, `/settings/users`, `/kpis` = 200; nav hrefs all clean (no `/dashboard`); old `/dashboard/customers`→`/customers` and `/dashboard/super-admin`→`/` redirect + render. tsc clean both apps (cleared stale `.next/types`). NOTE: `apps/web/AGENTS.md` still documents the old `src/app/dashboard/<name>/page.tsx` convention — stale, update when convenient.

---

## project-url-list-state.md

---
name: project-url-list-state
description: "Shared useTableUrlState hook mirrors list filters/sort/page into the URL so Back restores the filtered view (Customers, Orders, Collections)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 83399742-4811-416d-a6a9-2c186cf7bcab
  modified: 2026-08-04T11:21:41.635Z
---

2026-08-04: Fixed the "Back button loses my filters" complaint (enterprise UX). List pages kept filters/sort/page in local `useState`, so navigating into a detail route and pressing Back remounted the list empty. Fix = **URL is the source of truth**.

**New shared hook:** `apps/web/src/components/data-table/use-table-url-state.ts` — `useTableUrlState({ filterKeys, defaultSort, pageSize? })` returns `{ filters, setFilter, setFilters (batch, for Apply buttons), clearFilters, hasFilters, sorting, setSorting, pagination, setPagination }`. Reads state from `useSearchParams`; writes with `router.replace({ scroll:false })` so filtering/paging never pollute history — only the row-click `router.push` adds a Back target. URL params: the filter keys + `sort`/`dir`/`page`.

`usePagedTable` gained optional controlled `sorting`/`onSortingChange`/`pagination`/`onPaginationChange` (backward-compatible; when both sort+pagination are passed it's fully controlled and skips its internal page-reset — the URL owner drops `page` on filter change).

**Migrated (the only 3 lists that `router.push` to a separate detail route, where Back-loss bit):** Customers, Orders, Collections. Pattern per page: filter keys = the API's param names; local search box stays `useState` seeded from `url.filters.search`, debounced into `url.setFilter("search", …)`; instant filters call `setFilter`; Apply-style (Orders) calls `setFilters` batch; single-day date stored as one `date` param mapped to `fromDate==toDate`. Deep-links (`?customerId=`, `?status=pending`) are now read natively by the hook (Collections dropped its `initialStatus` seeding).

**NOT migrated (no route change → filters already survive):** Invoices (row opens a PDF), Alerts/Tasks/Expenditures/Audit-Logs (in-page dialogs/drawers).

Verified E2E (filter → open detail → Back restores exact view, incl. page number). Web-only change, no API/migration. See [[project-section-badges]] for the other lists-UX work.

---

## project-user-management.md

---
name: project-user-management
description: "Super-Admin user editing + set-password, and Setup renamed to \"Users & Teams\" in the sidebar (2026-07-24)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8edc5668-998c-4acd-b68d-d2f6046de98e
  modified: 2026-07-24T10:57:40.361Z
---

Super-Admin user management shipped 2026-07-24.

**Passwords are PBKDF2 hashes and can NEVER be read back.** The user originally asked to "see each user's password"; that is mathematically impossible without storing plaintext, which was explained and rejected. The agreed replacement: Super Admin **SETS** a new password (types one or clicks Generate), sees it **once** on screen to hand over, and only the hash is stored. `POST /super-admin/users/:id/password` — blank body generates a strong one. **Blocked (403) against another SUPER_ADMIN** so admins can't lock each other out; the "Set password" button is hidden for SUPER_ADMIN rows.

**Editing:** `PATCH /super-admin/users/:id` changes `name`, `email`, `phone`, `status` only. **Role is deliberately not editable.** 409 if email/phone clashes with another user.

**Delete** (`DELETE /super-admin/users/:id`, added on request right after the first build): permanent, but only for accounts with **no history**. 44 of the FKs on `users` are NO ACTION, so any order/collection/visit/customer blocks it → 409 saying to set the user inactive instead. Roles + user are deleted in ONE `sql.transaction([...])`; `user_roles` is itself NO ACTION so it must go first, and without atomicity a failed delete would strip a live account of its roles. 403 on self-delete and on any SUPER_ADMIN target.

**Account reuse is the handover model — decided with the downside understood.** When an SE leaves, the Super Admin edits the departing person's account (new name/phone/email + new password) and gives it to the replacement. I flagged that all historical orders/collections/visits stay bound to the same user id, so past work then shows as the NEW person's — and that a cleaner alternative was a fresh account plus a customer-transfer action. The user chose reuse anyway. Don't re-raise it unprompted; do keep it in mind when anyone questions SE performance history.

**Nav:** the old Setup page (`/dashboard/super-admin/setup`, route unchanged) is now **"Users & Teams"** in the sidebar under **Configure**, SUPER_ADMIN only. The "Organisation Setup" shortcut card was removed from the Settings page.

**Testing trick that worked:** `POST /auth/login` accepts SUPER_ADMIN (see the `roles` set in `routes/auth.ts`), so an end-to-end check is possible by inserting a temporary SUPER_ADMIN straight into the DB with a hand-computed hash — `pbkdf2:<hexsalt>:<hexhash>`, PBKDF2-HMAC-SHA256, **100_000 iterations, 32-byte key** (constants in `lib/password.ts`). Python: `hashlib.pbkdf2_hmac('sha256', pw, salt, 100000, 32)`. Everything was verified live this way on 2026-07-24 (edit, 409 on duplicate email, set-password then actually logging in with it, generated password, delete-clean-user, delete blocked for a user with history with roles intact, 403 on Super-Admin and self delete) and the temp account was deleted afterwards. **Always delete the temp admin when done.** The SA-side UI itself still needs the user's own eyeball — the browser session available here is Accountant.

---

## project-vardhan-maps.md

---
name: project-vardhan-maps
description: "vardhan-maps — a separate open-source npm package (India map: state + district GeoJSON + SVG/Leaflet/React renderers) at ~/Desktop/vardhan-maps, NOT part of the Beyond monorepo."
metadata: 
  node_type: memory
  type: project
  originSessionId: d3263dfe-4b4d-4693-9943-aeae9bd6afa4
  modified: 2026-09-11T09:40:08.236Z
---

**Separate open-source project, started 2026-09-08.** Lives at **`/Users/vishnuvardhan/Desktop/vardhan-maps`** — a brand-new standalone git repo (`main`, 1 local commit `183398f`, **NOT pushed**, no GitHub remote yet). It is NOT part of the Beyond-Distribution-Management-System monorepo; don't confuse the two.

**What it is:** an npm package `vardhan-maps` — a "standard India map" (state + district boundaries) as GeoJSON **data** + optional renderers, built on OpenStreetMap. Grew out of the Beyond dashboard OSM map ([[project-dashboard-osm-map]]).

**Decisions (locked with user):**
- Single package, **subpath exports**: `vardhan-maps/data`, `/svg`, `/react` (+ main entry = types only, no data payload). Built with **tsup** (ESM+CJS+dts).
- Rendering **both/configurable**: dependency-free **SVG** (`renderIndiaSvg()` → string, plus React `IndiaSvgMap`) AND **Leaflet** (`IndiaLeafletMap`, leaflet lazy-imported optional peer dep, OSM tiles). `IndiaMap` dispatches on `mode="svg"|"leaflet"`.
- Borders: **Official Government of India** depiction, sourced as **"OSM base + patch disputed areas"** (J&K, Ladakh, Arunachal) via editorial override GeoJSON in `data/overrides/<slug>.geojson` applied by `scripts/lib/patch.mjs`. Documented as an APPROXIMATION, not an official/survey map (ATTRIBUTION.md).
- License: **MIT** (code) + **ODbL** (OSM-derived data, © OpenStreetMap contributors).

**Structure:** `src/{index.ts, data/, core/geo.ts, svg/, react/}`; `scripts/{fetch-osm.mjs (Overpass admin_level=4/5 + osmtogeojson), build-data.mjs, lib/{rdp.mjs,assign-state.mjs (centroid PIP),patch.mjs}}`; data in `src/data/generated/{states,districts,meta}.json`.

**STATUS = v0.2, full-India data, PUSHED to GitHub.** Remote = **https://github.com/Vardhan-Systems/vardhan-maps** (org Vardhan-Systems, public, MIT). Commits: `183398f` scaffold → `53f8579` full data → `f477727` closed district holes. Ships **all 36 states/UTs + 787 districts** from OSM, **`meta.goiBordersPatched=true`**. `pnpm typecheck`+`build` clean; proofs in `examples/` (india-full.svg 823 paths). **Publishing to GitHub done; npm publish NOT yet.** Push works via stored git creds (`git push origin main`); user authorized pushing.

**Closed the UP/Assam/Delhi/Chandigarh district holes (commit f477727):** the earlier "holes" were **transient Overpass rate-limit failures during the big run, NOT an admin-level mismatch** — `scripts/probe-levels.mjs` confirmed all districts sit at **admin_level=5** (UP 75, Assam 35, Delhi 13, correct names; L6=tehsils/"(Pt)" parts, L7=0). Fix = delete those states' stale/empty per-state cache files + re-run the resumable `fetch-osm.mjs districts` (only re-fetches missing). Also: (1) removed **"Rangpur Division" (Bangladesh, id 3921211)** which leaked into the India admin_level=4 area query — dropped from `states-index.json`; its bogus districts were most of the 8 unmatched orphans (now 1). (2) **Fixed a dedupe bug:** districts were deduped by name ALONE → wrongly collapsed same-named districts across states (Aurangabad, Hamirpur, Pratapgarh…); now assign state first, dedupe by `name|state`.

**Every district assigned, 0 unmatched (commit `ff1b185`):** the last orphan (Uttar Dinajpur, WB — concave state, vertex-avg centroid fell outside the simplified polygon) fixed by switching district→state assignment to a **guaranteed-interior `pointOnSurface`** (longest interior chord at the ring's mid-latitude) + `stateByVertexMajority` fallback (in `scripts/lib/assign-state.mjs`). Districts nest in states, so an interior district point always resolves right. Per-state counts now match reality (UP 75, MP 55, Rajasthan 41, Bihar 38, TN 38, Telangana 33, WB 23, Delhi 13, Chandigarh/Lakshadweep 1). Commits now: scaffold `183398f` → data `53f8579` → holes `f477727` → all-assigned `ff1b185`, all pushed.

**Data pipeline that produced it (all raw dumps gitignored under data/raw/):**
- States: Overpass `area(3600304716 = India)` admin_level=4 → 37 relations (drop "Rangpur Division" = Bangladesh) → dedupe-by-name-keep-largest → 36.
- Districts: fetched **per-state** (`area:3.6e9+relId` admin_level=5), **resumable** (per-state cache `data/raw/districts/<id>.geojson`, skip if present) with **3 Overpass mirror fallback** (overpass-api.de rate-limits after ~20 states → rotate to kumi.systems). 669 districts, centroid→parent-state PIP assignment (~8 border/island ones unassigned).
- **GoI overrides** (`scripts/make-goi-overrides.mjs`, dep `polygon-clipping`): Nominatim `polygon_geojson` for Azad Kashmir / Gilgit-Baltistan / Aksai Chin, **unioned** onto OSM J&K/Ladakh → `data/overrides/{jammu-and-kashmir,ladakh}.geojson`. Verified bbox reaches ~37°N/80°E (full crown). Arunachal already India in OSM (no override). `DISPUTED_STATES=[J&K,Ladakh]`.

**(RESOLVED 2026-09-08 — see f477727 above.)** Earlier belief that UP/Assam/Delhi needed a per-state admin-level mapping was WRONG; they were just failed fetches. All districts are level 5. Only remaining gap: ~1 border district unassigned to a state.

**Multi-resolution + lazy loading + ESM-only (commit `219f5a1`, pushed).** Pipeline now emits TWO resolution tiers (`low` 0.01° default/eager-states, `high` 0.003°) and **one ESM module per state** (`src/data/generated/districts/<res>/<slug>.js` = `export default <FC>`) + a static loader barrel `index.js` (`{slug: ()=>import("./<slug>.js")}`) so esbuild/bundlers **code-split one chunk per state**. Data API: states eager (`states`, low); async `loadDistricts(state,{resolution})`, `loadAllDistricts({resolution})`, `loadStates(res)`, `stateSlug()`, `RESOLUTIONS`, `stateList`; `meta` gained `resolutions`/`defaultResolution` (replaced `simplifyToleranceDeg` in the `DatasetMeta` type). `renderIndiaSvg` now REQUIRES a `districts` option for district/both levels (throws helpful error otherwise); React `IndiaSvgMap`/`IndiaLeafletMap` auto-load districts + take a `resolution` prop. **Package is ESM-ONLY** (`format:["esm"]`, dropped `require`/cjs from exports) because esbuild code-splits `import()` only for ESM — CJS would inline all 8MB. sourcemaps off. Verified in Node: TG low/high 33 (high more verts), UP 75, loadAllDistricts 787 both tiers, SVG both=823 paths. Gotchas: generated barrel `index.d.ts` imports `../../../types` (3 up); tsc stays fast because the barrel is typed via a hand-emitted `.d.ts` (never reads the 74 data .js). Generated data (74 files) IS committed so the repo builds offline. Version bumped to 0.2.0.

**v0.2 additions (commit `1a83f34`, pushed):** (1) **ISO 3166-2:IN `code`** on all 36 states (ISO_CODES map in build-data; IN-KL/IN-TG/IN-CT/IN-OD/IN-UT etc.). (2) **Hover tooltips** in `IndiaSvgMap` — `tooltip` prop: boolean (name) or `(ctx: TooltipContext)=>ReactNode` custom; floating fixed-position card following cursor; `tooltipClassName` to restyle. Leaflet already had native tooltips. (3) **Tests** — vitest, 21 passing (`test/{data,svg,pipeline}.test.ts`): loaders+resolutions, SVG render+projection, RDP/pointOnSurface/PIP. `pnpm test`. (4) **CI** `.github/workflows/ci.yml` (typecheck+test+build) + `release.yml` (tag `v*` → `pnpm publish --provenance`, needs `NPM_TOKEN` secret). (5) **Runnable demo** `examples/demo/` = isolated Vite app (own pnpm root w/ allowBuilds esbuild) importing the package FROM SOURCE via vite aliases; choropleth → click state → lazy district drill-in + resolution toggle + tooltips. VERIFIED live in browser (tooltip "Madhya Pradesh · IN-MP", MP click lazy-loaded 55 districts). Run: `cd examples/demo && pnpm install && pnpm dev`.

**India-only Leaflet + markers/labels + custom attribution (commit `b8e2d37`, pushed).** User noticed the SVG map has no cities/roads — explained: SVG mode draws BOUNDARIES ONLY (no basemap); cities/roads come from TILES = **Leaflet mode** (`IndiaMap mode="leaflet"`, was never shown in the demo). Then user asked for: India-only, remove red dots, custom attribution (English labels DEFERRED). Delivered: (1) **India-only default in Leaflet** — `lockToIndia` (maxBounds+minZoom) + `mask` (world rect with India punched out, grey #e5e7eb/0.92). Mask needs India's NATIONAL outline → new `src/data/generated/india.json` (a Feature) built by dissolving all states via `polygon-clipping` union in build-data (raw union blows up polygon-clipping "queue too big"; union 0.008°-simplified states instead; drop union artefacts by shoelace AREA ≥0.02deg²; **exclude Lakshadweep** whose OSM admin_level=4 is a big MARITIME polygon that punched a teal sea-hole). Exported `indiaOutline` from data. (2) **Custom attribution**: `attributionControl.setPrefix('<a href=vardhansystems.in>vardhansystems</a>')` + tile attribution `built on top of <a>OpenStreetMap</a>` — removes "Leaflet" text, keeps OSM per ODbL. Props: `attributionPrefix`, `mask`, `maskColor`, `lockToIndia`. (3) **`markers`** (plot own lat/lng points, `MapMarker` type, `onMarkerClick`) + **`labels`** (permanent name labels). Removed sample red pins from demo (kept the feature). (4) **Fixed a React StrictMode double-mount race** in IndiaLeafletMap ("Map container is being reused"/"parentNode" errors) → split into create-once map effect (deferred teardown + `_leaflet_id` guard) + a separate reactive overlay effect keyed on `[ready, level, stateName, resolution, labels, markersKey]`. Verified live in browser: OSM basemap cities/roads, India masked+locked, attribution correct, no artefacts. Demo runs Leaflet mode by default (needs `leaflet` dep + CSS import). **English basemap labels = next TODO** (OSM raster tiles are local-script; need an English-label provider like Carto/MapTiler, or label-free basemap + own labels).

**Attribution REVERTED + demo simplified (commit `55e19b7`).** User changed their mind: keep Leaflet, and REMOVE the vardhansystems/"built on top of OpenStreetMap" branding → restored Leaflet's DEFAULT attribution ("Leaflet | © OpenStreetMap contributors"). Now `IndiaLeafletMap` only calls `setPrefix` when the `attributionPrefix` prop is provided (default = Leaflet's own); `OSM_ATTR` back to standard "© OpenStreetMap contributors". Demo: removed the Mode selector + name-labels toggle (Leaflet mode hardcoded + Resolution selector kept). "Get rid of Leaflet" turned out to mean "remove the Leaflet TEXT/branding I'd added", NOT drop the library — user explicitly said keep Leaflet. English labels still deferred.

**Routes + live-tracking mode (commit `474335f`).** For the Beyond integration goal (user wants to REPLACE both the dashboard Customers Map AND Live Tracking with this lib, publish to npm, add tracking). Added to `IndiaLeafletMap`: **`routes`** (`MapRoute[]` = polylines for GPS trails/delivery runs, color/weight/opacity/label), **`fitTo`** ("india" default-when-locked | "data" = fit to markers/routes ONCE so live position updates don't re-zoom | "none"), **`center`/`zoom`** for manual view. Markers+routes update in place (overlay effect re-draws, keyed on markersKey+routesKey) without re-initialising the map; fit-once via `fittedData` ref. Verified live (green trail polyline + live marker on India map). READINESS VERDICT given to user: (1) for OTHERS — solid v0.2 but must `npm publish` first (not done; guide in README); ESM-only, needs consumer `"use client"` in Next. (2) Beyond LIVE TRACKING — now capable (routes+live mode); integration = rewire app + drop Google Maps key. (3) Beyond CUSTOMERS MAP — capable via building blocks (districtFill/onDistrictClick/markers/tooltips) but NOT drop-in; app must rebuild the dues-heat + customer-dot-popup logic on the lib's hooks; current Beyond map locks to TG+AP vs lib's all-India. Beyond integration itself NOT started (separate large task in the Beyond repo).

**PUBLISHED to npm + Beyond Live Tracking migrated (2026-09-08).** `vardhan-maps` is LIVE on npm (`npmjs.com/package/vardhan-maps`) — user published **0.2.0** then **0.3.0** (npm publish is OTP-gated → user runs `npm publish --otp=<code>`; I cannot). **v0.3.0** added the tracking-parity features: `MapMarker.permanent` (always-on name chip, styled via injected `.vm-chip`) + `MapRoute.showPoints`/`pointColor`/`pointRadius` + per-point `label` (a hoverable dot per GPS ping) + `MapRoutePoint` type. **Beyond Live Tracking is now on `vardhan-maps@0.3.0`** — rewrote `apps/web/src/features/tracking/tracking-map.tsx` to use `IndiaMap mode="leaflet"` (dropped Google Maps + the API key): execs = markers with `permanent` name chips (green fresh / grey stale), selected route = blue polyline with red `showPoints` ping dots (label = IST time on hover), `lockToIndia={false}` + `fitTo="data"` + `stateStyle` outline-only, remount keyed on `routePoints[0].recordedAt + markers>0` so it reframes on exec-selection but not on each 60s poll. VERIFIED live in the Beyond app (Warangal/Suryapet region, chips + red ping dots, no console errors). On branch **`feat/vardhan-maps-integration`**, dep = `vardhan-maps@0.3.0` (clean npm), NOT committed yet. **GOTCHA: Turbopack caches module resolution** — after swapping the dep (npm↔link, version bumps) you MUST kill the web dev server AND `rm -rf apps/web/.next`, else "Module not found: vardhan-maps/react". **Dashboard Customers Map NOT yet migrated** (still custom osm-map.tsx; needs a district-tooltip render-prop + external choropleth in the lib for full parity — future 0.4.0).

**v0.4.0 published + tracking district borders (2026-09-08).** `vardhan-maps` **0.4.0 is LIVE on npm** (user published). v0.4.0 added to `IndiaLeafletMap`: `districtFill`/`stateFill` (per-feature choropleth style), `districtTooltip`/`stateTooltip` (custom hover HTML, `.vm-card` class), `dataKey` (redraw overlay w/o remount), **`stateNames`** (districts for several states), **`boundaryTooltips`** (false = suppress default name-on-hover tooltips), and a CSS fix removing the **SVG focus-outline square** on clicked boundary paths. Beyond bumped to **`vardhan-maps@0.4.0`**. **Live Tracking map now shows grey borders around ONLY customer districts**: `tracking-map.tsx` uses `IndiaMap level="both" stateNames=["Telangana","Andhra Pradesh"] boundaryTooltips={false}` + `districtFill` (customer districts → grey border `#94a3b8`, others hidden) + `dataKey`; `tracking-view.tsx` fetches `/dashboard/map` customers and computes the customer-district set via `districtOf` (imported from features/dashboard/map/district-helpers). VERIFIED live on the real /tracking page: 5 grey-border districts, 4 exec chips, OSM tiles, no "Telangana" tooltip, no square. All on branch **`feat/vardhan-maps-integration`**, UNCOMMITTED. **GOTCHA (again): after any `pnpm add vardhan-maps@x`, MUST kill web dev server + `rm -rf apps/web/.next` + restart, else Turbopack "Module not found: vardhan-maps/react" (stale resolution cache).** Can't verify authed pages when the in-app browser session expires (can't type login creds — safety rule); use a temporary PUBLIC `app/vmtest/page.tsx` rendering the same IndiaMap config, then delete it. Dashboard Customers Map migration still pending (the 0.4.0 hooks now make it feasible).

**v0.6.0 (zero-config vector basemap) then v0.7.0 (`fitKey`) published (2026-09-09).** 0.5.0/0.6.0 = the self-hosted vector basemap ([[project-selfhosted-vector-basemap]]). **v0.7.0 adds `fitKey`** to `IndiaLeafletMap` (Leaflet, `fitTo="data"`): re-frames the data whenever the key changes — **first fit instant, later changes `flyToBounds` smoothly**, and framing PREFERS the routes' extent (a selected trail start→current) over markers; live updates that don't change `fitKey` never move the map. Impl: `lastFitKey` ref + `routeLayers[]` tracked separately + rewritten fit block. **Beyond Live Tracking now on 0.7.0**: `tracking-map.tsx` DROPPED the jarring `key={frameKey}` full-remount and passes `fitKey` → picking a different exec smoothly flies to fit their whole route (start→current); same exec's 60s polls never move it. Also added a framer cross-fade veil (`motion.div` keyed on `selectedUserId`, opacity 0.16→0) on exec switch. **CRITICAL first-click gotcha (found + fixed live 2026-09-09):** do NOT set `fitKey={selectedUserId}` — the route query uses `placeholderData:(prev)=>prev`, so at the instant selection changes `routePoints` still holds the PREVIOUS exec's points; the fit fires against stale data and never re-fits when the real route arrives → "first click doesn't work, second does" (each click flew to the previous exec). FIX: `fitKey = routePoints[0]?.recordedAt` (the day's first-ping timestamp) — stable across polls (first ping never changes), and only changes once the NEW exec's route actually loads (placeholder still = old exec's first ping until then). Purely derived, no ref/state (a `useRef`-latch read in render trips eslint `react-hooks/refs`; setState-in-effect trips `react-hooks/set-state-in-effect`). Verified live: first click on Sandeep/Murali flies to the correct full route every time. Squares fix: both maps get a global CSS rule in `apps/web/src/app/globals.css` — `.leaflet-container .leaflet-interactive:focus:not(:focus-visible){outline:none}` (kills the browser focus rectangle on mouse-click of a district polygon, keeps keyboard focus ring). All on branch `feat/vardhan-maps-integration`, UNCOMMITTED. See [[reference-pnpm-dedupe-tsc-gotcha]] for the install pitfall hit here.

**v0.8.0 — React Native renderer (2026-09-10, BUILT, not yet published).** New subpath **`vardhan-maps/react-native`** → `<IndiaMapNative />`, the native twin of `IndiaLeafletMap`. Full parity: same self-hosted grey vector basemap (the `vectorBasemapStyle()` pmtiles) + India state/district boundaries + outside-region mask + choropleth (districtFill/stateFill) + markers (permanent chips) + routes (per-ping dots) + fitTo/fitKey + lockBounds + press callbacks. **KEY ENABLER:** MapLibre **Native** resolves `pmtiles://https://…` directly from the style JSON (MapLibre Android ≥11.7.0) — NO JS addProtocol needed (that web-only gap was issue #28). So the SAME `vectorBasemapStyle()` (source url `pmtiles://…`, engine-agnostic) drives web (maplibre-gl + JS addProtocol) AND native. Built on **@maplibre/maplibre-react-native v11** (API: `Map`/`Camera`/`GeoJSONSource`/unified `<Layer type= paint=>`; onPress features at `e.nativeEvent.features`; Camera `bounds:[W,S,E,N]`, `padding:{top,right,bottom,left}`, `maxBounds`) + `react-native` — both OPTIONAL peers. Files: src/react-native/{IndiaMapNative.tsx, geometry.ts, types.ts, index.ts}; tsup entry + external added; devDeps @maplibre/maplibre-react-native@11 + react-native@0.86. Per-feature choropleth done the native way: stamp style into GeoJSON feature props (`_lc/_lw/_lo/_fc/_fo`) + read with `["get",…]` expressions. tsc 0, build clean (RN bundle imports only maplibre-react-native/react-native/react + data chunk + vectorBasemapStyle — NO leaflet/maplibre-gl leak), 27/27 tests (6 new geometry tests). Version bumped 0.7.0→0.8.0 + CHANGELOG. REMAINING: user publishes 0.8.0 (npm OTP); then integrate into Beyond mobile SA tracking map (add @maplibre/maplibre-react-native + its expo config plugin, local rebuild, swap apps/mobile/src/components/admin/tracking-map.tsx from react-native-maps/Google → IndiaMapNative). Android-only; iOS untested.

**0.8.0 PUBLISHED + integrated into Beyond mobile SA tracking (2026-09-10, VERIFIED on-device).** User published 0.8.0 to npm. Beyond `apps/mobile`: added deps `@maplibre/maplibre-react-native@^11` + `vardhan-maps@0.8.0`, added `"@maplibre/maplibre-react-native"` to app.json plugins (config plugin), and REWROTE `src/components/admin/tracking-map.tsx` from react-native-maps/PROVIDER_GOOGLE → `<IndiaMapNative>` (level both, stateNames TG+AP, mask, lockBounds region, exec markers blue-selected/green-live/grey-stale with permanent name chips, route with red ping dots, fitTo="data" + fitKey=route[0].recordedAt). Dropped `mapRef`/`fitToCoordinates` from `use-admin-tracking.ts` (map self-fits now). mobile tsc 0. Native rebuild via `expo run:android` (JAVA_HOME=Android Studio JBR, ANDROID_HOME set; maplibre native module compiled, BUILD SUCCESSFUL 2m36s; same debug signature → reinstall kept the session). **VERIFIED live on Pixel_8 emulator**: grey OSM vector basemap renders natively (place labels/roads/water, "MapLibre" attribution), exec markers + name chips, route + ping dots, and selecting a different exec re-fits to their route. `react-native-maps` is now UNUSED (only that map used it) — safe to remove to slim the build. All Beyond mobile changes UNCOMMITTED. See [[project-mobile-super-admin]].

**v0.9.0 (Leaflet marker icons + popups) + v0.10.0 (RN smooth fly) PUBLISHED (2026-09-10/11).** **0.9.0** (Leaflet `MapMarker`): `icon` (HTML/SVG → divIcon, `.vm-icon` box stripped) + `iconSize`/`iconAnchor` + `popup` (click popup HTML, `.vm-popup`) — powers Beyond web Live Tracking's customer dots + visit FLAG markers (see [[project-tracking-customers-visits]]). **0.10.0** (`IndiaMapNative`, RN): re-fit camera now animates with curved **`easing:"fly"`** (MapLibre RN CameraAnimationOptions) by default over **900ms** — RN twin of Leaflet flyToBounds; opt-in `fitDuration?`/`fitEasing?:"linear"|"ease"|"fly"` props; first fit stays instant. Beyond mobile `apps/mobile/src/components/admin/tracking-map.tsx` bumped to 0.10.0 + added a **react-native-reanimated cross-fade veil** (opacity 0.16→0, 550ms, replays on selectedId change — the RN equivalent of the web framer-motion veil; framer-motion is DOM-only). VERIFIED live on Pixel_8: selecting a rep smoothly FLIES the camera to fit their route. vardhan-maps repo UNCOMMITTED (types.ts, IndiaMapNative.tsx, CHANGELOG, package.json). Beyond mobile UNCOMMITTED.

**v0.11.0 (RN ornament toggles) PUBLISHED (2026-09-11) + Vardhan Maps branding on both tracking maps.** `IndiaMapNative` gained pass-throughs `logo?`/`attribution?`/`compass?` → MapLibre RN `<Map>` ornaments (so a consumer can hide the MapLibre wordmark). **T&C basis:** MapLibre is BSD/open — its logo is NOT legally required (unlike Mapbox), so it's safe to hide; but the OSM basemap data is **ODbL → attribution REQUIRED**, so keep `attribution` on. Beyond both maps now show a **"Vardhan Maps" wordmark (blue #1A73E8, → https://vardhansystems.in)** instead of the MapLibre logo: **web** `apps/web/src/features/tracking/tracking-map.tsx` = inline SVG `<a>` bottom-left (no maplibre logo existed on web anyway; OSM "© OpenStreetMap contributors" retained via attributionPrefix=""); **mobile** `apps/mobile/src/components/admin/tracking-map.tsx` = `logo={false}` + a bottom-left `Pressable`+`Text` (react-native-svg NOT a dep → styled Text reproduces the text-only wordmark) → `Linking.openURL`, ⓘ OSM attribution kept. VERIFIED then REVERTED same day: user changed their mind and asked to remove the "Vardhan Maps" text. So the wordmark overlay is REMOVED from BOTH maps — web tracking-map.tsx back to plain (OSM attribution only), mobile tracking-map.tsx keeps `logo={false}` (user chose "no logo at all" → empty corner, ⓘ OSM attribution retained). The vardhan-maps **0.11.0 package stays** (logo/attribution/compass props are additive/opt-in; mobile still on 0.11.0 with logo={false}). Verified live on Pixel_8: no wordmark, no MapLibre logo, ⓘ kept. UNCOMMITTED (both apps + vardhan-maps repo).

**v0.12.0 (RN onRenderComplete) PUBLISHED (2026-09-11) + mobile "reveal map only when loaded".** `IndiaMapNative` gained **`onRenderComplete?: () => void`** → MapLibre `onDidFinishRenderingMapFully` (all tiles/boundaries/markers painted; repeats on re-render, latch first). Beyond mobile `apps/mobile/src/components/admin/tracking-map.tsx`: the map mounts+renders under an opaque grey (#e5e7eb) loader (centered ActivityIndicator); on first onRenderComplete → loader fades out (300ms) revealing the map. 10s fallback so a failed tile load can't stick the spinner. **Also fixed a "two loaders" bug**: the rep strip (tracking-rep-strip.tsx) used to show its OWN ActivityIndicator while execs loaded → two spinners on initial load. Replaced it with **skeleton chips** (grey pills, hold strip height) so the map's spinner is the ONLY loader on the tracking page. mobile bumped to 0.12.0, tsc clean, VERIFIED live (single loader, fly+route+veil workflow intact). NOTE: on TAB RE-ENTRY (screen stays mounted, ready already true) the native GL surface re-inits → brief black→grey flash NOT covered by the gate (only fresh mount is gated) — left as-is (re-gating on focus risks a stuck loader). **WEB load-gate still PENDING** (earlier goal: "only open map when loaded" on web too — needs an IndiaLeafletMap load callback → another package version).

**v0.13.0 (WEB onRenderComplete) PUBLISHED (2026-09-11) + both web maps "reveal only when loaded".** `IndiaLeafletMap`/`IndiaMap mode="leaflet"` gained **`onRenderComplete?: () => void`** → fires on the maplibre-gl **`idle`** event (vector) or the raster tile layer's `load`. Web load-gates (basemap fully rendered → fade in, 10s fallback, NO min-time): (1) **Live Tracking** `apps/web/src/features/tracking/tracking-map.tsx` — MapLoadingOverlay + AnimatePresence, `onRenderComplete={()=>setReady(true)}`; only the MAP is gated (exec list stays live). (2) **Dashboard Customers Map** `apps/web/src/features/dashboard/map/*` — custom Leaflet map (NOT IndiaMap): hooked idle in `use-osm-map-init.ts` via the returned maplibreGL layer's `getMaplibreMap().once("idle")` (onReadyRef so the create-once effect doesn't re-run) → `osm-map.tsx` forwards `onRenderComplete` → `dashboard-map-section.tsx` replaced the old MIN_LOADING_MS gate with `mapRendered`. web bumped to 0.13.0, tsc clean, **VERIFIED LIVE in-browser both maps** (loader "Loading map…" → fade to rendered map, OSM attribution kept). GOTCHA hit again: after `pnpm add vardhan-maps@x` MUST kill web dev server + `rm -rf .next` (Turbopack stale resolution). Verified authed pages by having the USER log into the in-app browser (can't type creds). All 3 maps (mobile + both web) now gate on completely-loaded.

**v0.14.0 (fix: zero-size-extent fit crash) PUBLISHED (2026-09-11).** BUG: selecting a STATIONARY rep on Live Tracking (all GPS pings at one coord → e.g. Vishnu Vardhan Vankayalapati, "0 km / 1 accepted point") threw a cascade of **`Invalid LatLng object: (NaN, NaN)`** (Leaflet LatLng.js→unproject→_limitCenter→_panInsideMaxBounds) and the map never navigated. ROOT CAUSE: `L.featureGroup(targetLayers).getBounds()` on all-identical points = zero-size bounds; `fitBounds`/`flyToBounds` then computes a NaN zoom→NaN centre, and the maxBounds guard throws ASYNC in the `frame` callback (so the fit's try/catch didn't catch it). FIX (both renderers, IndiaLeafletMap fit block + IndiaMapNative camera): if `bounds.getSouthWest().equals(getNorthEast())` (RN: `w===e && s===n`) → centre on the point at zoom 15 (`setView`/`flyTo`, RN center+zoom) instead of fitting a bounds; non-degenerate fits also cap `maxZoom:16`. Also guarded `bounds.isValid()`. Web+mobile bumped to 0.14.0, tsc clean. VERIFIED live in-browser: stationary rep now centres at street zoom (no NaN), multi-point reps (Murali/Sandeep) still fit their route normally, zero console errors. ALSO VERIFIED on the mobile SA tracking map (Pixel_8): the NATIVE renderer did NOT crash pre-fix (MapLibre robust, no logcat FATAL) but OVER-ZOOMED past the tile limit → blank grey basemap with a floating dot; 0.14.0 centres the stationary rep at street zoom with full tiles. So the bug's mobile symptom = blank grey map (not a crash). GOTCHA again: bumping the dep needs web dev-server kill + `rm -rf .next` (Turbopack "Module not found: vardhan-maps/react" stale-cache errors appear transiently during the rebuild, then clear).

**PUBLISHING (user asked how — NOT yet published to npm):** `prepublishOnly` runs `pnpm build`; `publishConfig.access=public`. Check name free: `npm view vardhan-maps version` (404 = free; if taken, rename to scoped `@vardhan-systems/maps`). npm: `npm login` → `npm version patch` → `npm publish` (`--otp=` if 2FA, `--dry-run` to inspect). pnpm: `pnpm login` → `pnpm version patch` → `pnpm publish` (`--no-git-checks` to skip clean-tree check, `--dry-run` to inspect). Both share `~/.npmrc`. I do NOT run publish (user's action).

**Gotchas:** Overpass needs a `User-Agent` header (406 without). pnpm v11 ignores package.json `pnpm` field → `pnpm-workspace.yaml` `allowBuilds:{esbuild:true}`. tsconfig has NO `noUncheckedIndexedAccess` (noisy for coord arrays). Extraction of the original TG/AP sample: those Beyond TS files are object literals w/ unquoted keys → eval as JS not JSON.parse; anchor `=` after `export const`. Full district GeoJSON ~1.4MB, bundled into each of /data,/svg,/react (multi-res + lazy load = v0.2 TODO).

**NEXT:** per-state district-level curation (UP/Assam/Delhi); ISO codes per state; multi-res + lazy; tests + examples site; then GitHub remote + npm publish (user said publishing NOT yet).

---

## project-visit-outcomes.md

---
name: project-visit-outcomes
description: Dashboard Visits drill-down now shows Planned/Unplanned + clickable order/collection outcome chips
metadata: 
  node_type: memory
  type: project
  originSessionId: e0779741-786e-4ffd-b0de-e5dad287996f
  modified: 2026-08-22T05:01:17.046Z
---

2026-08-22: Enhanced the dashboard **Visits drill-down** (Visits card → executive → per-customer visit list; the "Murali — Visits · 22 Aug" modal). Designed as an Artifact first (approved by user), then built.

**What each visit row now shows:**
- **Planned / Unplanned badge** (emerald/amber) replacing the old "Productive/Visit" pill — straight from `visits.planned_or_unplanned` (reliably populated; ~7% planned, rest unplanned).
- **Outcome chips** for productive visits: each **order** (oil litres + bearing pcs) links to `/orders/:id`; each **collection** (₹) links to `/collections/:id`. Multiple listed separately. Non-productive → muted "— No order or collection".

**Key constraint:** there is NO stored FK from a visit to its order/collection (confirmed against prod: orders/collections have no visit_id, visits have no order_id/collection_id; the visit's own `order_taken`/`collection_done`/`productive_visit`/amount columns are ALWAYS 0/null — mobile never sets them). So outcomes are **inferred by same executive + customer + same date** (day-level; two same-day orders both attach). User accepted this ("infer now, maybe store real link later"). Productive-for-display = has order or collection (market-intel photos excluded from the chips, per user).

**Code:** `apps/api/src/services/dashboard-metrics.ts` `agent_customer_visits` query — added `planned` + two `left join lateral` json_agg blocks for `orders` (litres net of oil returns + bearingQty) and `collections` (amount); kept the existing photo-inclusive `productive` flag so the "Productive Visits" CARD count/filter is unchanged. `apps/web/src/features/dashboard/metrics-drilldown-customers.tsx` renders the badge + chips (Next `<Link>`, lucide `ChevronRight`). tsc clean both apps; query validated against prod. **UNCOMMITTED, needs api + web deploy** (local web hits the DEPLOYED api, so chips stay empty locally until api is deployed — see [[project-local-web-uses-deployed-api]]). Artifact mock: claude.ai/code/artifact/ff2d2ef0-b563-478e-9f11-ac527104d696

---

## project-walkin-invoicing-pending.md

---
name: project-walkin-invoicing-pending
description: Walk-in customers for Manual invoicing — DEFERRED 2026-08-06; spec + 4 open questions in docs/PENDING-WALKIN-INVOICING.md
metadata: 
  node_type: memory
  type: project
  originSessionId: 7469d8a9-6262-4dfc-ae8b-be1e151370be
  modified: 2026-08-06T12:55:02.864Z
---

**DEFERRED 2026-08-06** (user: "Lets not do this now, we will do this later"). Manual invoicing should NOT use the regular `customers` table — instead a new **`walk_in_customers`** table with typed **Name/Address/Phone (mandatory) + GST (optional)**, then SKUs/qty/MOP/discount, generate the invoice, store in DB, and show in the invoices table. Nothing built yet.

Key gotchas found: `invoices.customer_id` is **NOT NULL** (must become nullable) and the invoices list **INNER JOINs customers** (must become LEFT JOIN + `coalesce(c.legal_name, w.name)`, else walk-in rows drop). Base to extend = the existing manual-invoice pipeline ([[project-invoicing-build]]): web `manual-invoice-dialog.tsx`/`manual-customer-field.tsx`/`manual-line-add.tsx`, api `manual-data.ts`/`manual-generate.ts`/`invoicing-manual.ts`; per-line MOP+Discount editing already works.

Full spec + the **4 unanswered questions** (Manual scope, SKU catalogue-vs-free-typed, tax/state, storage reuse+view) are in **docs/PENDING-WALKIN-INVOICING.md** — resume there; ask them before building.

---

## project-web-push.md

---
name: project-web-push
description: "Browser Web Push (browser-closed notifications) for office users — VAPID + RFC8291 crypto on Workers, send-on-write, setup + deploy gotchas"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4adfedc6-e5d2-4fac-86b5-afc4863cf55e
  modified: 2026-08-17T12:36:50.147Z
---

2026-08-17: **Browser Web Push** shipped + verified end-to-end on prod. Complements the in-tab [[project-sound-notifications]] (sound + flashing title/badged favicon): now a NEW order/collection/visit reaches office users (SUPER_ADMIN/MANAGER/ACCOUNTANT) even with the **tab closed or browser minimized**. Separate channel from the Expo/FCM MOBILE push (`push_tokens`, `sendExpoPush`).

**Architecture (all live):**
- **Crypto — `apps/api/src/lib/web-push.ts`** (pure Web Crypto, Workers-safe; the Node `web-push` pkg is Node-crypto only and WON'T run on Workers): VAPID JWT (RFC 8292, ES256) + aes128gcm payload encryption (RFC 8291 / 8188). Verified against the **RFC 8291 Appendix A test vector** AND a random-path encrypt→decrypt roundtrip (both in `web-push.test.ts` + were double-checked via scratch scripts). `encryptPayload` takes test-only overrides (asPrivate/asPublic/salt) to reproduce the vector.
- **Service — `services/web-push-notify.ts`**: `vapidFromEnv(env)`, `saveWebPushSubscription` (upsert on endpoint), `deleteWebPushSubscription`, `customerName`, `inr`, and `notifyOfficeWebPush(sql, vapid, {title,body,tag,url}, nowSec)` — fans out to every office-role subscription, prunes rows on 404/410 (gone).
- **Routes — `routes/web-push.ts`** (mounted `v1.route("/web-push", ...)` in index.ts): `GET /web-push/public-key` (returns null if unconfigured), `POST /web-push/subscribe` (office-gated; accepts `PushSubscription.toJSON()` = {endpoint, keys:{p256dh,auth}}), `POST /web-push/unsubscribe`.
- **Send-on-write**: `c.executionCtx.waitUntil(notifyOfficeWebPush(...))` hooked into the create handlers — `routes/collections.ts` (₹amount from customer), `routes/orders.ts` (orderCode · customer), `routes/visits.ts` (customer checked in). Guarded by `vapidFromEnv` + not a replay (`!existing`).
- **Migration `0063_web_push_subscriptions.sql`** (APPLIED): `web_push_subscriptions(id, user_id FK cascade, endpoint UNIQUE, p256dh, auth, created_at)`.
- **Web**: `public/sw.js` (service worker: `push`→showNotification, `notificationclick`→focus/open, skipWaiting+clients.claim); `features/shell/web-push-register.ts` (`enableWebPush`/`disableWebPush`, `urlBase64ToUint8Array`); wired into `sound-notifier.tsx` (`requestNotifyAndPush` on permission-grant, mount effect re-subscribes if already granted, toggle-off → `disableWebPush`). 3 Next proxy routes under `app/api/web-push/*` (cookie→bearer, same pattern as badge-counts).

**Secrets (Cloudflare + local `.dev.vars`):** `VAPID_PUBLIC_KEY` (base64url raw 65-byte point — also client applicationServerKey), `VAPID_PRIVATE_KEY` (base64url raw 32-byte scalar), `VAPID_SUBJECT` (`mailto:support@vardhansystems.in`). Generate via a Web-Crypto P-256 keygen. **The `mailto` is NOT a notification channel** — just a contact-of-record the push service could use to reach the operator; nothing is ever emailed there.

**Gotchas that cost real debugging time (check these first if pushes don't arrive):**
1. **`/sw.js` 404 on the deployed web** → browser can't `register("/sw.js")` → `enableWebPush` silently bails (all failures caught) → 0 subscriptions. Cause was a **stale web build**; a fresh `opennextjs-cloudflare build` DOES copy `public/sw.js` into `.open-next/assets/`. Fix: redeploy web. Verify `curl -sI https://bdms.vardhansystems.in/sw.js` → 200.
2. **API `/web-push/*` → 404** while other routes 401 → the **API worker was stale** (predated the routes). Fix: `pnpm -C apps/api deploy`. Distinguish deployed-vs-missing by 401 (exists, needs auth) vs 404 (not registered).
3. **FCM returns 201 but no notification shows** → the message IS delivered + decryptable; it's **OS-level display**. On macOS: **System Settings → Notifications → Google Chrome must be ON** (site-permission "granted" ≠ OS-allowed). Also check Focus/DND + Notification Center. DevTools → Application → Service Workers → "Push" button fires the SW locally to isolate SW-display from delivery.

**Scope caveat (told to user):** works while the tab is open OR the browser is backgrounded/minimized with Chrome's background process alive; a full Cmd-Q with background apps off queues pushes until relaunch. To send a manual test push to the newest subscription, port `encryptPayload`+`vapidJwt` into a node `.mjs` reading `.dev.vars` (scratch script pattern) and POST to the subscription endpoint (201 = accepted).

---

## project-web-resilience-hardening.md

---
name: project-web-resilience-hardening
description: "Web client/SSR resilience fixes #1–#3 (request timeout, offline-vs-server messaging + banner, SSR bounded retry) from the outage report"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5644a38e-d39f-4927-a4aa-15516eac607c
  modified: 2026-08-21T18:16:03.027Z
---

2026-08-21: Implemented the top 3 recommendations from the web outage-resilience report (artifact 552e7420-2d08-477e-82da-d628e2248873), all in `apps/web`, UNCOMMITTED.

- **#1 client request timeout** — `src/lib/api-client.ts`: `apiRequest` wraps fetch in an `AbortController`, 15s (`REQUEST_TIMEOUT_MS`), abort stays armed through `response.json()`. On abort throws "The server is taking too long to respond…".
- **#2 offline vs server-down** — same catch block: a thrown fetch (`TypeError`) → `navigator.onLine` false = "You appear to be offline…", true = "Can't reach the server right now…". HTTP error responses keep the API's own message. Plus a persistent offline banner: `src/features/shell/connectivity-banner.tsx` ("use client", listens to online/offline events), mounted once in `dashboard-shell.tsx` below the top bar (`sticky top-14`, amber, renders null when online).
- **#3 SSR bounded retry** — `src/lib/server-api.ts`: refactored into `fetchOnce` + retry wrapper. Per-attempt 10s timeout; retries only **idempotent GET/HEAD** (never writes → no double-submit) on a thrown fetch OR 5xx, backoff `[150, 500]` (3 attempts total); 4xx and non-GET are one-shot. NOTE: an aborted fetch is a DOMException (not `instanceof Error`), so `fetchOnce` surfaces its "API is unavailable." fallback on timeout — fine, SSR just hits `error.tsx`.

- **#4 DB-blip auth resilience** — `apps/api`. The auth middleware (`src/middleware/auth.ts`) did a DB profile lookup on EVERY authed request and SWALLOWED errors → a blip silently logged users out (401). New `src/middleware/auth-profile.ts` `resolveProfileResilient(token, query)`: per-token cache (10s TTL, cap 1000, LRU-ish prune), retry-once (50ms), stale-cache fallback bounded to MAX_STALE_MS=60s, else throws `ApiError("SERVICE_UNAVAILABLE", …, 503)`. Added `503` to ApiError status union (`src/lib/errors.ts`). auth.ts refactored so token VERIFY failure still falls through to unauthenticated (401), only DB failure → 503. Composes with #3 (SSR auto-retries the 503) and #1/#2 (client shows the retry message). NOTE staleness caveat: during a real outage a stale profile is served up to 60s, so a revoked session can linger that long — accepted tradeoff vs logging everyone out on any blip.

- **#5 never-drop-writes** — `apps/web`. New reusable `src/components/form/use-form-draft.ts` (`readDraft`/`clearDraft`/`useFormDraft`): debounced localStorage draft under `beyond:draft:<key>`, survives reload/close (only cleared on success or explicit Discard; open+empty drops stale). Wired into the two highest-value flows: collection CREATE (`collections-create-dialog.tsx` — draft key `collection-create:<customerId|general>`, seeds form at mount, "Restored your unsaved entry · Discard" banner, receipt File can't persist so always re-attach) and collection REJECT remark (`collection-reject-dialog.tsx`). Both error banners now say "Your entry is kept — fix and record again" (the manual-apiRequest dialogs already keep input + submit=retry; made explicit). Verify is a no-input confirm, already retry-safe. Live-verified: reload mid-entry → amount+remark restored, banner shows, Discard clears form+draft.

- **#7 health/status monitoring + alerting** — self-hosted, scoped 9AM–9PM IST Mon–Sat. UPGRADED 2026-08-21 to a **Resend-style status page** (per user request, app's LIGHT theme): 2 components (**API, Database** — Web dashboard row was added then DROPPED per user 2026-08-21 to avoid the REPORTS_WEB_BASE_URL dependency + Worker-to-Worker 1042 fetch risk), **90-day single history bar** per component with **Sundays omitted** (Mon–Sat only, ~77 cells; user 2026-08-21), green/amber/red day cells, uptime %, auto-derived tooltips ("No incidents"/"Degraded performance"/"Outage"/"No data"). Pieces: (1) `services/health.ts` `checkHealth` (DB probe, degraded > HEALTH_DEGRADED_MS default 2000, 6s→down); (2) `services/health-history.ts` — R2 rollup store `system/health.json` `{current, days:{YYYY-MM-DD(IST):{comp:{checks,down,degraded}}}, notified}`, 90-day prune, `recordObservations` + `buildStatusSummary` (uptime% = up/total, day cell = worst that day); (3) `services/health-monitor.ts` `runHealthMonitor` on the EXISTING */3 cron (gated `inStatusWindow()`, before maintenance return), `probeComponents` (api=self-ok, database=checkHealth), records history every tick + emails **Resend** on OVERALL status change (worst of components) to **REPORTS_TO**; (4) public API `GET /status-summary` (`routes/status.ts`, live-probes for real-time current + reads R2 history); (5) web `/status` page (`app/status/page.tsx` + `features/status/status-view.tsx`, polls same-origin proxy `app/api/status/route.ts` every 60s, no auth). Old `/health` (503-when-down) + `/api/health` proxy kept (on-demand only, not polled by the page). **FIX 2026-08-21:** `/status-summary` originally ran a live `select 1` on EVERY page poll (every 60s) 24/7 — a Neon cost leak that defeated the 9–9 window. Now gated by `inStatusWindow()`: live-probe ONLY 9AM–9PM IST Mon–Sat; off-hours it serves the last-recorded DB status from R2 with NO DB query (api still self-reports ok). Live-verified off-hours (23:22 IST → Database latencyMs=None, no probe). `/status-summary` also returns `live` (=inStatusWindow); the page footer shows "· last checked HH:MM IST" only when live, else "· outside monitoring hours" (no bogus time when not tracking). Live-verified. `REPORTS_WEB_BASE_URL` is now only the optional "Open the status page →" link in alert emails (no fetch). History bars start grey and fill as the cron records (live-verified rendering via synthetic preview). No new infra/cron/KV — reuses R2 `PHOTOS`. **Alerts are sent to `REPORTS_TO` (same as reports); `RESEND_API_KEY` already set → monitor is ACTIVE. Optional overrides: `HEALTH_DEGRADED_MS`, `ALERT_FROM`.** (ALERT_EMAIL_TO was removed per user request 2026-08-21.) Without RESEND key the monitor no-ops (logs) and /health + /status still work. Status page header reads "Beyond Distribution Management System" / "System Status".

Tests (all pass): `api-client.test.ts` (5), `server-api.test.ts` (6), `components/form/use-form-draft.test.ts` (6), `middleware/auth-profile.test.ts` (6), `middleware/auth.db-outage.test.ts` (1), `services/health.test.ts` (5), `services/health-monitor.test.ts` (7), `services/health-history.test.ts` (3). `tsc` clean both apps; /status live-verified (3 rows + live latency; colored 90-day bars confirmed via synthetic preview). Pre-existing unrelated failures: web 7, api 14 — unchanged by my work.

Deferred report recs #6, #8 still open: #6 Neon tuning (min compute / read replica / API retry-once on transient Neon), #8 offline-with-last-known-data (TanStack Query persistence / SW). Auth code (#4) — a `/security-review` before shipping is advisable. See [[project-web-push]], [[project-reports-emails]] (Resend) for related work.

- **Root error/404 pages (2026-08-21):** the app only had /dashboard-scoped `error.tsx` + `not-found.tsx`, so any unknown URL OUTSIDE /dashboard (e.g. a mistyped `/statuss`) fell to Next's bare black default 404 (seen in prod at bdms.vardhansystems.in). Added branded (light, Beyond wordmark) root `app/not-found.tsx` (login-aware CTA via getAuthToken → /auth/redirect or /login; both self-heal), `app/error.tsx` (non-dashboard runtime errors, reset + Go-to-login), and `app/global-error.tsx` (last-resort, own <html>/<body>, inline styles since globals.css is bypassed). New shared `components/brand-wordmark.tsx`. Also added the wordmark to the two /dashboard boundaries for consistency (all 5 branded pages match). (Briefly added Coming-soon routes for the 3 dead Accountant links, then per user 2026-08-21 REMOVED the Accountant **Outstanding, Pending Verification, Aging, Reconciliation** entirely — deleted `app/dashboard/{outstanding,aging,reconciliation}/page.tsx` + the orphaned `components/coming-soon.tsx`, dropped the 4 nav items + their NavKeys, moved **Reports** into Finance and removed the now-empty "Audit" section. Pending Verification was only a link to `collections?status=pending` — Collections/filter untouched. No `href:"#"` left in any nav.) tsc clean; deleted routes 404 correctly (live-verified). UNCOMMITTED, needs web deploy.

---

## reference-leaflet-overlay-zindex.md

---
name: reference-leaflet-overlay-zindex
description: "App overlays (date-picker popover, Select dropdown, dialog) render BEHIND a Leaflet map because Leaflet's pane/control z-indexes (up to ~1000) escape a non-stacking-context .leaflet-container. Fix: .leaflet-container { isolation: isolate } globally."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 749d7190-55d2-4eb5-aaf4-045985026923
  modified: 2026-09-09T13:15:50.463Z
---

**Symptom:** a shadcn/base-ui Popover/Select/Dropdown opened above a Leaflet map is clipped/hidden where it overlaps the map (e.g. the Live Tracking date-picker calendar's Fri/Sat columns disappear behind the map). The overlay is portaled at `z-50`, yet the map wins.

**Root cause:** Leaflet gives its panes/controls z-indexes up to ~1000 (`.leaflet-pane` 200–700, `.leaflet-control`/`.leaflet-top`/`.leaflet-bottom` up to 1000). `.leaflet-container` is usually `position:absolute` (or relative) with `z-index:auto`, which is **NOT a stacking context** — so those high z-indexes escape to the nearest ancestor stacking context (often the page root) and compete DIRECTLY with app overlays at `z-50`. 1000 > 50 → the map paints over the overlay. Confirm with `getComputedStyle(document.querySelector('.leaflet-container')).isolation` (`auto` = leaking) and `document.elementFromPoint(x,y)` at the overlap (returns a `.leaflet-*` node = map on top).

**Fix (applied 2026-09-09, global, in `apps/web/src/app/globals.css`):**
```css
.leaflet-container { isolation: isolate; }
```
`isolation:isolate` makes every map its own stacking context, so its internal z-indexes stay contained (map layering unchanged) and can't escape to beat body-level overlays at `z-50`. One rule fixes it everywhere — Live Tracking, dashboard Customers Map, any future map — and keeps the app's `z-50` overlay convention (dialog/select/popover all `z-50`) intact. Do NOT start a z-index arms race (bumping popover to `z-[1100]`); isolate the map instead.

**Gotchas hit while fixing:** globals.css changes need a dev-server rebuild — with HMR disconnected (after a server restart) the CSS won't hot-reload; a full page reload also won't help if the server is wedged. Restart web dev cleanly (`kill :3000` + `rm -rf apps/web/.next` + `preview_start web`) to rebuild CSS. The dashboard Customers Map already worked because its WRAPPER div had `isolate`; the tracking map wrapper didn't — the global `.leaflet-container` rule covers both. See [[project-vardhan-maps]], [[reference-pnpm-dedupe-tsc-gotcha]].

---

## reference-pnpm-dedupe-tsc-gotcha.md

---
name: reference-pnpm-dedupe-tsc-gotcha
description: "After bumping a dep in this pnpm monorepo, a plain `pnpm install` can un-dedupe transitive versions (vitest/@vitest/expect, react-dom) → phantom test-file tsc errors (toBeInTheDocument) masked by tsc incremental cache; fix with `pnpm dedupe`."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 749d7190-55d2-4eb5-aaf4-045985026923
  modified: 2026-09-09T12:04:36.369Z
---

**Symptom:** after `pnpm install` (e.g. following a dep version bump), a full `npx tsc --noEmit -p tsconfig.json` in `apps/web` suddenly reports ~50 errors like `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'` — all in `.test.tsx` files, none in your changed code.

**Cause:** this monorepo (web + expo mobile) resolves multiple transitive versions (e.g. `vitest`/`@vitest/expect` 4.1.9 vs 4.1.10, `react-dom` 19.2.4 vs 19.2.3). A plain install can shift `apps/web` onto a peer-hash variant where the `@testing-library/jest-dom/vitest` `declare module 'vitest'` augmentation of `Assertion` no longer merges with the `Assertion` the tests see → `toBeInTheDocument` missing. `next build` typechecks `**/*.tsx` (incl. tests; no `ignoreBuildErrors`), so this WOULD break a clean build.

**Why it hides:** `apps/web/tsconfig.json` has `"incremental": true` (`tsconfig.tsbuildinfo`). If the last cached state was clean, `tsc` reports 0 without rechecking — so the errors only surface after something invalidates the cache (like an install touching node_modules mtimes). Delete `tsconfig.tsbuildinfo` to see the true state.

**Fix:** `pnpm dedupe` (from repo root) collapses the duplicate transitive versions → augmentation merges again → `tsc` back to 0. This is what the working-tree lockfile already reflected; a fresh `git checkout pnpm-lock.yaml` + install can REGRESS it, so run `pnpm dedupe` after.

**Also:** don't `git checkout pnpm-lock.yaml` to "reset" — the committed HEAD lockfile here produces the un-deduped (broken-types) resolution; the uncommitted working lockfile was the deduped/good one. See [[project-vardhan-maps]], [[project-dev-server]].

---

## reference-text-select-dropdown.md

---
name: reference-text-select-dropdown
description: "Shared TextSelect component for compact fixed-list dropdowns (combobox look, no search) — use it for page filter/category dropdowns"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 8f15dbcf-7895-4d5c-b2e9-05e6df133a0a
  modified: 2026-08-12T08:22:16.348Z
---

`apps/web/src/components/text-select.tsx` — `<TextSelect value options onChange triggerClassName? contentClassName? />` where `options: {value,label}[]`. A **text-only** dropdown styled to match the app's searchable comboboxes (City / Sales-Exec via `@/features/orders/search-select`): same trigger (h-9, border-input, `bg-background`, ChevronsUpDown icon) + a **flush** option list (`p-0` panel → inner `<div class="py-1">`, items `px-3 py-2` no rounding, selected = `bg-primary/10 font-medium text-primary`). No search box — for short fixed lists.

Prefer this over a raw shadcn `Select` for page-level filter/category dropdowns so they match the rest of the app. Wrap in a fixed-width div (e.g. `w-[160px]`/`w-[180px]`); trigger is w-full.

Current users (2026-08-12, web-only, uncommitted): Customers "All dues" filter (`customers-list.tsx`) and Products category switch Oils/Bearings/Filters (`products-catalogue-table.tsx`). Both migrated off plain `Select`; the earlier local `dues-select.tsx` was folded into this shared component. E2E-verified both. Related: [[project-customers-contacts-list]].

---

## project-billing-v2-standard-payments.md

---
name: project-billing-v2-standard-payments
description: "Billing v2 — standard monthly seat-based Razorpay payments (no subscription/mandate): model, access state machine, the on-read charge-creation fix + banner ungating (2026-10-01)"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-01
---

**Billing v2** (replaced the Razorpay subscription/mandate model). This is the
vendor (Vardhan Systems) charging the client (Sri Aparajita) ₹708/active-user/month
for the software — NOT the distributor's own invoicing. Migrations `0089`/`0090`.

**Model — standard one-time monthly Razorpay Orders (no mandate):**
- Each calendar month = one `billing_charges` row. Amount = active-seat count ×
  `UNIT_AMOUNT_PAISA` (70800 = ₹708, GST-inclusive: ₹600 + 18%). Seats counted at
  charge time (`getActiveSeatCount` = all `users` with `status='active'`, any role).
- Paid in-app via Razorpay Checkout (Orders API, `apps/web/.../use-pay-checkout.ts`).
  Razorpay **webhook** (`payment.captured` + `order.paid`) is the source of truth for
  `paid`; `/billing/confirm` only ACKs Checkout for instant UI.
- **Free months are DB-managed** — no app logic. To grant a free month, set that
  month's `billing_charges` row `status='free'` directly (there is no free-first-month
  code, and the `/billing/reset` endpoint was removed).

**Access state machine** (`computeAccess`, pure + unit-tested): `blocked ⟺ now >
paidThrough + 7-day grace`. `paidThrough` = max `period_end` where status in
(paid,free), taken to IST end-of-day. States: free / active / grace / blocked / none.

**`BILLING_ENFORCED`** (`isBillingEnforced` = `env.BILLING_ENFORCED !== "false"`):
ON by default. Gates ONLY the server 402 gate (`billing-gate.ts`, fails open on read
error) + the full-screen hard-block screen. Local `.env` sets it `false` so the app
stays usable while testing (local = LIVE prod Neon DB + live Razorpay keys, see
[[local-dev-uses-live-prod]]).

**2026-10-01 fix (this session) — two real bugs when Sep was set free in the DB:**
1. **No current-month charge until the cron ran.** October's `billing_charges` row is
   created by `ensureCurrentCharge`, which runs in the `*/3` cron. `wrangler dev` never
   fires scheduled crons (so locally the row never existed), and on prod there was a
   morning gap before the cron ran → `access.current` null → no amount, Pay `/pay` → 409.
   **Fix:** `getBillingAccess` now calls `ensureCurrentCharge` on read (idempotent;
   leaves a pre-seeded `free` month untouched), so the amount + Pay button appear
   immediately, cron-independent. The cron KEEPS `ensureCurrentCharge` as a backstop so
   the charge + reminder emails exist even with zero logins.
2. **Grace banner was gated on `enforced`** → invisible on localhost. **Fix:**
   `billing-guard-v2.tsx` `inGrace = state === "grace" && !blocked` (banner is a
   reminder, shows regardless of enforcement); only the hard block + 402 stay gated.

Seat scaling verified live E2E (2026-10-01): added one active user → banner/Pay went
₹708 → ₹1,416 → removed the test user → back to ₹708. `syncPendingCharge` (run inside
`getBillingAccess`) recomputes the PENDING month to the live seat count on every read;
a PAID month is never re-priced (extra seats bill next cycle). Commit `d852518`,
deployed API + web to prod 2026-10-01. Cron `*/3` also runs SE 7 PM tracking auto-stop,
collection dues, notification/error cleanup, and billing reminder emails — do NOT remove
it. See `docs/BILLING-STANDARD-PAYMENT-ARCHITECTURE.md`, `docs/GO-LIVE-CHECKLIST.md`.
Related: [[billing-seat-scaling-razorpay]], [[user-deletion-removed]], [[project-deploy]].

---

## stock-phase2-batch-lots.md

---
name: stock-phase2-batch-lots
description: "Stock Phase 2 = batch/lot inventory (stock_lots, migration 0015) — transfer/adjust manual FEFO pick, invoicing auto-FEFO; +invoice deductions in Recent activity; API 100% lines; DEPLOYED 2026-11-05; demo data left in prod"
metadata:
  node_type: memory
  type: project
---

**Stock Phase 2 — batch-level (lot) inventory** (built + deployed 2026-11-05). Adds a third layer under the SA Stock Journal: ledger `stock_movements` (append-only, truth) → `stock_balances` cache (location+product+pack) → **`stock_lots`** batch cache (migration **`0015_stock_lots.sql`**, APPLIED to prod). A lot is location-scoped with cached `qty_units` (`>= 0` CHECK) + a NULL-safe identity unique index on (location, product, pack, coalesce brand/batch/expiry). `batch_id` added to `stock_movements`; `from_batch_id`/`to_batch_id` on `stock_transfer_items`; `batch_id` on `stock_adjustment_items`. **Invariant: `sum(stock_lots.qty) == stock_balances` per (location, product, pack).** `lotBalanceStmt(sql, lotId, delta)` (stock-shared.ts) writes the signed delta.

**Picking model (locked decision):** Transfer (phase 2b) + Adjust (2c) = **manual batch pick, FEFO default, one lot per line**; transfer carries batch/expiry/shelf to a find-or-created destination lot (web `stock-transfer-grid.tsx` / `stock-adjust-grid.tsx`). Invoicing/sales (2d) = **automatic FEFO auto-split across lots, no picker** (`allocateSaleFefo`/`fefoSplit` in stock.ts; null expiry sorts last; one sale movement per lot). Invoice **edit** recomputes a merged availability (current on-hand + reversal credits) in JS because Neon batch txns can't read post-reversal state; **cancel** reverses via `currentSaleLots`.

**Recent-activity invoice feature:** invoice stock deductions appear in the Stock page's Recent activity — `listInvoiceStockActivity` + `getInvoiceStockLots` services; routes `GET /stock/invoice-activity` + `/stock/invoice-lots`; web `stock-invoice-detail.tsx` drawer. Sale rows (rose) + reversal rows (emerald), generated invoices only, filtered by godown; click opens a per-batch deducted/credited breakdown.

**Gotcha:** Neon HTTP driver has **no bulk-insert helper** (`sql(rows, cols)` is postgres.js only) — lot bulk get-or-create (`ensureLots`) uses parameterized `unnest(${arr}::uuid[], ...)`.

**Status:** phases 2a–2d + the activity feature all built; API **100% line coverage** (1276 tests). 17 SonarQube findings fixed (nested ternaries→if/else, `!lot || lot.x`→split guard, `String(unknown)`→`str()`/object-guard, `!(x>0)`→`<=0`). **DEPLOYED** API + web (latest versions: API `18419c41`, web `367666ad`). Code left UNCOMMITTED (user commits themselves). ⚠️ **Demo data left live in prod** (user chose not to wipe): lots SEED-A/SEED-B, transfer TRF-00001, adjustment ADJ-00001, invoice SA/2026-27/00001 — needs a manual wipe later; remember local dev = live prod DB, so the demo writes hit production. Builds on the SA Stock Journal redesign (migrations 0012/0013/0014). Plan: `docs/STOCK-PHASE2-BATCH-INVENTORY-PLAN.md`. Related: [[neon-http-driver-transactions]], [[local-dev-uses-live-prod]], [[invoice-parser-sa-format]].

---

## web-collapsible-sidebar.md

---
name: web-collapsible-sidebar
description: "Web dashboard sidebar is collapsible (desktop ≥lg) to a 68px icon rail; toggle on right border; cookie-persisted via root-layout provider; ⚠️ cookie-name const must NOT live in a \"use client\" module. COMMITTED 2026-11-05"
metadata:
  node_type: memory
  type: project
---

**Collapsible sidebar** on the web `DashboardShell` (desktop `≥lg` only; the `<lg` off-canvas hamburger drawer is unchanged), built + committed 2026-11-05. Collapsed = **~68px icon-only rail**: labels hidden, native `title` tooltips, section headers (OVERVIEW/MANAGEMENT/CONFIGURE) become thin dividers, Alerts/Tasks count badges shrink to a dot. A **circular chevron toggle straddles the right border**, aligned with the OVERVIEW row. The top-bar **brand header is untouched** (it lives in the top bar, not the sidebar). Transition 200ms ease-out (tried 500ms, reverted).

**Behaviour (final, user-chosen):** the toggle button is the ONLY thing that changes collapsed/expanded. Clicking a nav item just navigates and **keeps the rail as-is** (collapsed stays collapsed). An earlier "auto-expand on navigate" variant was reverted — it read as "won't stay collapsed."

**Architecture / the bug that bit us:** `DashboardShell` (and `SidebarNav`) is rendered **per page, not in the layout**, so it **remounts on every navigation**. State held in its local `useState` reset to the first-load value on each nav (collapse wouldn't stick; cookie/UI drifted). Fix: the collapsed state lives in a **client `SidebarCollapsedProvider` rendered in the ROOT layout** (`app/layout.tsx`), which stays mounted across client navigations; the remounting sidebar consumes it. Seeded from a `sidebar_collapsed` cookie read server-side in the root layout → correct first paint, no hydration flash (SSR HTML carries `lg:w-[68px]`).

**⚠️ Reusable gotcha:** the cookie-name constant must live in a **plain module, NOT a `"use client"` module**. Importing a const from a `"use client"` file into a **Server Component** (the root layout) hands back a client-reference proxy, not the string — so `cookies().get(SIDEBAR_COLLAPSED_COOKIE)` silently looks up `undefined` while `getAll()` still lists the cookie. Hence `sidebar-cookie.ts` (no directive) holds `SIDEBAR_COLLAPSED_COOKIE`; `sidebar-state.tsx` (`"use client"`) holds the provider/hook.

**Files:** `apps/web/src/features/shell/sidebar-nav.tsx`, `sidebar-state.tsx`, `sidebar-cookie.ts` (new), `app/layout.tsx`. SonarQube cleaned (useState pair naming S6754 + `useMemo` the context value S6481). **COMMITTED 2026-11-05** (user); web-only. Related: [[local-dev-uses-live-prod]].

---

## excel-bulk-import.md

---
name: excel-bulk-import
description: "Excel download-template + upload-review bulk import for Products (new products) and Stock-in/Opening (quantities); shared xlsx-io + import-ui; plan docs/EXCEL-BULK-IMPORT-PLAN.md; built+verified, UNCOMMITTED 2026-11-05"
metadata:
  node_type: memory
  type: project
---

**Excel bulk import** — clients download a predefined `.xlsx`, fill it, upload it back (plan: `docs/EXCEL-BULK-IMPORT-PLAN.md`), built 2026-11-05.

- **Products** (new products): one-row-per-pack template (rows sharing Name+Brand merge into one product) + a Reference sheet (valid brands/segments) + example rows (one litres, one quantity). Upload → parse → **review dialog** (validate name, 8-digit HSN, segments, packs) → **Confirm** → new **`POST /products/bulk`** (set-based atomic insert via `unnest`; per-row errors for invalid / dup-in-file / already-in-catalogue). API 100% line coverage.
- **Stock-in & Opening**: template **pre-filled from the catalogue** (`listSkus`) with a **hidden `SKU ID` column** (`productId|packSize`) for exact mapping; stock-in **brand-filtered**, Opening = all SKUs. Upload → parse (blank-qty rows skipped) → review → **Confirm loads valid rows into the existing entry grid** → client Posts. **No new stock API** — reuses `POST /grn` / `/opening`.

**Shared code:** `apps/web/src/lib/xlsx-io.ts` (SheetJS **dynamically imported**; `downloadSheets` w/ hidden-column support, `readSheetRows`); `features/stock/stock-import.ts` (mode-aware builder+parser); `features/products/products-import.ts`; `components/import-ui.tsx` (shared dropzone + summary chips + status badges + 1·2·3 helper — all three dialogs identical).

**UI/UX polish (approved via an Artifact mockup first):** drag-and-drop dropzone, summary chips, status badges + tinted error rows, "Parsing…" state, in-dialog "Download template" link; Products ⋮ menu split into **Bulk import / Export** groups; stock panels got a framed **"Add items"** bar with a scope-aware **Download template · <brand>** pill.

**Import-UI relocation (2026-11-06, user-driven, verified live):** the stock entry screens' framed **"Add items" bar was removed entirely** (product search now sits directly under the Items heading); the page-level **"Download template" button was dropped**; **"Import from Excel" moved into a kebab (three-dot) in the PAGE HEADER** (top-right) -- on **stock-in + opening only** (not transfer/adjust). Wiring: a header-action slot in `stock-entry.tsx` (`onHeaderAction` -> `PageHeader action`); the old `AddItemsBar` became a self-contained `ImportMenu` (Popover kebab) that each panel registers via `useEffect` (useCallback'd onLoad for stable deps). On **stock-in the Import item is disabled** ("Pick a supplier brand first.") **until a supplier brand is chosen**; it re-enables on brand change (React reconciles the re-registered ImportMenu by type at the same slot). The **template download now lives ONLY inside the import dialog** (the ImportSteps link). **Products review dialog:** the Packs column shows pack **SIZES** (`1L, 4L` -- comma-separated, no space before L, **amber**) instead of a count; **MRP/MOP/DLP not shown** (user pref). Files: `features/stock/stock-entry.tsx`, `stock-entry-panels.tsx`, `features/products/products-import-dialog.tsx`.

**Gotchas:** SheetJS community can't write Excel data-validation dropdowns (Reference sheet lists values). The review dialog mounts only when open (it calls `useQueryClient()`) or it breaks provider-less table tests. The desktop **browser pane blocks setting `input.files` programmatically** (and synthetic drop) -- to verify an upload live, copy the `.xlsx` into `apps/web/public/` and `fetch()` it in-page to build a `File`, then delete the temp public file. Verified end-to-end live (no prod inserts -- used existing-name/dup rows). **UNCOMMITTED, web-only, not deployed.** Related: [[stock-quantity-products]], [[stock-per-batch-rate-costing]], [[local-dev-uses-live-prod]].

---

## stock-quantity-products.md

---
name: stock-quantity-products
description: "Piece-sold (unit=quantity) products are now stockable via a pack=1 sentinel shown as 'pcs'; listSkus unions them + returns unit; entry flow done, READ surfaces still show '1 L'. Verified E2E, UNCOMMITTED 2026-11-05"
metadata:
  node_type: memory
  type: project
---

**Quantity (piece-sold) products in the Stock Journal** (2026-11-05). ~7 catalogue products have `unit='quantity'` with **0 packs** (accessories: cloths, spray guns, ceramic coating). The stock pipeline keys on `(productId, pack_size_litres)` which is **NOT NULL** everywhere, so these were previously **unstockable** (excluded by `listSkus`, absent from picker/grids/templates).

**Fix (locked decision):** represent a piece product with a **sentinel `pack_size_litres = 1`**, displayed as **"pcs"** (not "1 L"). `listSkus` now **UNION ALLs** quantity products (synthetic pack=1) and returns `unit`; the web `Sku` type gained `unit`; `packLabel(pack, unit)` (`features/stock/stock-api.ts`) returns `"5 L"` or `"pcs"`. `unit` threaded through `Line`/`TransferLine`/`AdjustLine`/`ImportedStockLine` so the **SKU picker, stock-in/opening/transfer/adjust grids, and Excel templates** all show "pcs". Template "Pack (L)" column renamed "Pack". API `listSkus` 100% line coverage.

**Scope = the ENTRY flow only.** ⚠️ **Read surfaces still show "1 L"** for piece products — stock home On-hand, "Total litres" tile (COUNTS pieces as litres, e.g. 25 pcs → +25 L), Stock lookup, Recent activity, per-godown breakdown, invoice/doc detail — because those queries don't return `unit`. Extending "pcs" there = add `unit` to ~5 read queries + display (deferred).

**Verified end-to-end live** on "Kelvinn Microfibre Cloth" then fully wiped: Opening 25 → Stock-in +10 (merged into the same lot by batch) → Transfer 10 to another godown (batch carried), all at pack=1, flowing through lots/balances/movements unchanged. **UNCOMMITTED, not deployed.** Same work as [[excel-bulk-import]]; remember [[local-dev-uses-live-prod]].

---


## stock-per-batch-rate-costing.md

---
name: stock-per-batch-rate-costing
description: "Per-batch rate on stock_lots (migration 0017, rate IN lot identity) → FEFO COGS on invoices (0018, invoice_items.cogs_amount) → Profitability report (/reports/profit, by invoice/customer/sku/area); rate now MANDATORY on stock-in+opening; stock VALUATION page built then REMOVED; en-rupee stripped from entry screens. Migrations 0016/0017/0018 APPLIED to prod; code UNCOMMITTED 2026-11-06"
metadata:
  node_type: memory
  type: project
---

**Per-batch rate -> COGS -> profit** (2026-11-06). Migrations **0016/0017/0018 APPLIED to prod by the user**; feature code is **UNCOMMITTED, not deployed**. API kept 100% line coverage throughout.

- **Rate MANDATORY (>0)** on BOTH stock-in (GRN) and opening lines -- entry grid (red cell + a "N rows need a rate" gate that blocks Post), Excel import (distinct "Rate is required." / "must be >0" row errors), and API 422 guard (`isPositiveRate` in `services/stock.ts`). Opening lines gained `rate`+`amount` (migration **0016 `opening_stock_rate`**).
- **Per-batch rate on lots** (migration **0017 `stock_lot_rate`**): `stock_lots.rate numeric(12,4)`; the lot-identity UNIQUE index now includes `coalesce(rate,-1)` -> **same batch+expiry at a DIFFERENT rate = a DISTINCT lot** (user choice "separate lot per rate"). Existing lots were **backfilled** from their originating GRN/opening row. `ensureLots`+`lotIdentityKey` carry rate; **transfers INHERIT the source lot's rate** (cost follows goods); positive "found-stock" adjustments stay **unpriced (null)**. FEFO (`fefoSplit`/`allocateSaleFefo`) + `currentSaleLots` now carry each drawn lot's rate. Batch read surfaces (near-expiry table+cards, stock lookup, transfer/adjust batch pickers @rate) show the rate.
- **COGS on invoices** (migration **0018 `invoice_item_cogs`**): `invoice_items.cogs_amount`; at generate AND edit, line COGS = sum(qty x FEFO-drawn lot rate), **NULL when any drawn lot is unpriced** (so "cost unknown" != zero). `lineCogs()` in `services/invoicing.ts`.
- **Profitability report** -- `GET /reports/profit?from=&to=&groupBy=invoice|customer|sku|area`, web page **`/reports/profit`** (linked via a "Profitability" button on `/reports`), service `services/profit.ts`. **Profit = sold (ex-GST taxable) - expense share - COGS.** Expense/unit = ALL period expenditures / ALL units sold where **1 piece = 1 litre** (user chose: period-expenses/units, ex-GST sold price, **generated invoices only**). WARNING: per-litre allocation makes **bulk drums (e.g. 210 L) soak up a huge expense share -> they read as big losses**; flagged to the user as a questionable basis -- **revenue-share was the recommended alternative, deferred**.
- **Stock VALUATION page was BUILT then REMOVED ENTIRELY** at user request: `stockValuation` service, `GET /stock/valuation`, page `/stock/valuation`, and the "Valuation" nav button are all **deleted**. Migrations 0017/0018 were KEPT (FEFO/COGS/profit depend on the columns).
- **Rupee symbol removed** from the Opening + Stock-in **entry** screens and their Excel-import dialogs (headers, row values, summaries) -- scoped to those screens only; rupee still used elsewhere (the profit report uses `rupeesExact`).
- **Products bulk-import review dialog**: the Packs column now shows pack **SIZES** (`1L, 4L` -- comma-separated, no space before L, **amber**) instead of a count; MRP/MOP/DLP are NOT shown (user pref). `features/products/products-import-dialog.tsx`.

**DB state after this session:** the whole **stock journal** (lots/movements/balances/goods_receipts/transfers/adjustments/opening) and **ALL invoices** were **WIPED to zero**; invoice series reset to **#1**; GRN/TRF/ADJ numbering auto-resets (derived from max() of the now-empty tables -- no series table). **KEPT:** 252 products / 487 packs, 2 godowns (**Bachupally** default + **Hayatnagar**), 34 collections. (For testing, 5 generated invoices + 4 expenses were created to verify the profit report end-to-end, then fully reversed via the cancel path + a row purge.) Generating an invoice fires an Expo push to the customer's SE -- can't be suppressed in the generate flow.

Related: [[excel-bulk-import]], [[stock-quantity-products]], [[stock-phase2-batch-lots]], [[oil-segment-canonical-six]], [[local-dev-uses-live-prod]].

---

## product-prices-removed.md

---
name: product-prices-removed
description: "MRP/MOP/DLP DROPPED from product_packs (migration 0019 APPLIED) — the catalogue is pack-SIZE only; the client now enters MRP/DLP/MOP per scenario in the Margin simulator (margin_simulations unchanged). Removed from product create/edit + list + bulk-import template (now 6 cols) + PDF export + the margin product-price prefill. Invoices untouched. API 100% cov, UNCOMMITTED 2026-11-06"
metadata:
  node_type: memory
  type: project
---

**Product pricing removed from the catalogue** (2026-11-06). MRP/MOP/DLP are no longer a property of a product -- the client enters them **per scenario in the Margin simulator**. Migration **0019 `drop_product_pack_prices` APPLIED to prod** drops `product_packs.mrp/mop/dlp` (destructive; old per-pack prices discarded -- user-approved). The code never references those columns anymore, so it worked both **before and after** the drop (no migration-ordering risk, unlike 0016-0018). Feature code **UNCOMMITTED, not deployed**.

- **`product_packs` is now pack-SIZE only.** API: `product-packs.ts` (`PackInput` = `{packSize}`, `packWriteArrays` = `{sizes}`), `products.ts` (PRODUCT_SELECT json drops mrp/mop/dlp; create/update/bulk inserts list only `pack_size_litres`; `mapPacks`/`resolvePackArrays` size-only); the route just passes `packs` through. **`invoice_items.mrp` is a SEPARATE client-typed line snapshot -- UNTOUCHED** (invoice creation never prefilled MRP from the product).
- **Web -- removed everywhere:** `products-types.ts` `ProductPack` = `{packSize, stock*}`; `pack-rows.tsx` is now size chips only (no MRP/MOP/DLP inputs); product-list column "Packs - MOP" -> **"Pack sizes"** (`oil-columns.tsx`); add/edit dialog step "Packs & pricing" -> **"Pack sizes"** (`add-product-wizard.tsx`, `product-dialog.tsx`); the **bulk-import template is now 6 columns** (`Product Name / Brand / Unit / Segments / HSN / Pack Size (L)`) -- `products-import.ts` `BulkPack` = `{packSize}`, parser drops the price cols; the catalogue **PDF export** drops the MRP/MOP columns (`catalogue-export.ts` / `catalogue-export-rows.ts`).
- **Margin simulator:** stopped pulling prices from the product -- `OilProduct.packs` are size-only (`margin-api.ts`) and `margin-entry-dialog.tsx` no longer prefills MRP from the product pack. The simulator's OWN **MRP / DLP / MOP inputs stay** (the client types all three); the `margin_simulations` table and `margin.ts` are unchanged.
- **1290 API tests pass; products + product-packs services 100% line coverage.** Verified live (Products list + Edit dialog show sizes only; Margin table keeps MRP/DLP/MOP). Nothing committed.

Related: [[excel-bulk-import]], [[stock-per-batch-rate-costing]], [[oil-segment-canonical-six]], [[local-dev-uses-live-prod]].

---

## neon-backups-and-privacy.md

---
name: neon-backups-and-privacy
description: "Neon project facts (Launch plan, Singapore, Pg18, 1 member, single production branch = dev hits prod), backups set up 2026-11-06 (7-day PITR + daily snapshots kept 35d + manual baseline; off-Neon pg_dump deferred), and the honest 'can you see my data?' client answer + hardening gaps"
metadata:
  node_type: memory
  type: project
---

**Neon project verified live via MCP, backups configured 2026-11-06.** Project **"Sri Aparajita"** = id `odd-pine-20025067`, org `org-little-term-46132689` (owner vishnuvardhan@vardhansystems.in), region **aws-ap-southeast-1 (Singapore)**, Postgres 18, plan **Launch** (`launch_v3`). ONE project member (owner). ONE branch **`production`** (`br-holy-hat-b3qw1f8w`), ~70 MB, not protected -- confirms [[local-dev-uses-live-prod]] (no dev branch; local wrangler/Next hit prod).

- **Layer 1 -- PITR history window raised 1 day -> 7 days** (`history_retention_seconds` 86400 -> 604800, via `update_project`). Launch max = 7 days; ~$0.20/GB-month, trivial at 70 MB. Restore to any second in the last week.
- **Layer 2 -- daily snapshot schedule** (`set_snapshot_schedule` on the production branch): `{frequency: daily, hour: 20 UTC = 01:30 IST (captures the full business day), retention_seconds: 3024000 = 35 days (the max)}`. Scheduled snapshots auto-expire at 35 days; manual ones never expire. First scheduled run = the night of 2026-11-06.
- **Manual baseline snapshot** taken: `manual-2026-11-06-baseline` (`snap-nameless-hall-b3nsik5w`) -- permanent known-good restore point.
- **Layer 3 -- external `pg_dump` off Neon -- DEFERRED** (user: "later"). The only copy that survives losing the Neon account; weekly dump to user-owned storage (R2/local). It would connect to the LIVE prod DB (read-only); the prod credential must not be committed.
- All reversible. **Tool-shape gotchas:** `get/set_snapshot_schedule` need `branch_id` at the TOP level (not nested under `params`); schedule entries take `frequency` (daily|weekly|monthly), `hour`, `day`, `month`, `retention_seconds` (3600-3024000) -- **NOT** `retention_days`/`retention_hours`.

**"Can you see my data?" -- honest stance.** No hosted provider can promise "never see your data"; the true claim is limited, purpose-bound access. Honestly sayable TODAY: data in its OWN dedicated Neon DB (not shared with other customers), exactly ONE person (owner) has access, encrypted in transit + at rest, host (Neon) is SOC 2 Type II; owner holds the technical keys (unavoidable for hosted software), used only to run/support or when the client asks.

**Hardening gaps (all open) to close before STRONGER promises:** no IP allow-list (`allowed_ips.ips: []`); `block_public_connections: false`; `store_passwords: true` (Neon stores role passwords); no separate dev branch (dev = prod); production branch not protected; no access/audit logs on Launch. To back "network-restricted + access-logged + longer retention + per-distributor isolation" promises, upgrade **Launch -> Scale** (Scale PITR max = 30 days). Re-verify exact per-plan feature boundaries on Neon's pricing page before putting specifics in a signed contract.

Related: [[local-dev-uses-live-prod]], [[neon-http-driver-transactions]], [[mcp-settings-page]], [[billing-seat-scaling-razorpay]].

---

## saas-distribution-os-plan.md

---
name: saas-distribution-os-plan
description: "Distribution OS = plan to turn this single-company app into a multi-enterprise SaaS (full plan in docs/SAAS-PLAN.md); Phase 0 planning ONLY, no code; locked decisions + the shared-DB-vs-DB-per-enterprise isolation tension to re-decide before Phase 2"
metadata:
  node_type: memory
  type: project
---

**Distribution OS** — the plan to turn this single-company system into a multi-enterprise **SaaS**. Full spec = **`docs/SAAS-PLAN.md`** (source of truth; this note = pointer + non-obvious bits). **Status: Phase 0 PLANNING ONLY — do NOT write code.**

**Build approach:** CLONE this whole codebase into a NEW repo/project, rebrand "Sri Aparajita" -> "Distribution OS", owner supplies fresh API keys (Razorpay/Neon/Cloudflare/Neon Auth/EAS/Play/PostHog/maps). The **existing Sri Aparajita deployment stays untouched**. A paying company = an **enterprise** (never "tenant"); isolation key = **`enterprise_id`**. ⚠️ Reverses Hard Rule #6 (no org/multi-tenant scaffolding) — update AGENTS.md Hard Rule #6 in Phase 1 so an agent doesn't "clean up" `enterprise_id`.

**Locked decisions (owner):** one shared app for many enterprises; fully custom price per enterprise (per-seat OR flat, any amount/day); self-serve signup -> owner-approved pending queue -> billable immediately (no trial); email+phone OTP verified at signup; manual monthly Razorpay billing (like today); login = **email OR phone + password, both globally unique** (phone+password is NEW — today email only); one shared mobile app, neutral brand, Play Store, enterprise resolved from login, one OTA for all; per-enterprise read-only MCP scoped to own data; one domain, enterprise-from-signed-in-user (no subdomains); separate owner cockpit on **`admin.`** subdomain (approve enterprises, set prices, view payments, impersonate — all audit-logged), built to grow.

**Phases:** 0 Plan (here) -> 1 Clone & rebrand + wire keys + deploy single-company baseline -> 2 Enterprise foundation (`enterprises` table, `enterprise_id` on ~60 tables + every query, auth carries it, scoped helper + Postgres RLS, email-or-phone login) -> 3 Owner dashboard -> 4 Self-serve signup + OTP -> 5 Per-enterprise billing (`enterprise_billing_config`) -> 6 MCP per-enterprise scoping -> 7 Mobile rebrand + Play Store + fix `runtimeVersion` policy (see [[expo-ota-updates]]) -> 8 Hardening (cross-enterprise leak tests, backups).

**⚠️ ISOLATION MODEL — biggest, hardest-to-reverse decision; flagged for re-decision before Phase 2.** Plan currently LOCKS **shared DB + `enterprise_id` + RLS**. But the 2026-11-06 backup/privacy work ([[neon-backups-and-privacy]]) pulls the other way: "your data = its OWN dedicated DB", per-enterprise PITR/snapshots, competitor-leak fear on FINANCIAL data. Shared-DB+RLS = cheap ops + easy owner cross-enterprise analytics, BUT logical isolation only (one missed filter leaks competitors' data), backups/restore/delete can't isolate one enterprise. **DB-per-enterprise** (shared control-plane DB + one Neon PROJECT per enterprise) = hard isolation + strong privacy story + trivial per-enterprise backup/restore/delete, BUT provisioning automation + migration fan-out across N projects + connection routing + aggregated owner analytics. Owner-approved + custom-priced + manual billing => likely TENS-to-low-HUNDREDS of enterprises (not thousands), where DB-per-enterprise is very viable (documented Neon pattern). Claude raised this 2026-11-06; user interrupted the focus question — decision still OPEN.

**Open decisions (need owner, NOT assumed):** (1) phone-only password reset + which SMS/OTP provider; (2) owner-dashboard staff = just owner or a team later; (3) per-enterprise GST invoicing — manual now, automate later? (main thing that doesn't scale by hand); (4) if/when to migrate existing Sri Aparajita in as an enterprise; (5) final brand assets (web domain, app display name, Android pkg id, logo). **Top risk = data isolation.**

Related: [[neon-backups-and-privacy]], [[local-dev-uses-live-prod]], [[billing-seat-scaling-razorpay]], [[mcp-settings-page]], [[expo-ota-updates]], [[teams-territories-removed]].

---

## billing-v2-webhook-architecture.md

---
name: billing-v2-webhook-architecture
description: "SA billing = one-time Razorpay orders; the webhook is the ONLY paid-flip — VERIFIED FIRING in prod 2026-11-08 (₹1 test: valid sig→200, 2 billing_payment_events rows); BILLING_ENFORCED flipped on + amber blocked-screen overlay CONFIRMED LIVE; Nov 2026 first real month ₹4,248/6 seats still unpaid; remaining deferred: /confirm fallback + reconcile cron + invoice-on-pay"
metadata:
  node_type: memory
  type: project
---

Diagnosed 2026-11-06 with the Razorpay MCP (read-only) + code trace. **User will WAIT for Sri Aparajita's first real payment, then revisit — nothing was changed.**

**How billing works now:** one-time **monthly Razorpay orders**, amount = active-seats × ₹708 (GST-inclusive), `billing_charges` (status `free|pending|paid|void`, unique on `period_start`). **No mandate / not subscriptions** (migrated away from the old e-mandate model that [[razorpay-pause-resume-feature-gate]] / [[billing-seat-scaling-razorpay]] describe). **Paid-flip = webhook ONLY:** `POST /api/v1/webhooks/razorpay` → `applyPaymentWebhook` (only `payment.captured`/`order.paid`) → `recordPaymentEventOnce` (INSERT `billing_payment_events` on-conflict-do-nothing = dedup) → `markChargePaidByOrder` (`where razorpay_order_id=? and status='pending'`). **`POST /billing/confirm` is UI-ONLY** (verifies Checkout signature, does NOT flip). **Invoice-on-payment NOT wired.**

**`billing_payment_events`** (migration 0001: event_id PK, kind, created_at) = webhook exactly-once idempotency. **Empty** (no real payment has ever traversed it) and **redundant today** (`markChargePaidByOrder` is already idempotent via the `status='pending'` guard); it only earns its keep once a NON-idempotent side-effect (invoice numbering, receipt, ledger row) hangs off the webhook — exactly what [[saas-distribution-os-plan]]'s admin cockpit adds.

**Live Razorpay (full account = 11 orders):** seat-billing orders = Oct 2026 `order_TiLqPYzpnvtOjR` ₹708 (unpaid) + Nov 2026 `order_Tvzfr97V6A8fEi` & `order_TuphqUrTDEeRj2` both ₹4,248/6 seats (**both unpaid**). Only captured payments = 3 legacy subscription card charges + 3 tiny QR/UPI tests. **ALL prior activity = testing. Sri Aparajita is the client; first real paying month = Nov 2026, ₹4,248/6 seats, still UNPAID.** The two Nov orders = **user clicked Pay twice, never completed payment** (2nd click regenerated the order via a transient `GET /orders/{id}` failure in `orderIsUsable`); DB points to the newest (`Tvzfr`), `Tuphq` orphaned.

**✅ WEBHOOK VERIFIED FIRING + ENFORCEMENT LIVE (2026-11-08):** Proven end-to-end with a ₹1 self-test — `wrangler tail` showed `Razorpay-Webhook/v1` POSTs to `…/api/v1/webhooks/razorpay` with **valid `x-razorpay-signature` → 200** (⇒ `RAZORPAY_WEBHOOK_SECRET` on the deployed Worker matches the dashboard); dashboard webhook is **Enabled/Live** with `payment.captured`+`order.paid` among its 28 events; `billing_payment_events` gained 2 real rows (`TxgUlkiBECPtwD` payment.captured + `TxgUlxlTODJkwT` order.paid, 12:40:32). **⇒ Risks 1 & 2 ELIMINATED — a paying client auto-unblocks.** `BILLING_ENFORCED` flipped to enforce + the amber blocked-screen overlay **CONFIRMED LIVE on prod** by the user. TODO: refund the ₹1 test.

**Remaining risks (lower):** (3) **stale-checkout mismatch** — paying an older order than the DB's stored one → 0 rows flipped → paid-but-pending (the `/confirm` fallback would cover it); (4) no auto invoice.

**Proposed fix set (NOT done — deferred until after the first real payment):** (a) verify/enable the webhook (user's action); (b) make `/confirm` a **fallback** that also flips `paid`; (c) **reconcile cron** that polls Razorpay order status for `pending` charges (catches missed webhooks + stale checkout); (d) decide invoice-on-payment auto vs manual. This billing code is what [[saas-distribution-os-plan]] **clones into Distribution OS**, so proving/fixing it here de-risks the SaaS build.

Key files: `apps/api/src/services/billing-v2.ts`, `apps/api/src/routes/razorpay-webhook.ts`, `apps/api/src/routes/billing-v2.ts` (`/pay`, `/confirm`), `apps/api/src/lib/razorpay.ts`. Related: [[local-dev-uses-live-prod]], [[billing-seat-scaling-razorpay]], [[razorpay-pause-resume-feature-gate]], [[saas-distribution-os-plan]].

**Enforcement overlay + blocked-screen redesign (2026-11-08 — DONE, LIVE):** Grace/block state machine is CORRECT (`GRACE_DAYS=7`; `accessUntil = paidThrough + 7 days`; grace = 1st–7th, blocked from the 8th). SA billing_charges: Sep free, **Oct free (end Oct 31), Nov pending (6×₹708=₹4,248)** → paidThrough Oct 31 → blocked from Nov 8. **ROOT CAUSE of the earlier "no overlay" bug = `BILLING_ENFORCED="false"` prod SECRET** (not in wrangler.jsonc vars; via `wrangler secret list`). Web shows the overlay only when `hardBlock = enforced && blocked`; `enforced` = `isBillingEnforced(env)` = `env.BILLING_ENFORCED !== "false"` (the grace banner ignores it). **RESOLVED: user flipped the prod secret to enforce (after the webhook was PROVEN above) and confirmed the overlay renders live** — takes effect next request, no redeploy; local `.env` stays `false` (prod-only). To revert for testing, set the secret back to `false`. **Blocked screen REDESIGNED (COMMITTED a9839c0 + DEPLOYED api+web):** `apps/web/src/features/billing/billing-blocked-screen.tsx` → amber card (banner-matched `amber-50`), no icons, reassurance copy, white summary panel (₹4,248 amber), Pay button, support block (Call +91 63048 00595 · vishnuvardhan@vardhansystems.in · 8am–4pm every day, tel:/mailto:) + inert `StaticChrome` backdrop reusing real `buildNavSections(role)` (data-free) behind a frosted scrim; `(dashboard)/layout.tsx` passes `role` via `isWebRole`. Theme-aware, tsc clean, confirmed live on prod.

---

## sales-return-restock.md

---
name: sales-return-restock
description: "Sales returns were LEDGER-ONLY (no stock back) — fixed 2026-11-08 to restock the original sale's lots (migration 0020 + Phases 1-3); also fixes the Recent-activity 'edited invoice shows 2x units' display bug. 100% tested + live-verified, UNCOMMITTED/UNDEPLOYED. Over-return blocked by UI + API caps"
metadata:
  node_type: memory
  type: project
---

Two linked stock fixes built 2026-11-08, **UNCOMMITTED + UNDEPLOYED** (migration `0020` IS applied to prod). In `apps/api/src/services/stock.ts` + `sales-returns.ts` + web `features/stock/*`.

**A. Recent-activity display bug (trigger):** `listInvoiceStockActivity`/`getInvoiceStockLots` summed `abs(qty_units)`, so an EDITED invoice (sale −2, sale_reversal +2, re-applied sale −2) showed **4 instead of 2** (climbed 2→4→6 per edit). Real stock was always correct — display-only. Fix = net the ledger (`-sum` over sale+sale_reversal). Verified live.

**B. Sales returns now RESTOCK (were ledger-only — a real bug):** `createSalesReturn` only wrote `sales_returns` + reduced outstanding; NO stock movement. User confirmed bug; stock goes back to the **original sale's lot(s)** + a **Return row in Recent activity**.
- **Phase 0 — migration `0020_stock_return_movement_kind.sql` (APPLIED):** adds `'return'` to `stock_movements_kind_check` + the `MovementKind` TS union (`stock-shared.ts`).
- **Phase 1 — restock on create:** `allocateReturnRestock` (reverse-FEFO, earliest-expiry still-out lot first, same batch/expiry/**rate**, selling godown); `createSalesReturn` posts a `return` movement (+qty, ref_type='invoice', ref_id=invoiceId, batch_id) + lot/balance increments, same txn. **Generated invoices only** (uploaded never moved stock). `currentSaleLots` now nets `'return'` (fixes latent edit/cancel over-credit).
- **Phase 2 — Return row:** feed groups per (invoice, rowKind) → SALE row (net) + RETURN row (sum of return moves); `getInvoiceStockLots` return drawer; web `stock-journal.tsx` (teal Return badge), `stock-invoice-detail.tsx`, `stock-api.ts`, `routes/stock.ts` (kind=return).
- **Phase 3 — edit adjusts stock by DELTA:** `updateSalesReturn` applies new−old per SKU; `allocateReturnAdjustment` = +delta to still-out lots, −delta pulled from returned lots (latest-expiry first); STOCK_SHORT 409 if returned stock re-sold.

**1299 API tests, 100% lines. Live-verified** (prod-via-local): partial+full restored on-hand to batch 01; Return row+drawer; edit up(+2)/down(−2) tracked on-hand.

**Over-return blocked both layers (verified):** UI disables submit + inline error (outstanding cap) on create AND edit; API `buildReturnLines` → **422** units cap `"only N left to return, X requested"` (checked first) + outstanding cap. Proven via direct API POST bypassing the UI → 422.

**⚠️ Gaps:** deployed prod API still has OLD no-restock returns code → production returns are stock-short until deployed (backfill = none now, 0 shortfall). Direct invoices (no order) are NOT returnable (returns key off `invoice_line_allocations`).

**⚠️ Prod wipe 2026-11-08 (see [[stock-phase2-batch-lots]]):** after this work, user had me delete all invoices/returns/stock-journal + ORD-0019 (kept other 18 orders, collections, customers, SKUs, godowns); invoice_series reset to 00001; stock now zero for all SKUs; recoverable via PITR/snapshots ([[neon-backups-and-privacy]]).

Key files: `apps/api/src/services/stock.ts`, `sales-returns.ts`, `stock-shared.ts`, `routes/stock.ts`; `apps/web/src/features/stock/{stock-journal,stock-invoice-detail,stock-api}`; migration `0020`. Related: [[stock-phase2-batch-lots]], [[stock-per-batch-rate-costing]], [[local-dev-uses-live-prod]], [[neon-backups-and-privacy]].

---

---
name: attendance-holiday-feature
description: "Web attendance grid gained a 'holiday' status — per-cell + company-wide bulk (all active SEs, SUPER_ADMIN-only), plus Sunday auto week-off and a present/total DAYS KPI. Two bugs found & fixed: CHECK-constraint migration 0022, audit entityLabel-not-entityId. DEPLOYED prod 2026-11-09"
metadata:
  node_type: memory
  type: project
---

Attendance **Holiday** feature + Sunday week-off + present/total KPI. Committed `981c14b`, **DEPLOYED to prod 2026-11-09** (API version `19a8783c`, web version `31095d76` at sriaparajita.vardhansystems.in). Migration `0022` applied to prod first (correct DB-before-deploy order).

**What shipped** (web attendance grid, SUPER_ADMIN/MANAGER/ACCOUNTANT view; writes SUPER_ADMIN-only):
- New status **`holiday`** — a company-wide non-working day, markable per cell OR in bulk for every active SE on a date via `POST /attendance/holiday-all` (SALES_EXECUTIVE only, NOT Logistics; set-based single INSERT … ON CONFLICT; overwrite, no bulk undo).
- Grid derivation **work wins**: a worked holiday/week_off (SE has a tracking session that day) displays **Present**, not holiday.
- Denominator: holiday is excluded from the attendance % the same way `week_off` is.
- **Sunday auto week-off** (untracked Sunday → `week_off`, renders as a subtle "·").
- **present/total DAYS** column (e.g. "2 / 3" = present days ÷ working days; working days exclude week_off + holiday).

**Two bugs found & fixed this work:**
1. **CHECK-constraint (feature-breaking)** — original `attendance_status_check` (from migration `0001`) only allowed present/absent/half_day/leave/week_off, so every holiday write 500'd. Fixed by **migration `0022_attendance_holiday_status.sql`** (drop + re-add constraint with all 6). Same class as the billing 'paused' constraint bug. LESSON: adding an enum-like status value always needs a CHECK-constraint migration.
2. **Audit log silently dropped** — the `holiday-all` route passed `entityId: date` ("2026-11-01") into `audit_logs.entity_id` which is **uuid**; `logAudit` casts `${entityId}::uuid` and swallows its own errors in try/catch, so the attendance rows wrote but no audit row. Fixed: `entityId: date` → **`entityLabel: date`** (entity_label is text). For a non-uuid identifier on an audit event, use `entityLabel`, never `entityId`.

Also fixed 2 **SonarQube S6582** (prefer optional chain) in `routes/attendance.ts` (lines 70 & 92): `note && note.trim()` → `note?.trim()`.

Verified end-to-end against prod DB (local=prod): bulk wrote 4 rows for the 4 active SEs, purple "Ho" display, audit row (after fix), per-cell write, work-wins display, denominator unchanged, full revert. Tests: API 1315 passing.

Key files: `apps/api/src/routes/attendance.ts`, `apps/api/src/services/attendance.ts` (`setHolidayForAllSes`, `ATTENDANCE_STATUSES`, grid derivation, `getAttendanceSummary`), `packages/db/migrations/0022_attendance_holiday_status.sql`; web `apps/web/src/features/attendance/*` (attendance-cell-dialog, use-attendance-grid, attendance-grid-row, attendance-stats, attendance-api). Related: [[local-dev-uses-live-prod]], [[se-day-tracking-lifecycle]], [[razorpay-pause-resume-feature-gate]].

---

# Full code + security review of apps/web + apps/api (2026-11-10)

Exhaustive review of **every** source/test/config file in `apps/web` + `apps/api` (~1,400 files) by **18 parallel reviewer subagents** (correctness + security lenses, 6 API partitions + 12 web). Report: **`docs/CODE-REVIEW-2026-11-10.md`**. Outcome: **0 High, 16 Medium, many Low** — no exploitable security holes (JWT EdDSA/Ed25519-pinned, CORS static+bearer, Razorpay HMAC constant-time over raw body, all SQL parameterized).

**All Medium + security + the actionable Low findings + C11/C12 FIXED, tested (API 1321 / web 1670 green), browser-swept (all 22 web pages render clean, no console errors / no error boundaries), and DEPLOYED to prod 2026-11-10** — API version `fb0f8530`, web `e68b2604`. No migration (code only). Commits on `main`, pushed: `eaf47d9` (Med+security), `95980fb` (Lows), `854a907` (C11/C12).

Highlights: **billing webhook settlement made atomic** (idempotency-event insert + charge paid-flip in one `sql.transaction` — a crash between them could previously leave a paying client blocked); `cancelInvoice` payment-guard + `recomputeCustomerBalances`; profit + sku-analytics **exclude cancelled invoices**; order→invoice over-bill seed (`remaining != null ? remaining : qty`); tracking distance + dwell **N+1 loops → set-based `unnest`** (Workers subrequest antipattern, audit G-0401); multi-role auth resolved **deterministically by highest privilege** (was arbitrary `created_at` tiebreak; full capability-union left as a design choice); detail pages (`orders/collections/customers/[id]`) gated by **`requireSectionAccess`** (revoked section blocks detail, not just list); admin `set-password`/`sessions` BFF routes require an explicit **SUPER_ADMIN** app-role check; neon-auth key pinned to **Ed25519**; **date defaults anchored to IST** across all forms + dashboard ranges; market-note create/update **transactional + bulk**; `products.updateProduct` + stock-locations default-flag **transactional**; billing-reminder marker released on send failure; plus many guards (null-km, NaN page/reorder, delete error feedback, dashboard brand-key collision, encoded order deep-link, stable list-debounce deps, incentive/target numeric clamps, MI price/date/media-catch). **C11/C12 (stock display):** product `unit` threaded through the stock read queries (balances, near-expiry, lookup, GRN/transfer/adjustment detail, invoice-lot lines) + mappers + web row types, switching read surfaces to `packLabel(pack, unit)` — piece-sold products (`unit='quantity'`) show **"pcs"** not "1 L", and sub-litre packs (0.037 L) show their exact value not "0.0 L".

Consciously LEFT (documented in the report's Low section): server-enforced client guardrails (credit-note/sales-return amount caps, file size/type, products re-import 409-deduped), cosmetic (skeleton flash, blob-URL revokes, sub-0.5h display), by-design (permanent statement link, two-step collection write), latent/no-caller (lib/format negatives, server-api signal), perf-only (polygon memo), and hardening-only (neon-auth iss/aud binding, not exploitable with the single-project JWKS). ⚠️ **Separately: the in-house Error Monitor (`/errors`) shows ~94 OPEN error groups (391 events, last seen ~1 day)** — pre-existing captured API/web/mobile errors to triage. Memory: [[code-review-2026-11-10-fixes]].

---
