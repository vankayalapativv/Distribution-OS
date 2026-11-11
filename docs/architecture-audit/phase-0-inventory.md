# Phase 0 — Inventory & Map

**Lens:** describe, don't judge. No fixes proposed here (per the playbook, Phase 0 is
observation only). Book principle: *you can't evaluate what you can't see* (Ch. 8, 9); the
"big ball of mud" is the anti-pattern to detect.

Generated 2026-09-20 against the live repo and the live Neon database.

---

## 1. Repository layout (monorepo)

**pnpm + Turborepo monorepo**, single git repo. Workspaces: `apps/*` and `packages/*`.
Three deployables + two shared packages.

| Path | Purpose | Deployable? |
|------|---------|-------------|
| `apps/api` | Hono backend on **Cloudflare Workers** — the REST API (`/api/v1/*`) + a cron handler | ✅ Worker |
| `apps/web` | **Next.js** dashboard for office roles (SUPER_ADMIN, MANAGER, ACCOUNTANT), OpenNext build | ✅ Web |
| `apps/mobile` | **React Native / Expo (SDK 57)** app for field roles (SALES_EXECUTIVE, LOGISTICS) + admin area | ✅ Mobile (Android; iOS config added) |
| `packages/db` | Neon Postgres migrations + seed/setup/health scripts | ⬛ Library/tooling |
| `packages/shared` | Shared TS types/contracts (currently minimal) | ⬛ Library |
| `docs/`, `beyond-distribution-docs/` | Documentation | ⬛ Docs |

**Source file totals** (see [`coverage-ledger.md`](coverage-ledger.md)): api 205 · web 1073 ·
mobile 402 · packages 85 = **1765**.

### Directory purpose map (one line each)

**apps/api/src**
- `index.ts` — Worker entry: `fetch` handler (Hono app), middleware chain, `scheduled` cron handler.
- `routes/` (68 files) — Hono route modules, one per resource; **technical partition**.
- `services/` (100 files) — business logic per resource; SQL lives here.
- `middleware/` (5) — auth (`auth.ts`, `auth-profile.ts`), request context.
- `lib/` (11) — cross-cutting utilities: db client, errors, api-response, authz, request-body.
- `test/` — test setup.

**apps/web/src**
- `app/` (58) — Next.js App Router pages (server components) under `dashboard/*` + `login`.
- `features/` (961, 29 folders) — **domain partition**: one folder per capability (orders,
  customers, collections, invoices, tracking, logistics, …) holding `-api.ts`, list/detail/dialog UI.
- `components/` (35) — shared UI (shadcn `ui/` = 17, data-table, form, shell primitives).
- `lib/` (14) — api-client, format, form, session helpers, basemap.

**apps/mobile/src**
- `app/` (33) — Expo Router routes: `(tabs)` SE, `(logistics)`, `(admin)`, plus stack screens
  (order, collection, customer, dues, invoice, ledger, notes, reminder, settings).
- `lib/` (206) — the bulk: auth, api client, GPS tracking (native + JS fallback), local SQLite
  DB, sync engine, domain hooks — **technical partition**.
- `components/` (154) — screen views and UI, grouped by feature.
- `types/`, `test/` — types + test setup.

**packages**
- `db/migrations/*.sql` (79 migrations) + `index.ts`, `setup.ts`, `seed-dev.ts`, `health.ts`.
- `shared/index.ts` — shared types (thin).

---

## 2. Backend entry points & routes

- **HTTP:** `apps/api/src/index.ts` → default export Hono `app`. Mounted twice: `app.route("/", v1)`
  and `app.route("/api/v1", v1)` (so routes answer both with and without the `/api/v1` prefix).
- **Cron:** `scheduled` handler, trigger `*/3 * * * *` (every 3 min) — runs tracking maintenance,
  missed-beat marking, dues maintenance, report email, notification/error cleanup via `ctx.waitUntil`.
- **Middleware chain (global):** `secureHeaders` → `timing` → CORS → `attachRequestContext` →
  `attachAuthContext`; then per-section `sectionGuard(...)` guards on `v1.use("/<section>/*", …)`.

