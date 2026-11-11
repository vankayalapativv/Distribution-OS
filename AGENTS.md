# Sri Aparajita Distribution Management System

## Business Domain

This is a **lubricant distribution management system** — not generic FMCG. The distributor sells automotive lubricants (engine oils, gear oils, greases) to retailers and workshops. Key domain terms:

- **Products**: automotive lubricants. Since migration `0007` the `products` table is deliberately minimal — `product_name` + `product_segments` junction. The canonical oil segments are the **six**: `Car`, `2W`, `3W`, `Commercial`, `Agri`, `Gear Oil` (the code's `OIL_SEGMENTS`/`ALLOWED_SEGMENTS`/`PRODUCT_SEGMENTS`). The older vocabulary (Cars/Tractors/Industrial) was normalized to these by migrations `0081` then `0092` (mapping Cars→Car, Tractors→Agri, Industrial→Commercial) — never use the old names. Pack size, HSN code, and GST % live as snapshot fields on `order_items`, not on the product
- **Customers**: retailers or workshops (not end consumers)
- **Sales Executives**: field sales staff who visit customers, take orders, and collect payments
- **Basic Price**: the distributor's selling price (not MRP, not retailer margin)
- **Beats/Territories**: geographic groupings of customers assigned to sales executives
- **Collections**: cash/cheque payments collected from customers against invoices

## Who Uses What

| Role | Platform | Access |
|------|----------|--------|
| SUPER_ADMIN | Web (Next.js) | Full system access |
| MANAGER | Web (Next.js) | Customers, orders, products, team performance |
| ACCOUNTANT | Web (Next.js) | Invoices, collections, outstanding |
| SALES_EXECUTIVE | React Native (Expo SDK 57) app — **live** at `apps/mobile` | Field visits, orders, collections, dues |
| LOGISTICS | Same mobile app (`apps/mobile`, `(logistics)` route group) | Delivery runs |

**The web app (Next.js) is for SUPER_ADMIN, MANAGER, and ACCOUNTANT only.** The first React Native app attempt was removed on 2026-07-09 (NativeWind/Metro failure caused by mixing npm inside the pnpm monorepo); a rebuild per `MOBILE_PLAN.md` is starting. Never build web UI for SALES_EXECUTIVE or LOGISTICS.

## Monorepo Structure

```
/
├── apps/
│   ├── api/          Hono on Cloudflare Workers — REST API
│   └── web/          Next.js — web dashboard for admin roles
├── packages/
│   ├── db/           PostgreSQL migrations (Neon) + seed scripts
│   └── shared/       Shared types/utilities
├── turbo.json        Turborepo task pipeline
└── pnpm-workspace.yaml
```

## Deployment Target

- **API**: Cloudflare Workers (`apps/api`) — runs on V8 isolates, not Node.js
- **Web**: Next.js (self-hosted or Cloudflare Pages)
- **Database**: Neon serverless PostgreSQL — accessed via `@neondatabase/serverless` driver

**Never suggest Node.js-only libraries for `apps/api`.** Use Web-standard APIs only. The `compatibility_date` in `wrangler.jsonc` governs available APIs.

## Running the Project Locally

Both servers must be running for the web app to work:

```bash
# API (Cloudflare Workers dev server) — port 8787
cd apps/api && pnpm dev

# Web (Next.js) — port 3000
cd apps/web && pnpm dev
```

Or from the root: `pnpm dev` (Turborepo runs both).

Dev servers are configured in `.claude/launch.json` — use the `preview_start` tool, not raw `Bash`, to start them.

The web app tries ports 8787, 8788, 8789 in sequence when `SRI_APARAJITA_API_BASE_URL` is not set.

## Key Database Tables

This is a **single-client deployment**. The `organization_id` multi-tenant scaffolding (column on every table + `(select id from organizations limit 1)` INSERT subquery) was removed in migrations `0034`/`0035` (2026-07-23) along with 27 unused tables — do not reintroduce either.

| Table | Purpose |
|-------|---------|
| `users` | All users (all roles) |
| `user_roles` | Many-to-many: user ↔ role |
| `roles` | Role codes: `SUPER_ADMIN`, `MANAGER`, `ACCOUNTANT`, `SALES_EXECUTIVE`, `LOGISTICS` |
| `customers` | Retailers/workshops |
| `products` | Product catalogue (lubricants) — simplified in migration `0007` to essentially `product_name`; ~65 real products seeded |
| `product_segments` | Junction: product ↔ segment (`Car`, `2W`, `3W`, `Commercial`, `Agri`, `Gear Oil` — the canonical six; old Cars/Tractors/Industrial were migrated away in `0081`/`0092`) |
| `orders` | Order header (`sales_executive_id` is nullable for web-created orders) |
| `order_items` | Order line items — has FK to `products(id)`, no CASCADE |
| `invoices` | Billing records |
| `collections` | Payment collections |
| `visits` | Field visit records. Semantics: a visit linked to a `beat_plan_stops` row is **planned**; a visit without a beat-plan stop is **unplanned**. Both are valid; they are tracked separately |
| `tasks` | Internal office to-dos for SUPER_ADMIN/MANAGER/ACCOUNTANT (migration `0012_tasks.sql`). Lifecycle `open → in_progress → done/cancelled`, priority high/medium/low, optional `due_date`, `assigned_to` (users FK), optional `customer_id` link. `completed_at` is set when status → done, cleared on other transitions. **Private**: visible only to `created_by` and `assigned_to` (no admin override) |
| `task_comments` | Comment thread per task (`task_id` ON DELETE CASCADE) |
| `task_attachments` | Attachment metadata per task (`task_id` ON DELETE CASCADE) — file bytes live in Cloudflare R2 (`PHOTOS` binding, keys `tasks/{taskId}/…`, 15 MB max) |

**Neon driver quirk**: PostgreSQL `date` columns are returned as JS `Date` objects, not strings. Always handle with `if (v instanceof Date) return v.toISOString()` before assuming string.

**FK constraint**: `order_items.product_id` references `products(id)` with no `ON DELETE CASCADE`. Deleting a product used in orders will fail at the DB level — catch and return 409.

**`product_prices` no longer exists** — it was dropped (with ~15 `products` columns) in migration `0007_simplify_products.sql`. Do not reference it.

## Hard Rules

1. **Never `git add -A` or `git add .`** — always stage specific files by name
2. **Never `git push` without asking** — always confirm first
3. **Never skip git hooks** (`--no-verify`) — fix lint/type errors instead
4. **Never build web UI for SALES_EXECUTIVE or LOGISTICS** — those roles belong to the live mobile app (`apps/mobile`); do not add their screens to the web app without explicit instruction
5. **Never use Node.js-only packages in `apps/api`** — Cloudflare Workers runtime only
6. **Never reintroduce `organization_id` / multi-tenant scaffolding** — it was removed in migrations `0034`/`0035`; single-client deployment, all data belongs to one org

## Best Practices & Known Gaps

- **`docs/BEST-PRACTICES.md`** — living per-technology checklist (React, Next.js, PostgreSQL, Neon, Neon Auth, React Native/Expo, Hono, Cloudflare Workers) tailored to this stack. Skim the relevant section before building in that area.
- **`docs/CODE-AUDIT-2026-07-22.md`** — prioritized audit findings (P0→P3). Known gaps at time of writing, in order of leverage. When you fix one, check it off in both docs.
- Highest-leverage rules that recur in the audit: **batch DB writes** into one set-based statement (never one round-trip per row — Workers subrequest cap); **wrap financial multi-writes in a transaction** (order+items, collection reconcile); **scope every by-id read for the SALES_EXECUTIVE role**; **do money math in SQL `numeric`, not JS float**.

## Available Skills — When to Use Them

Suggest these to the user at the right moment:

| Skill | When to suggest |
|-------|----------------|
| `/verify` | After editing any frontend (web) or API code — confirm it works in the running app |
| `/run` | When either server needs to be started before testing |
| `/code-review` | Before committing or pushing — check for correctness bugs |
| `/simplify` | After a feature is complete — clean up redundant code |
| `/workers-best-practices` | When editing `apps/api` — check for Workers anti-patterns |
| `/security-review` | Before shipping auth, role-check, or data-access code |
| `/wrangler` | When deploying or configuring the Workers API |
| `/schedule` | When the user wants a recurring automated task |
| `/consolidate-memory` | When memory files are growing stale or fragmented |
| `/update-config` | When the user wants to change Claude Code settings or allowlists |
| `/fewer-permission-prompts` | When permission prompts are becoming annoying |
| `/code-review ultra` | Deep multi-agent cloud review before a major release |

## Implemented Routes (as of 2026-07-11)

**Web pages:**
- `/login` — authentication
- `/dashboard/super-admin` — Super Admin dashboard
- `/dashboard/super-admin/setup` — org/user setup
- `/dashboard/manager` — Manager dashboard
- `/dashboard/accountant` — Accountant dashboard (placeholder)
- `/dashboard/customers` — Customer list + detail
- `/dashboard/orders` — Order list (with filters) + detail + create
- `/dashboard/products` — Product catalogue (SUPER_ADMIN, MANAGER only)
- `/dashboard/collections` — Collections list (with status filter tabs) + detail + create
- `/dashboard/collections/[id]` — Collection detail with verify/reject actions (ACCOUNTANT + SUPER_ADMIN)
- `/dashboard/alerts` — Alerts list with Open/All/Closed filter tabs; Close action (SUPER_ADMIN, MANAGER only)
- `/dashboard/collections?status=pending` — Approvals and Pending Verification both link here
- `/dashboard/tracking` — **Live Tracking** (added 2026-07-11, SUPER_ADMIN + MANAGER only): Google Map + executive list showing each SE's day route. Data source: the mobile "Start day" button records a GPS point every ~3 minutes into `gps_points` (via `POST /visits/gps/batch`). **SE day lifecycle (reworked 2026-10-04 — reverses the 2026-07-23 fixed-hour auto-stop):** the SE ends their own day with an in-app **"End day" button** (beside the Home greeting) → stops native GPS + `POST /tracking-sessions/:id/end` tagged `ended_reason='manual'`, then a date-stamped per-user SecureStore flag + a server guard block re-start until tomorrow (`startTrackingSession` rejects with `DAY_ENDED` when a manual-ended session exists for the SE today). Tracking runs to the **end of the IST day** (cutoff hour 24 — every point on the start day is accepted; points spilling into the next IST date are dropped). A **midnight safety cap** force-closes any still-active SE session at the next IST-day start with `ended_reason='server_midnight_cap'` (distinct from `manual`) — a cron (`capExpiredSeSessions`, runs every tick, outside the office-hours window) plus the native foreground service + JS watchdog (date-based cap off the stored start day). **Logistics tracking is untouched** (no cap, ends only on "End run"). Attendance shows "Started 3:06 am · Ended —" (Ended is `max(ended_at)` filtered to `ended_reason='manual'`, so auto-/midnight-closed days read "—"). This page polls every 60s, has a date picker for past days, and marks an SE "Live" when their last ping is <12 min old. The map is **MapLibre GL with a self-hosted OpenStreetMap vector basemap** (`vardhan-maps`, tiles on our R2) — **no maps API key required** (the earlier Google Maps dependency was removed)
- `/dashboard/market-intelligence` — **Market Intelligence** (added 2026-07-12, SUPER_ADMIN + MANAGER only): field-photo gallery on top (all customers' `market_intelligence`-category photos, grouped by customer, click-to-preview + delete) and meeting notes below — structured inputs recorded by SA/Manager during regular SE review meetings (`market_notes` + `market_note_items`, migration `0015`; item categories: pricing, promotion, stock, competitor_activity, demand, other)
- `/dashboard/tasks` — internal office to-dos for all three web roles (added 2026-07-11). **Each user sees only tasks they created or are assigned to** (creator + assignee visibility, no admin override). Status tabs (Open/In progress/Done/Cancelled/All), My-tasks toggle, priority filter, red overdue highlighting, create dialog (assignee + optional customer link), detail drawer with status transition buttons, comment thread, and R2 attachment upload/download. In the sidebar for SUPER_ADMIN + MANAGER (Management section) and ACCOUNTANT (Finance section) on every page component

**API endpoints (all under `/api/v1`):**
- `POST /auth/login`, `POST /auth/logout`
- `GET /me`
- `GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id` — **SE visibility scoping (2026-07-10): a SALES_EXECUTIVE sees ONLY customers they created (`created_by`); SUPER_ADMIN/MANAGER/ACCOUNTANT see all.** Enforced everywhere via `assertCustomerVisible` (list, detail, invoices, photos, orders, collections, unplanned check-ins — foreign customers 404). SE PATCH is restricted to address fields + latitude/longitude; web roles keep full-field PATCH. List supports `?since=` delta pulls
- `GET /customers/:id/invoices` — outstanding invoices + `creditBlocked` (from `credit_overdue_days` setting) for the mobile credit gate
- `GET /orders`, `POST /orders`, `GET /orders/:id` — POST also allows SALES_EXECUTIVE (salesExecutiveId forced to self); accepts `clientUuid` for idempotent offline retries (200 + `existing: true` on replay). GET /:id also allows SALES_EXECUTIVE (2026-07-24) scoped via `assertCustomerVisible` — feeds the mobile order-detail bottom sheet (tap an ORD-*** card on the customer page; full line breakdown; queued orders render from local data; fetched details cached in `order_detail_cache` for offline)
- `GET /orders/products` — products for order creation dropdown; allows SALES_EXECUTIVE, supports `?since=`
- `GET /orders/sales-executives` — sales exec dropdown
- `GET /products`, `POST /products`, `DELETE /products/:id`
- `GET /collections`, `POST /collections`, `GET /collections/:id` — POST accepts `clientUuid` for idempotent offline retries. Detail (`GET /:id`) returns `proof` (the SE-uploaded receipt metadata `{id, contentType, createdAt}`, or null for web-created collections)
- `POST /collections/:id/proof` (SE/web upload, one per collection, R2 `collections/{id}/…`, `payment_proofs` table) + `GET /collections/:id/proof` — streams the receipt image; **SUPER_ADMIN + ACCOUNTANT only** (the collection reviewers; Manager cannot view receipts). Shown on the web collection detail page as a "Payment receipt" thumbnail → click opens a large-image dialog (2026-07-24)
- `POST /collections/:id/verify` — ACCOUNTANT or SUPER_ADMIN only; **reconciles at approval**: applies the collection's allocations to invoices (amount_collected/outstanding/payment_status); general payments auto-allocate oldest-due-first. The mobile credit gate reads invoice outstanding, so verification is what unblocks a customer
- `POST /collections/:id/reject` — ACCOUNTANT or SUPER_ADMIN only; requires `remark`; creates alert for SE
- `GET /alerts` — SUPER_ADMIN, MANAGER only; filterable by status/severity/alertType
- `POST /alerts/:id/close` — SUPER_ADMIN, MANAGER only
- `GET /beats/today` — SALES_EXECUTIVE; returns today's beat plan with customer stops
- `POST /visits/checkin` (accepts `clientUuid`), `POST /visits/:id/checkout`, `POST /visits/gps` + `/visits/gps/batch` (alias) — mobile visit flow; idempotency columns added in migration `0009_mobile_sync.sql`
- `GET /tasks`, `POST /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id` — internal office tasks; SUPER_ADMIN/MANAGER/ACCOUNTANT only (never SEs). **Visibility (changed 2026-07-11): a task is visible ONLY to its creator and its assignee** — enforced in every query (list, detail, update, comments, attachment upload/download return 404 for non-participants); there is no admin override. List filters: `?status=`, `?priority=`, `?assignedTo=`, `?customerId=`
- `GET /tasks/assignees` — active users holding an office role, for the assignee dropdown
- `POST /tasks/:id/comments` — add a comment (422 on blank body)
- `POST /tasks/:id/attachments` — multipart upload (`file` field, 15 MB max) to R2 under `tasks/{taskId}/…`
- `GET /task-files/:attachmentId` — streams an attachment back (auth required, office roles only)
- `GET /targets/me` — SALES_EXECUTIVE; Home-screen performance payload: today's actuals + current week/month actual-vs-target (IST periods; week starts Monday). **Per-segment oil litres + a single bearing VALUE (₹)** since migration `0041` (2026-07-25). Oil actuals group by `order_items.segment` (7 segments: Cars, Commercial, 2W, 3W, Tractors, Industrial, Gear Oil — one segment per order line, no double-count); bearing actual is billed value from invoices (see below). Response: `{today:{oilActual[],bearingActualValue}, week/month:{periodStart,oilActual[],oilTarget[]|null,bearingActualValue,bearingTargetValue|null}}`
- `GET /targets` — SUPER_ADMIN/MANAGER; every active SE's current week+month per-segment oil + bearing-value actuals and targets (Configure → Targets page)
- `PUT /targets/:userId` — SUPER_ADMIN/MANAGER; upsert one SE's week or month target. Body: `periodType`, `segments` (a `{ [segment]: litres }` object for the 7 oil segments), `bearingValue` (₹). Period start normalized server-side. Anchor row in `se_targets` (now holds `target_bearing_value`) + child `se_segment_targets` (segment, target_litres) — migration `0041`
- **Bearing VALUE source (2026-07-25):** orders store NO price for bearings (only qty), so bearing actuals come from uploaded **invoices** — sum of `line_items` amounts where `kind='bearing'` (before GST), attributed to the SE via `invoices.sales_executive_id`, by `invoice_date`. So oils = ordered (orders), bearings = billed (invoices) — different sources, accepted by the client 2026-07-25
- `GET /dashboard/sku-analytics?from=&to=` — SUPER_ADMIN/MANAGER; billed-per-SKU analytics from `invoices.line_items` (spec `docs/SKU-ANALYTICS-SPEC.md`): base-product rows with pack breakdown + top-5 buyers, brand/segment roll-ups (catalogue name-matching ignores punctuation; unmatched bucketed), 6-month trend. Rendered as the "SKU analytics — Billed (from invoices)" dashboard section — deliberately labeled apart from the order-based tables (different truths)
- `GET /invoices`, `POST /invoices`, `GET /invoices/:id` — SUPER_ADMIN + ACCOUNTANT; POST is multipart (PDF ≤10 MB + reviewed fields parsed client-side from the fixed BAL tax-invoice format). Saving sets `outstanding_amount = grand total` (dues clock = invoice date), creates an `se_notifications` row for the customer's SE (`customers.created_by` holding the SE role) and fires an Expo push (`push_tokens`). Migration `0037`
- `GET /invoice-files/:id` — streams the invoice PDF; office roles or the invoice's own SE
- `POST /me/push-token`, `GET /me/notifications`, `POST /me/notifications/:id/read` — Expo push registration + the SE notification feed (mobile Alerts screen: tap downloads the PDF and opens the system share sheet for WhatsApp). Feed also carries `dues_bucket` entries from the dues cron
- `GET /dues/me/summary`, `GET /dues/me/customers?bucket=` — SALES_EXECUTIVE; collection-dues ageing (2026-07-24, migration `0039`): a customer with outstanding sits in exactly ONE bucket (`0_30`/`30_45`/`45_60`/`60_plus`), by the age of their oldest invoice with outstanding > 0, counted from the invoice date in IST. Feeds the mobile Home "Collection dues" card (tappable → `/dues/[bucket]` customer list → customer page, offline-cached). The 3-minute cron runs `runDuesMaintenance` (self-gated to once per IST day after 9 AM via `system_settings.dues_last_run_date`): an UPWARD bucket crossing notifies the customer's SE (`se_notifications` type `dues_bucket` + Expo push); first sight seeds `customer_dues_state` silently; cleared dues delete the row
- `GET /tracking/executives?date=` — SUPER_ADMIN/MANAGER only; one row per SE with GPS data that day (latest position, point count, session status). Date defaults to today in IST
- `GET /tracking/route?userId=&date=` — SUPER_ADMIN/MANAGER only; ordered GPS points for one SE's day (map trail)
- `GET/POST /market-intelligence/notes`, `PATCH/DELETE /market-intelligence/notes/:id`, `GET /market-intelligence/photos` — SUPER_ADMIN/MANAGER only; meeting notes with structured items + cross-customer MI photo gallery
- `GET /expenditures`, `POST /expenditures`, `GET/PATCH/DELETE /expenditures/:id` — **Expenditure** (added 2026-07-24, migration `0040`): SUPER_ADMIN + MANAGER + ACCOUNTANT all read AND write (no approval step; web-only, never mobile). Spend is `compulsory` or `variable` — a property of the CATEGORY, not the entry. Entry carries date, category, amount, optional payment mode / paid-to / remarks, an optional `userId` person link (fuel & food attributed to an SE or Logistics driver), and an optional bill
- `GET /expenditures/categories`, `POST /expenditures/categories` — 18 seeded categories (compulsory: Rent, Power, Internet, Salaries, Bank Charges, CA & GST Charges; variable: Fuel — Sales Executives/Logistics/Internal, Food — SEs & Logistics/Corporate, Customer Gifting, Travel Expenses, Drinking Water, Stationery, Donation — Willing/Unwilling, Coupon Redemptions). Any office role can add a custom category (`is_system` false)
- `GET /expenditures/people` — active SALES_EXECUTIVE + LOGISTICS users for the "For (person)" dropdown
- `GET /expenditures/summary?from=&to=` — period total, compulsory-vs-variable split, and per-category breakdown (drives the page's summary cards)
- `POST /expenditures/:id/bill` (multipart `file`, image/PDF ≤10 MB → R2 `expenditures/{id}/…`) + `GET /expenditures/:id/bill` — streams the bill back
- `GET /dashboard`
- `GET /super-admin/setup`, `POST /super-admin/users` — setup/onboarding. **Users only** now — Teams & Territories were removed (migration `0009_drop_teams_territories.sql`, applied to prod): dropped `teams`, `team_members`, `territories` and the `territory_id` column from customers/orders/invoices/collections/visits/beat_plans, plus the "Add team / Add Territory" UI and the team/territory API+service code. Do not reintroduce
- `GET /super-admin/users/:id/device` — **SUPER_ADMIN only**; latest known device for a user (`getUserLatestDevice`): `push_tokens.manufacturer/model` first (migration `0010_push_token_device.sql`), falling back to `tracking_device_heartbeats`. Labels a user's mobile session in the web "Manage sessions" dialog
- `PATCH /super-admin/users/:id` — **SUPER_ADMIN only** (2026-07-24): edit a user's `name`, `email`, `phone`, `status` (active/inactive). Role is deliberately NOT editable here. 409 if the email/phone belongs to another user. There is **no delete endpoint** — accounts are kept and reused, never destroyed. To "remove" someone, set them **inactive** (blocks login, frees the billing seat, keeps history); re-activate to reuse
- **User deletion was removed entirely on 2026-09-30** — no `DELETE /super-admin/users/:id` endpoint, no BFF route (`app/api/admin/delete-user`), no "Delete" action in the Users & Teams UI (only Edit + Set password remain). Deactivate instead of deleting; do not reintroduce a delete path
- `POST /super-admin/users/:id/password` — **SUPER_ADMIN only**; SETS a new password (returns it in plain text once so it can be handed over) and stores only the PBKDF2 hash. Passwords can never be READ back — the UI says "Set password", not "show password". Blocked (403) against another SUPER_ADMIN account so admins can't lock each other out. Blank body ⇒ a strong password is generated

- `/dashboard/invoices` — **Invoices** (added 2026-07-23, SUPER_ADMIN + ACCOUNTANT): list + Upload dialog. The PDF is parsed **client-side** (pdf.js + `features/invoices/invoice-parser.ts`, unit-tested) for the fixed BAL format: invoice no, date, party phone, station, oils litres (qty × pack size from descriptions, HSN 2710) vs bearing qty (HSN 8482), taxable/GST/grand totals. Editable review form; customer auto-matched by phone with searchable fallback; row click streams the PDF

**Placeholder (not yet implemented):** Reports, Audit Logs, Incentives, Outstanding, Reconciliation, Aging.

## Recent Changes (2026-10 / 2026-11)

- **Users page (`/dashboard/super-admin/setup`, SUPER_ADMIN)** — row actions moved into a **kebab menu**: Edit, Set password, **Manage sessions**, Activate/Deactivate (guarded — can't deactivate or lock out another SUPER_ADMIN). CONTACT column split into email + phone; the Users stat card was removed; context-aware table shimmer added.
- **Manage sessions dialog** (`features/super-admin/super-admin-sessions-dialog.tsx` + `super-admin-user-sessions.tsx`) — lists a Neon-Auth-linked user's active sign-ins via the BFF `/api/admin/sessions`, with **Sign out / Sign out all** (session revocation). The admin's own current session is flagged and, when revoked, the tab self-redirects to `/api/auth/logout`; `middleware.ts` enforces revocation on the next server render. The web login route forwards the browser User-Agent to Neon so web sessions read as e.g. "Chrome on macOS".
- **Mobile session device labels** — the app sends a device string `SriAparajita/<ver> (Android <os>; <manufacturer>; <model>)` (from `expo-device`) in the **`/auth/login` body**; the API (`routes/auth.ts` → `services/mobile-auth.ts`) forwards it as the session **user-agent** to Neon (mirrors the web login BFF), and web `describeDevice` parses it → a phone reads as its real model ("Samsung SM-G991B"). Fallback source: `push_tokens.manufacturer/model` via `GET /super-admin/users/:id/device`.
- **Notification permission on login** — `registerPushToken()` (mobile `invoice-notifications.ts`) now **requests** notification permission on login instead of silently returning when it isn't granted. SEs/Logistics are also prompted at Start day/run; admins hit neither, so without this they were never prompted and registered no push token. NOTE: push SENDING still targets SALES_EXECUTIVE only.
- **PostHog error tracking (exceptions only)** — added across web (`instrumentation-client.ts`), API (central error handler, direct fetch), and mobile (`src/lib/posthog.ts`, exceptions routed from `reportMobileError`). Runs **alongside** the in-house Error Monitor (`/errors/ingest`), not instead of it. Public `phc_` ingestion token in env (`NEXT_PUBLIC_/EXPO_PUBLIC_/POSTHOG_PROJECT_TOKEN`, host `https://eu.i.posthog.com`). Live on the field phones.
- **⚠️ Mobile OTA / fingerprint (load-bearing ops)** — `apps/mobile` uses `runtimeVersion.policy: "fingerprint"`, but **local `@expo/fingerprint` no longer reproduces the EAS-built APK's hash** (`9796be6d…`): the local and EAS-cloud environments diverged, so a plain `eas update` from this machine tags a runtime the installed phones never match (silently misses them). To OTA the installed phones, **temporarily pin** `app.json` `"runtimeVersion"` to the literal string `9796be6d1e9ae1268f9aab0b2200425496b09588`, publish (`eas update --channel production --platform android --environment production`), then revert the pin. Only ever OTA JS that is **native-safe** for the Oct-5 APK (no new native module). Full details + per-OTA log in Claude memory `expo-ota-updates`. Durable fix (deferred): cut a fresh APK from `main` and move off the fingerprint policy.

## Mobile App (`apps/mobile`) — live, Android, Expo SDK 57

The React Native (Expo SDK 57) app at **`apps/mobile`** is **live in production** (Android, EAS build profile `indus`, distributed as APK; JS changes shipped over-the-air via EAS Update — see the OTA/fingerprint note above). It serves SALES_EXECUTIVE primarily, with admin and logistics flows too (`(tabs)` / `(admin)` / `(logistics)` route groups). **Installed with pnpm ONLY** — never run `npm install` anywhere in this workspace (the first attempt, at `apps/beyond-distribution-management-systems/`, was removed 2026-07-09 precisely because npm-in-a-pnpm-monorepo broke Metro). Shared types/API contracts/business rules belong in `packages/shared`. Mobile-facing API endpoints (`/auth/*`, `/beats/today`, `/visits/*`, collections, `/me/*`, `/dues/*`, `/targets/me`) live in `apps/api`. Before writing mobile code, read the exact Expo SDK 57 docs (`apps/mobile/AGENTS.md`).

**Visit semantics (decided 2026-07-09):** a visit checked in against a `beat_plan_stops` row is a **planned** visit; a visit without a beat-plan stop is **unplanned**. Both are allowed; unplanned visits are tracked separately (matches `docs/business-rules/VISIT-RULES.md`). The two current API flows (`/visits/*` beat-stop-based and `/executive-day/*` assignment-based) should converge on this single model rather than remain parallel systems.

**Note on UI sharing:** React Native cannot render the web app's shadcn/Base UI components — web UI is not reusable in the mobile app regardless of repo layout. What *can* be shared through the monorepo: TypeScript types, API contracts, and validation/business logic (the intended home is `packages/shared`, currently empty).