**Mounted route groups** (`v1.route(...)`, 45 mounts): `me`, `health`, `status`, `dashboard`,
`super-admin`, `audit-logs`, `executive-day`, `customers` (+photos, +notes), `photos`,
`deliveries`, `logistics`, `tasks`, `task-files`, `attendance`, `tracking`, `tracking-sessions`,
`market-intelligence`, `orders`, `products`, `bearings`, `stock`, `margin-simulations`, `brands`,
`targets`, `incentives`, `leaderboard`, `reports`, `invoices`, `invoice-files`, `sales-returns`,
`dues`, `expenditures`, `filters`, `geocode`, `system-settings`, `invoicing`, `visits`,
`web-push`, `errors`, `permissions`, `alerts`, `beats`, `beat-plans`, `collections`.

---

## 3. Module dependency sketch (high level)

```
Worker (index.ts)
  → middleware (auth, request-context)         → lib/authz, lib/db
  → routes/*.ts   (thin: parse, authz, call)   → services/*.ts
  → services/*.ts (business logic + SQL)        → lib/db (Neon client), lib/errors
                                                → packages/db (types), packages/shared
Web (Next app/*) → features/*-api.ts (server fetch) → API over HTTP
                 → features/* client UI          → lib/api-client → API over HTTP
Mobile (app/*)   → components/* → lib/* (api, auth, gps, sync, local-db) → API over HTTP
```

- **Backend shape:** `routes → services → lib`. A classic layered flow *inside* a single Worker.
- **`lib/db` is the top afferent hotspot** (imported by ~all services) — expected for a DB client,
  but to be quantified in Phase 1.
- **Frontends are HTTP clients** of the API; no code import coupling across the deploy boundary.
  Shared types *could* flow through `packages/shared` but it is currently thin (Phase 1/5 item).

---

## 4. Database schema (authoritative: live Neon DB)

**72 tables in `public`** today. (Migrations contain ~100 `create table` statements; ~28 were
later dropped — the migration history is cumulative, so the live DB is the source of truth.)
Grouped by domain:

- **Identity & access:** `users`, `user_roles`, `roles`, `role_permissions`, `permissions`,
  `teams`, `team_members`, `territories`, `section_seen`.
- **Customers:** `customers`, `customer_assignments`, `customer_reassignments`, `customer_notes`,
  `customer_photos`, `customer_product_discounts`, `customer_opening_balances`,
  `customer_dues_state`.
- **Catalogue:** `products`, `product_segments`, `product_pack_sizes`, `product_pack_prices`,
  `brands`, `bearings`, `hsn_gst_rates`.
- **Orders & fulfilment:** `orders`, `order_items`, `sales_returns`, `sales_return_items`,
  `deliveries`, `delivery_runs`, `delivery_run_stops`, `delivery_photos`.
- **Billing & money:** `invoices`, `invoice_items`, `invoice_line_allocations`, `invoice_settings`,
  `collections`, `collection_allocations`, `payment_proofs`, `aging_snapshots`.
- **Field ops / tracking:** `beats`, `beat_plans`, `beat_plan_stops`, `beat_customer_days`,
  `visits`, `gps_points`, `gps_tracking_sessions`, `executive_latest_locations`,
  `tracking_device_heartbeats`, `tracking_customer_dwell_events`, `attendance`.
- **Performance & incentives:** `targets` family (`se_targets`, `se_segment_targets`),
  `se_incentives`, `daily_executive_performance`, `se_notifications`.
- **Expenditure:** `expenditures`, `expenditure_categories`.
- **Market intelligence:** `market_notes`, `market_note_items`.
- **Inventory:** `stock_items`, `stock_movements`.
- **Platform/ops:** `system_settings`, `filters`, `audit_logs`, `alerts`, `tasks`,
  `task_comments`, `task_attachments`, `push_tokens`, `web_push_subscriptions`,
  `report_email_log`, `error_events`, `error_groups`, `error_notes`, `margin_simulations`.

**Migrations:** 79 SQL files in `packages/db/migrations/` (`0001`…`0079`), applied manually via
`psql` (no automated runner in `package.json`). `product_prices` and `organizations` no longer
exist (dropped). Indexes/relations to be cross-checked in Phase 4.

**Neon-managed `neon_auth` schema** (separate, not app-owned): `user`, `session`, `account`,
`jwks`, `verification`, `organization`, `member`, `invitation`, `project_config`. Auth uses Neon
Managed Better Auth (EdDSA JWTs). The app maps the token `sub` → `users.app_login_id` → role.

---

## 5. External integrations

- **Neon Postgres** — via `@neondatabase/serverless` (HTTP driver), `DATABASE_URL` secret.
- **Neon Managed Better Auth** — JWT verification via `NEON_JWKS_URL` (EdDSA/JWKS).
- **Cloudflare R2** — `PHOTOS` binding (bucket `distribution-os-photos`) for photos/proofs/attachments.
- **Cloudflare Cron** — `*/3 * * * *` trigger.
- **Resend** — transactional email (`RESEND_API_KEY`, `ALERT_FROM`, `REPORTS_FROM/TO`).
- **Web Push (VAPID)** — `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` for web push; Expo push for mobile.
- **Google Geocoding** — `GOOGLE_GEOCODING_API_KEY`.
- **MapLibre + self-hosted vector tiles** (`vardhan-maps`, maps.vardhansystems.in) — web + mobile maps.
- **Expo / EAS** — mobile build, OTA, notifications.
- No KV, D1, Queues, Durable Objects, or Workers AI bindings in use today (all commented out in `wrangler.jsonc`).

---

## 6. Current architecture style (Ch. 9 — single-sentence naming)

> **Backend:** a **layered modular monolith deployed as a single Cloudflare Worker** — one
> deployable, cleanly layered `routes → services → lib`, but partitioned **technically**
> (routes/services/lib) rather than by domain at the top level.

Supporting observations (to be evaluated, not judged, later):
- It is **not** a "big ball of mud": there is a clear, consistent layering and a one-module-per-
  resource convention, so boundaries exist.
- The **web frontend is domain-partitioned** (`features/<capability>`), which is closer to the
  playbook's "ideal" than the backend's technical partition — a notable internal inconsistency to
  examine in Phase 1.
- The **mobile app is technically-partitioned** (`lib/` holds 206 files) — a candidate cohesion
  concern for Phase 1/5.

---

## 7. Tenant concept today (playbook's highest-leverage question)

**There is no tenant concept in the application schema or code today.**

- **0** columns named `organization_id`, `tenant_id`, or similar exist in any of the 72 public
  tables (verified against the live DB).
- The `organizations` table and all `organization_id` columns were **deliberately dropped** in
  migrations `0034`/`0035` (per `AGENTS.md`, along with ~27 unused tables) — the system was
  **intentionally converted to a single-client, single-tenant silo** (one backend + one DB per
  customer deployment).
- The only "organization" concept present is inside Neon's managed `neon_auth` schema
  (`organization`, `member`) — Neon-Auth infrastructure, **not** used by the app for tenancy.

### ⚠️ Divergence from the playbook premise (recorded, per agreed handling)

The playbook's central strategic finding assumes the system is *"one backend + one DB per
customer, moving toward multi-tenant SaaS"* and that tenant identity should become a first-class
architectural concept. **The codebase has been moved in the opposite direction** — multi-tenant
scaffolding was removed on purpose to simplify a single-client deployment (priorities #5 cost,
#6 simplicity).

Per the agreed handling, this audit will judge the code **as it actually is** (single-client silo)
and will use **Phase 3** to document, as a conscious trade-off (the book's framing), what the two
roads — *stay single-client per-deploy* vs. *(re)introduce multi-tenancy for SaaS (priority #4)* —
would each cost. No tenancy "gap" is asserted yet; it depends on which road the owner chooses.

---

## Phase 0 coverage note

Phase 0 is a top-down map; it opened representative structural files (`index.ts`, route mounts,
migrations, `wrangler.jsonc`, workspace config) and queried the live DB, but **did not** mark
individual feature files reviewed in the ledger — that happens in the per-component phases (1+).
Ledger state after Phase 0: **0 / 1765** files marked reviewed (inventory ≠ review).

**No gap-report rows** are created in Phase 0 (observation only). The tenancy divergence above is
carried forward to Phase 3, not filed as a defect.
