# Implementation Log

This file records the step-by-step implementation work for Sri Aparajita Distribution Management System.

All times are in IST unless explicitly noted. Some terminal outputs only included UTC timestamps; those have been converted to IST where useful. When an exact execution time was not available from command output, the entry is recorded at the documentation time.

> **Note (2026-07-09):**
>
> 1. The "Mobile App Phase 1" entry below is superseded. That React Native (Expo) app was removed on 2026-07-09 (root cause: npm used inside the pnpm monorepo duplicated packages and broke NativeWind/Metro) and is being rebuilt per the root `MOBILE_PLAN.md`.
> 2. All "Flutter" mentions in older entries are historical. The mobile direction is React Native (Expo).
> 3. Entries in this log are not in strict chronological order.
>
> The historical entries below are preserved as written.

## 2026-07-04 06:30:04 IST — Documentation Entry Created

Created this implementation log to track what we are building, why we are building it, files changed, and how each step can be tested.

## 2026-07-04 — Repository Checkout And Review

### What We Did

1. Inspected the repository structure.
2. Confirmed this is a PNPM/Turbo monorepo.
3. Identified the major packages:
   - `apps/web` — Next.js frontend.
   - `apps/api` — Hono API on Cloudflare Workers.
   - `packages/db` — database utilities and migrations.
   - `packages/shared` — shared TypeScript package.
   - `beyond-distribution-docs` — product, workflow, database, and business-rule documentation.
4. Checked Git state and confirmed the repository was on `main` and synced with `origin/main`.
5. Reviewed existing scripts:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm build`
   - `pnpm dev:web`
   - `pnpm dev:api`

### Findings

- The product documentation and database migration were already strong.
- The frontend was still the default Next.js starter.
- The API was still a default Hono placeholder returning `Hello Hono!`.
- `packages/db/src/index.ts` and `packages/shared/src/index.ts` were empty.

### Validation

Ran:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The build initially needed network access because Next.js fetched Google fonts. With network access allowed, the full production build passed.

## 2026-07-04 — Product Understanding From Documentation

### What We Did

Read the core documentation to understand the actual application goal:

- `beyond-distribution-docs/README.md`
- `beyond-distribution-docs/docs/architecture/SYSTEM-ARCHITECTURE.md`
- `beyond-distribution-docs/docs/architecture/ROLE-ACCESS-MODEL.md`
- `beyond-distribution-docs/docs/workflows/README.md`
- `beyond-distribution-docs/docs/business-rules/README.md`
- `beyond-distribution-docs/docs/database/SCHEMA-OVERVIEW.md`

### Product Summary

We are building a distribution operations management system, not a simple CRM.

The application should help a distribution business manage:

- field sales execution
- assigned customer visits
- GPS tracking
- sales orders
- invoice PDF upload
- payment collections
- accountant verification
- collection reconciliation
- logistics fulfilment
- dashboards
- configurable business rules
- approvals
- incentives
- audit logs

### Main Roles

1. `SALES_EXECUTIVE`
2. `LOGISTICS`
3. `ACCOUNTANT`
4. `MANAGER`
5. `SUPER_ADMIN`

### Important Architecture Rule

The frontend must never access the database directly.

```text
Next.js Web App
      ↓
Hono API
      ↓
Authorization + Rules Engine
      ↓
PostgreSQL / Neon
```

## 2026-07-04 — Recommended Build Order

### Decision

Start with the backend foundation.

### Why

The backend owns the most important business logic:

- authentication context
- role-based access
- data-scope access
- business rules
- workflow state transitions
- transactional writes
- dashboard APIs

### First Build Slice

1. Set up DB connection in `packages/db`.
2. Add real API structure in `apps/api`.
3. Build one complete V1 workflow end-to-end after the foundation is ready.

Recommended first workflow: Sales Executive daily workflow.

## 2026-07-04 — DB Connection Setup In `packages/db`

### What We Built

Added the first database foundation in `packages/db`.

### Files Added Or Changed

- `packages/db/src/index.ts`
- `packages/db/src/health.ts`
- `packages/db/package.json`
- `packages/db/README.md`
- `.env.example`
- `.gitignore`

### Implementation Details

Added reusable database helpers:

- `getDatabaseUrl()`
- `createDatabaseClient()`
- `getDatabaseClient()`
- `closeDatabaseClient()`
- `checkDatabaseHealth()`

Added a custom error:

- `DatabaseConfigurationError`

### Defaults

- `DATABASE_URL` is required.
- SSL defaults to `require`.
- Prepared statements default to `false` for pooled/serverless compatibility.
- Max connections default to `5`.
- Idle timeout defaults to `20` seconds.
- Connect timeout defaults to `10` seconds.

### Environment Setup

Added `.env.example` at the repo root:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

Updated `.gitignore` so real secrets are not committed:

```text
.env
.env.*
!.env.example
```

### Health Check Command

```bash
pnpm --filter @sri-aparajita/db health
```

### Important Fix

The first health check did not find `DATABASE_URL` because PNPM runs filtered package scripts from the package directory.

Fixed `packages/db/src/health.ts` so it explicitly loads the repo-root `.env`.

### Live Verification

After the user added `.env`, the live database health check succeeded.

Exact output:

```text
PostgreSQL OK at 2026-07-04T00:48:33.434Z
```

Converted time:

```text
2026-07-04 06:18:33 IST
```

### Validation

Ran:

```bash
pnpm --filter @sri-aparajita/db typecheck
pnpm --filter @sri-aparajita/db build
pnpm lint
pnpm typecheck
pnpm build
```

All passed.

## 2026-07-04 — Real API Structure In `apps/api`

### What We Built

Replaced the placeholder Hono API with a real starter API structure.

### Files Added Or Changed

- `apps/api/src/index.ts`
- `apps/api/src/types.ts`
- `apps/api/src/lib/api-response.ts`
- `apps/api/src/lib/errors.ts`
- `apps/api/src/middleware/request-context.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/me.ts`
- `apps/api/src/routes/customers.ts`
- `apps/api/src/routes/visits.ts`
- `apps/api/src/routes/collections.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `.gitignore`

### API Structure Added

Added global middleware:

- secure headers
- CORS
- timing headers
- request ID
- placeholder auth context

Added shared response format:

```ts
{
  success: true,
  data,
  meta: {
    requestId
  }
}
```

Added shared error format:

```ts
{
  success: false,
  error: {
    code,
    message,
    details
  },
  meta: {
    requestId
  }
}
```

### Routes Added

Root routes:

- `GET /`
- `GET /health`
- `GET /me`
- `GET /me/permissions`
- `GET /me/scope`

Versioned routes:

- `GET /api/v1/health`
- `GET /api/v1/me`
- `GET /api/v1/me/permissions`
- `GET /api/v1/me/scope`

Placeholder product routes:

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id`
- `GET /api/v1/visits`
- `POST /api/v1/visits`
- `POST /api/v1/visits/:id/check-in`
- `POST /api/v1/visits/:id/check-out`
- `GET /api/v1/collections`
- `POST /api/v1/collections`
- `POST /api/v1/collections/:id/submit-verification`

### Placeholder Auth Headers

Until Neon Auth is wired, the API can accept demo identity through headers:

```text
X-Beyond-User-Id
X-Beyond-Organization-Id
X-Beyond-Role
```

Supported roles:

- `SALES_EXECUTIVE`
- `LOGISTICS`
- `ACCOUNTANT`
- `MANAGER`
- `SUPER_ADMIN`

### Important Technical Decision

The API was not wired directly to `@sri-aparajita/db` yet.

Reason:

- `@sri-aparajita/db` currently uses the TCP `postgres` client.
- `apps/api` targets Cloudflare Workers.
- Cloudflare Workers need a Worker-compatible Neon/Data API style database integration.

So the API structure is ready, but live database queries should be added in a dedicated Worker-compatible DB integration step.

### Wrangler Log Fix

Wrangler tried to write logs outside the workspace:

```text
/Users/vishnuvardhan/Library/Preferences/.wrangler/logs
```

That caused sandbox noise during builds.

Fixed by routing Wrangler logs into a workspace-local ignored folder:

```bash
WRANGLER_LOG_PATH=../../.wrangler-logs
```

Updated `.gitignore`:

```text
.wrangler-logs
```

### Local Endpoint Verification

Started API locally:

```bash
pnpm --filter @sri-aparajita/api dev -- --port 8787
```

Verified:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/me
curl -H "X-Beyond-User-Id: demo-user" \
  -H "X-Beyond-Organization-Id: demo-org" \
  -H "X-Beyond-Role: SALES_EXECUTIVE" \
  http://localhost:8787/api/v1/me/scope
```

Known verification time from API output:

```text
2026-07-04T00:54:58.923Z
```

Converted time:

```text
2026-07-04 06:24:58 IST
```

### Validation

Ran:

```bash
pnpm --filter @sri-aparajita/api typecheck
pnpm --filter @sri-aparajita/api build
pnpm lint
pnpm typecheck
pnpm build
```

All passed.

## 2026-07-04 06:46:22 IST — Sales Executive Daily Workflow Built End-To-End

### What We Built

Built the first complete V1 workflow slice: Sales Executive daily field execution.

This workflow is now database-backed through the Cloudflare Worker API using Neon's serverless HTTP driver.

### Files Added Or Changed

- `apps/api/src/lib/db.ts`
- `apps/api/src/lib/authz.ts`
- `apps/api/src/lib/request-body.ts`
- `apps/api/src/services/executive-day.ts`
- `apps/api/src/routes/executive-day.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/index.ts`
- `apps/api/package.json`
- `packages/db/src/seed-dev.ts`
- `packages/db/package.json`

### Dependency Added

Added Worker-safe Neon database access to `apps/api`:

```bash
@neondatabase/serverless
```

Reason:

- Cloudflare Workers cannot use the TCP `postgres` client directly.
- The Neon serverless driver lets the Worker query Neon over HTTP.

### API Routes Added

The workflow is mounted at:

```text
/api/v1/executive-day
```

Routes:

- `GET /api/v1/executive-day`
- `POST /api/v1/executive-day/start`
- `POST /api/v1/executive-day/gps-points`
- `GET /api/v1/executive-day/customers`
- `POST /api/v1/executive-day/visits/check-in`
- `POST /api/v1/executive-day/visits/check-out`
- `POST /api/v1/executive-day/orders`
- `POST /api/v1/executive-day/collections`
- `POST /api/v1/executive-day/end`

### What The Workflow Now Does

1. Sales Executive starts the day.
2. API creates an active `gps_tracking_sessions` row.
3. Sales Executive records GPS points.
4. API validates the GPS session belongs to that user.
5. Sales Executive loads assigned customers.
6. API returns only customers assigned through `customer_assignments`.
7. Sales Executive checks in to a customer visit.
8. API creates a `visits` row and validates customer assignment.
9. Sales Executive records an order.
10. API creates an `orders` row and updates visit sales metrics.
11. Sales Executive records a collection.
12. API creates a `collections` row and updates visit collection metrics.
13. Sales Executive checks out of the visit.
14. API calculates visit duration and marks productive visits.
15. Sales Executive ends the day.
16. API completes the GPS session.
17. API recalculates `daily_executive_performance`.

### Dev Seed Added

Added a development seed command:

```bash
pnpm --filter @sri-aparajita/db seed:dev
```

This creates or reuses:

- demo organization
- `SALES_EXECUTIVE` role
- demo sales executive user
- demo retail customer
- active customer assignment

Seed output from the verified run:

```text
Demo seed ready
organizationId=6e6dd03f-c1b5-4e91-99b5-6ed208f54f3e
userId=39c8f73d-b805-4758-8b49-97c49cff5a57
customerId=6a1c3832-d6f3-4d46-b79e-cce36b9c6ada
role=SALES_EXECUTIVE
```

### Auth Context For This Slice

Until Neon Auth is fully wired, the API uses placeholder auth headers:

```text
X-Beyond-User-Id
X-Beyond-Organization-Id
X-Beyond-Role
```

The auth middleware now treats the request as authenticated only when user and organization IDs are valid UUIDs.

### Live End-To-End Verification

Started local API with:

```bash
pnpm --filter @sri-aparajita/api dev -- --port 8787
```

Wrangler selected:

```text
http://localhost:8788
```

because port `8787` was already in use.

Verified full workflow sequence:

```text
POST /api/v1/executive-day/start              201
POST /api/v1/executive-day/gps-points         201
GET  /api/v1/executive-day/customers          200
POST /api/v1/executive-day/visits/check-in    201
POST /api/v1/executive-day/orders             201
POST /api/v1/executive-day/collections        201
POST /api/v1/executive-day/visits/check-out   200
POST /api/v1/executive-day/end                200
GET  /api/v1/executive-day                    200
```

Final verified daily metrics:

```text
completed_visits=1
productive_visits=1
total_km_travelled=12.50
total_litres_sold=48.00
total_sales_value=12500.00
total_collection=2500.00
sales_per_km=1000.00
collection_per_km=200.00
```

Known verification timestamp from API output:

```text
2026-07-04T01:15:58.387Z
```

Converted time:

```text
2026-07-04 06:45:58 IST
```

### Health Route Updated

`GET /health` now checks whether `DATABASE_URL` is configured and runs a Worker-safe database check when it is available.

### Wrangler Dev Update

Updated the API dev script so Wrangler reads the repo-root `.env`:

```bash
wrangler dev --env-file ../../.env
```

Also routed Wrangler logs into the workspace-local `.wrangler-logs` folder.

## Current Testing Instructions

### DB Health Check

Requires `.env` at repo root with `DATABASE_URL`.

```bash
pnpm --filter @sri-aparajita/db health
```

Expected:

```text
PostgreSQL OK at <timestamp>
```

### API Dev Server

```bash
pnpm dev:api
```

Expected:

```text
Ready on http://localhost:8787
```

### API Endpoint Checks

```bash
curl http://localhost:8787/health
curl http://localhost:8787/me
curl http://localhost:8787/api/v1/customers
```

With demo auth context:

```bash
curl \
  -H "X-Beyond-User-Id: 39c8f73d-b805-4758-8b49-97c49cff5a57" \
  -H "X-Beyond-Organization-Id: 6e6dd03f-c1b5-4e91-99b5-6ed208f54f3e" \
  -H "X-Beyond-Role: SALES_EXECUTIVE" \
  http://localhost:8787/api/v1/me/scope
```

### Sales Executive Workflow Check

Seed demo data first:

```bash
pnpm --filter @sri-aparajita/db seed:dev
```

Start API:

```bash
pnpm dev:api
```

Use the seeded `organizationId`, `userId`, and `customerId` from the seed output.

### Full Repo Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Next Recommended Steps

1. Add a migration runner for `packages/db/migrations/0001_initial_schema.sql`.
2. Add real Neon Auth validation instead of placeholder `X-Beyond-*` headers.
3. Expand Super Admin setup screens for users, teams, and territories.
4. Add Manager drilldowns for executive, territory, customer, and visit review.
5. Add Accountant verification and reconciliation actions.
6. Keep Sales Executive web screens out of scope; Sales Executive frontend will be Flutter later.

## 2026-07-04 07:17:33 IST — TDD Web Dashboards For Super Admin, Manager, Accountant

### Direction Confirmed

Sales Executive frontend is out of web scope because it will be built later in Flutter.

The Next.js web app now focuses on:

- Super Admin
- Manager
- Accountant

Sales Executive activity is represented as backend reporting data only.

### TDD Work Completed

Added test-first coverage for:

- Hono dashboard routes through `app.request()`
- React dashboard shell and role navigation through React Testing Library

Added test tooling:

```bash
pnpm test
pnpm --filter @sri-aparajita/api test
pnpm --filter @sri-aparajita/web test
```

### API Dashboard Routes Added

```text
GET /api/v1/dashboard/super-admin
GET /api/v1/dashboard/manager
GET /api/v1/dashboard/accountant
```

Each route returns role-specific dashboard metrics from database-backed Sales Executive activity.

### Web Dashboard Routes Added

```text
/dashboard
/dashboard/super-admin
/dashboard/manager
/dashboard/accountant
```

`/dashboard` redirects to `/dashboard/super-admin` for now.

### Seed Data Expanded

`pnpm --filter @sri-aparajita/db seed:dev` now creates or reuses:

- Super Admin user
- Manager user
- Accountant user
- three Sales Executives
- customers assigned to executives
- visits
- GPS sessions
- orders
- collections
- invoices
- aging snapshots
- daily executive performance rows

Verified seed output:

```text
organizationId=bf50b630-f6ab-4b46-8769-424b5afad991
superAdminUserId=b0c41089-d19d-4777-87e7-1a63f18692e8
managerUserId=dbc34ba8-870f-4325-86ba-e472d046df08
accountantUserId=1173025e-d82e-4e9c-afbb-36f6d63f691d
salesExecutiveUserId=7712121b-36a2-4e8b-b641-3dc2eeab1377
```

### Local Verification

API started on:

```text
http://localhost:8788
```

Web started on:

```text
http://localhost:3000
```

Verified:

```text
GET http://localhost:8788/api/v1/dashboard/super-admin 200
GET http://localhost:3000/dashboard/super-admin 200
```

Verified rendered dashboard content includes:

- Super Admin Control Tower
- Sales Value
- Anika Sharma
- Ravi Kumar
- Meera Iyer

### Final Validation

Passed:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Note: `pnpm build` required sandbox elevation because Turbopack needs to spawn an internal process and bind a local port during CSS processing.

---

## 2026-07-04 11:51:40 IST - Real Authentication Replaces Dummy Headers

### Goal

Remove dummy browser-controlled authentication and require real authenticated identity for admin web/API flows.

### TDD Steps

1. Updated API route tests to use signed RS256 JWT fixtures and a JWKS response.
2. Added a regression test proving old placeholder `X-Beyond-*` auth headers are rejected.
3. Updated onboarding API tests so a verified provider admin can create the first company before an app user exists.
4. Replaced API placeholder auth middleware with bearer JWT verification.
5. Added database profile lookup from `users.app_login_id = jwt.sub`.
6. Installed the official `@neondatabase/auth` Next.js SDK.
7. Added `/api/auth/[...path]` so Neon Auth owns sign-in, callback, refresh, and sign-out handling.
8. Updated web fetchers and forms to forward `Authorization: Bearer <token>` from `auth.getSession()`.
9. Removed the onboarding preview bypass from the login page.

### API Auth Contract

Protected API routes now require:

```text
Authorization: Bearer <jwt>
```

The API verifies:

- JWT signature through `AUTH_JWKS_URL`
- issuer through `AUTH_ISSUER`
- audience through `AUTH_AUDIENCE`
- expiration and not-before claims
- app user, organization, and role from Postgres

The API no longer trusts browser-provided user, organization, or role headers.

### Web Auth Contract

Next.js now uses the official Neon Auth SDK:

```text
/api/auth/[...path]
```

Server components call `auth.getSession()`, read the session JWT from Neon Auth, and forward it to the API as a bearer token.

The login page now links only to:

```text
NEXT_PUBLIC_NEON_AUTH_LOGIN_URL
```

### Environment Variables Added

Updated `.env.example` with:

```bash
AUTH_JWKS_URL="https://your-auth-domain/.well-known/jwks.json"
AUTH_ISSUER="https://your-auth-domain"
AUTH_AUDIENCE="your-auth-audience"
NEON_AUTH_BASE_URL="https://your-neon-auth-url.neon.tech"
NEON_AUTH_COOKIE_SECRET="your-secret-at-least-32-characters-long"
NEXT_PUBLIC_NEON_AUTH_LOGIN_URL="/api/auth/sign-in"
SRI_APARAJITA_API_BASE_URL="http://localhost:8787/api/v1"
```

### Validation Status

Passed during this slice:

```bash
pnpm --filter @sri-aparajita/api test
pnpm --filter @sri-aparajita/api typecheck
pnpm --filter @sri-aparajita/web test
pnpm --filter @sri-aparajita/web lint
pnpm --filter @sri-aparajita/web build
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Note: `pnpm build` required sandbox elevation because Turbopack needs to spawn an internal process and bind a local port during CSS processing. Local build passed; Turborepo only warned that one remote cache artifact was too large to upload within the timeout.

---

## 2026-07-04 11:40:34 IST - Next.js Theme Standardized To tweakcn Modern Minimal

### Goal

Use only the requested Next.js web theme:

```bash
pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/modern-minimal.json
```

### Steps Completed

1. Initialized shadcn in `apps/web`.
2. Applied the tweakcn `modern-minimal` registry theme.
3. Added the generated shadcn config and utilities:
   - `apps/web/components.json`
   - `apps/web/src/lib/utils.ts`
   - `apps/web/src/components/ui/button.tsx`
4. Updated `apps/web/src/app/globals.css` with the modern-minimal OKLCH theme tokens.
5. Removed the external Google font runtime dependency from the Next.js layout so builds do not need to fetch fonts.
6. Refactored web app screens to use semantic shadcn theme tokens instead of hard-coded colors.

### Screens Refactored

- dashboard app shell
- Super Admin setup workflow
- login page
- company onboarding page

### Theme Rule

Application screens should now use semantic classes such as:

```text
bg-background
text-foreground
bg-card
text-card-foreground
text-muted-foreground
border-border
bg-primary
text-primary-foreground
bg-secondary
text-secondary-foreground
bg-accent
text-accent-foreground
```

Hard-coded hex colors and ad hoc arbitrary color classes were removed from `apps/web/src/app` and `apps/web/src/features`.

### Validation Status

Passed during this slice:

```bash
pnpm --filter @sri-aparajita/web test
pnpm --filter @sri-aparajita/web lint
pnpm --filter @sri-aparajita/web build
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Note: Next.js/Turbopack build commands required sandbox elevation because CSS processing needs to spawn an internal process and bind a local port. The root build completed successfully; Vercel remote cache returned a warning after completion, but local build validation passed.

---

## 2026-07-04 11:26:22 IST - TDD Slice 1: Login + Onboarding Entry

### Goal

Introduce the first authentication/onboarding foundation:

- login page first
- Neon Auth admin as the identity boundary
- company onboarding entry
- first company and first Super Admin profile creation

### TDD Steps

1. Added failing Hono route tests for onboarding status and company creation.
2. Implemented onboarding service and routes.
3. Re-ran API tests until green.
4. Added failing React tests for login and company onboarding.
5. Implemented `/login` and `/onboarding/company`.
6. Changed `/` to redirect to `/login`.
7. Re-ran web tests until green.

### API Routes Added

```text
GET  /api/v1/onboarding/status
POST /api/v1/onboarding/company
```

Dev/test headers used until real Neon Auth session verification is wired:

```text
X-Beyond-Neon-User-Id
X-Beyond-Neon-Email
X-Beyond-Neon-Is-Admin
```

### Web Routes Added

```text
/login
/onboarding/company
```

`/` now redirects to `/login`.

### Database Migration Added

```text
packages/db/migrations/0002_onboarding_foundation.sql
```

Adds:

- `organizations.phone`
- `organizations.onboarding_completed_at`
- index on `users.app_login_id`

`users.app_login_id` is used as the app-side reference to the Neon Auth user id for now.

### Validation Status

Passed during this slice:

```bash
pnpm --filter @sri-aparajita/api test
pnpm --filter @sri-aparajita/web test
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Note: `pnpm build` required sandbox elevation because Turbopack needs to spawn an internal process and bind a local port during CSS processing.

---

## 2026-07-04 11:10:11 IST - Super Admin Action Fetch Fix

### Issue

The Super Admin setup page rendered, but submitting `Add User`, `Add Team`, or `Add Territory` showed `Failed to fetch`.

### Cause

The local API was running on:

```text
http://localhost:8787/api/v1
```

The browser-side form action config defaulted to:

```text
http://localhost:8788/api/v1
```

So the client-side form submit tried to POST to a port where no API server was listening.

### Fix

Updated the Super Admin setup action default to use:

```text
http://localhost:8787/api/v1
```

Also expanded the server-side setup fetch fallback list to include:

```text
8787, 8788, 8789
```

### Verification

Confirmed the API accepts create requests:

```text
POST http://localhost:8787/api/v1/super-admin/users 201
```

Passed:

```bash
pnpm --filter @sri-aparajita/web test
pnpm --filter @sri-aparajita/api test
```

---

## 2026-07-04 07:27:35 IST - Super Admin Workflow First

### Decision

Manager and Accountant workflows are intentionally deferred. The first workflow slice is Super Admin setup because users, teams, and territories are the operating foundation for customers, orders, invoices, collections, and dashboards.

Sales Executive remains backend/demo data only for the web dashboard. The Sales Executive frontend will be built later in Flutter.

### TDD Steps

1. Added failing API tests for Super Admin setup.
2. Implemented the API routes and database service.
3. Re-ran API tests until green.
4. Added a failing React component test for the Super Admin setup screen.
5. Implemented the setup screen, page route, and API fetcher.
6. Re-ran web tests until green.
7. Expanded seed data so setup has real teams and territories.

### API Routes Added

```text
GET  /api/v1/super-admin/setup
POST /api/v1/super-admin/users
POST /api/v1/super-admin/teams
POST /api/v1/super-admin/territories
```

All routes require the `SUPER_ADMIN` role from the current placeholder header auth context.

### Web Route Added

```text
/dashboard/super-admin/setup
```

The existing Super Admin dashboard navigation now links to the setup workflow.

### Seed Data Expanded

`pnpm --filter @sri-aparajita/db seed:dev` now also creates or reuses:

- North Sales Team
- Bengaluru North territory
- Bengaluru East territory
- team memberships for the demo manager and demo Sales Executives
- territory assignments for demo Sales Executives
- Logistics role metadata

### Validation Status

Passed during this slice:

```bash
pnpm --filter @sri-aparajita/api test
pnpm --filter @sri-aparajita/web test
pnpm --filter @sri-aparajita/db build
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm build` required sandbox elevation because Turbopack needs to spawn an internal process and bind a local port during CSS processing.

### Live Smoke Test

Seeded the connected Neon database:

```bash
pnpm --filter @sri-aparajita/db seed:dev
```

Verified API:

```text
GET http://localhost:8789/api/v1/super-admin/setup 200
```

Verified web:

```text
GET http://localhost:3000/dashboard/super-admin/setup 200
```

Rendered content included:

- Super Admin Setup
- Anika Sharma
- North Sales Team
- Bengaluru North

---

## 2026-07-04 11:02:51 IST - Super Admin Setup Actions

### Goal

Make the Super Admin setup buttons real actions:

- Add User
- Add Team
- Add Territory

### TDD Steps

1. Added failing React interaction tests for each action.
2. Verified the tests failed because the buttons did not open forms.
3. Converted the Super Admin setup screen into a client component.
4. Added inline forms for user, team, and territory creation.
5. Wired form submits to the existing Super Admin API endpoints.
6. Updated page state after successful API responses.
7. Re-ran web tests until green.
8. Re-ran API route tests to verify the app still passes.

### Frontend Behavior Added

`/dashboard/super-admin/setup` now supports:

- opening a user creation form from `Add User`
- opening a team creation form from `Add Team`
- opening a territory creation form from `Add Territory`
- posting each form to the API
- appending the newly created record to the visible list after success

### API / Browser Support

Updated API CORS headers to allow the placeholder auth headers used by the web app:

```text
X-Beyond-User-Id
X-Beyond-Organization-Id
X-Beyond-Role
```

### Validation Status

Passed during this slice:

```bash
pnpm --filter @sri-aparajita/web test
pnpm --filter @sri-aparajita/api test
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Note: `pnpm build` required sandbox elevation because Turbopack needs to spawn an internal process and bind a local port during CSS processing.

---

## 2026-07-05 — Collections & Alerts (API + Web)

### Collections

Full collections workflow for the ACCOUNTANT and SUPER_ADMIN roles.

**API** (`apps/api/src/routes/collections.ts`, `apps/api/src/services/collections.ts`):

- `GET /api/v1/collections` — list with optional `?status=pending|verified|rejected`
- `POST /api/v1/collections` — create a new collection record
- `GET /api/v1/collections/:id` — fetch a single collection with linked customer + sales executive names
- `POST /api/v1/collections/:id/verify` — ACCOUNTANT or SUPER_ADMIN only; marks status `verified`
- `POST /api/v1/collections/:id/reject` — ACCOUNTANT or SUPER_ADMIN only; requires `remark` in body; marks status `rejected`; creates an alert for the Sales Executive

**Web** (`apps/web/src/app/dashboard/collections/`):

- `/dashboard/collections` — list page with tab filter (Pending / Verified / Rejected / All); shows collection amount, customer name, collected-by, and date
- `/dashboard/collections/new` — create form: customer dropdown, amount, payment mode, reference, notes
- `/dashboard/collections/[id]` — detail page with Verify / Reject actions; reject shows an inline remark input

**Role guard**: Verify/Reject buttons are shown only to ACCOUNTANT and SUPER_ADMIN.

### Alerts

Alerts are system-generated events (e.g., rejected collections) surfaced to SUPER_ADMIN and MANAGER.

**API** (`apps/api/src/routes/alerts.ts`, `apps/api/src/services/alerts.ts`):

- `GET /api/v1/alerts` — filterable by `?status=open|closed`, `?severity=info|warning|critical`, `?alertType=<type>`
- `POST /api/v1/alerts/:id/close` — SUPER_ADMIN or MANAGER only

**Web** (`apps/web/src/app/dashboard/alerts/`):

- `/dashboard/alerts` — list with Open / All / Closed tabs; Close button per row (SUPER_ADMIN + MANAGER only)
- Linked from both "Approvals" and "Pending Verification" quick-action cards on the Manager dashboard

---

## 2026-07-06 — Workers Best Practices Review + Security Fixes

### Workers Best Practices

Ran `/workers-best-practices` review against `apps/api`. Two config fixes applied:

**1. `nodejs_compat` flag** (`apps/api/wrangler.jsonc`)

The `compatibility_flags` array was commented out. Enabled it:

```jsonc
"compatibility_flags": ["nodejs_compat"]
```

Required for any library that uses Node.js built-ins (path, buffer, etc.) under the hood.

**2. Observability** (`apps/api/wrangler.jsonc`)

The `observability` block was commented out. Enabled it:

```jsonc
"observability": { "enabled": true, "head_sampling_rate": 1 }
```

Surfaces structured logs and traces in the Cloudflare dashboard at no extra cost.

### Security Fixes

Ran `/security-review` against alerts and collections services. Two bugs found and fixed.

**Fix 1: Missing alert filters** (`apps/api/src/services/alerts.ts`)

`listAlerts` captured `severity` and `alertType` query params in the filters interface but never applied them to SQL — only `status` was filtered. The `WHERE` clause was rewritten to apply all three:

```sql
where 1=1
  ${filters.status    ? sql`and a.status     = ${filters.status}`    : sql``}
  ${filters.severity  ? sql`and a.severity   = ${filters.severity}`  : sql``}
  ${filters.alertType ? sql`and a.alert_type = ${filters.alertType}` : sql``}
```

**Fix 2: Missing status guard on verify/reject** (`apps/api/src/services/collections.ts`)

`verifyCollection` and `rejectCollection` did not check `accountant_approval_status` before proceeding, so a collection could be verified or rejected multiple times. Both functions now:

1. Fetch `accountant_approval_status as "status"` from the DB first
2. Return 404 if the collection does not exist
3. Return 409 (`CONFLICT`) if status is not `pending`

Test coverage added in `apps/api/src/routes/collections.test.ts`:
- 409 when verifying an already-verified collection
- 409 when rejecting an already-verified collection

---

## 2026-07-07–08 — Mobile App Phase 1 (Sales Executive)

### Project Creation

Created the Expo app inside `apps/`:

```bash
cd apps
npx create-expo-app@latest beyond-distribution-management-systems
```

Uses Expo SDK 57, React Native 0.86, React 19, Expo Router (file-based routing). Lives at `apps/beyond-distribution-management-systems/`.

**Important**: This app is inside the pnpm monorepo but manages its own packages with npm (Expo tooling expects npm). Do **not** run `pnpm install` inside this directory — use `npm install` or `npx expo install`.

### NativeWind v4 + Tailwind v3

Chose NativeWind v4 (stable) over v5 preview to ensure Expo Go compatibility. NativeWind v5 breaks Expo Go.

Packages installed:
```bash
npx expo install nativewind tailwindcss react-native-reanimated react-native-safe-area-context
npm install zustand
npx expo install expo-secure-store expo-sqlite
```

Config files created:

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Content glob, `nativewind/preset`, primary brand colour `#1D4ED8` |
| `babel.config.js` | `babel-preset-expo` with `jsxImportSource: "nativewind"` + `nativewind/babel` preset |
| `metro.config.js` | `withNativeWind(config, { input: "./src/global.css" })` |
| `src/global.css` | `@tailwind base/components/utilities` |
| `nativewind-env.d.ts` | `/// <reference types="nativewind/types" />` |
| `src/types/declarations.d.ts` | `declare module "*.css"` to silence TypeScript CSS import errors |

### Authentication Store

`src/store/auth.ts` — Zustand store backed by `expo-secure-store` (encrypted keychain).

State: `{ token, user, isLoading }`

| Action | Behaviour |
|--------|-----------|
| `setAuth(token, user)` | Persists to SecureStore keys `beyond_auth_token` and `beyond_auth_user` |
| `loadFromStorage()` | Reads both keys on app boot (called in root layout) |
| `logout()` | Deletes both keys, clears state |

### API Client

`src/lib/api.ts`

```ts
API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8787"
```

`10.0.2.2` is the Android emulator's reference to host localhost (port 8787 = Wrangler dev). For a real device, set `EXPO_PUBLIC_API_URL=http://<machine-local-ip>:8787` in `.env.local`.

Exports: `ApiError` class, `apiFetch<T>()` generic authenticated fetch, `login()`.

### Offline SQLite Schema

`src/db/schema.ts` — `initDb()` opens `beyond.db` and creates:

| Table | Purpose |
|-------|---------|
| `visits` | Field visit records pending sync |
| `orders` | Orders created offline |
| `order_items` | Order line items |
| `collections` | Collections pending sync |
| `gps_pings` | GPS coordinates during a visit |
| `sync_queue` | Records waiting to be pushed to API |
| `beat_plan_cache` | Today's beat plan cached for offline access |

All tables have `synced INTEGER DEFAULT 0` and `synced_at TEXT` columns.

### Beats API Endpoint

**Service + route** (`apps/api/src/services/beats.ts`, `apps/api/src/routes/beats.ts`):

```
GET /api/v1/beats/today   — requireAuth(); any authenticated user
```

Returns the logged-in SE's beat plan for today matched on `plan_date = current_date`:

```json
{
  "beatPlanId": "uuid",
  "planDate": "2026-07-08",
  "planStatus": "active",
  "stops": [
    {
      "stopId": "uuid",
      "sequenceNo": 1,
      "stopStatus": "pending",
      "customerId": "uuid",
      "customerCode": "C001",
      "legalName": "Raj Auto Works",
      "contactPhone": "+91 98765 43210",
      "address": "12 Main Road, Hyderabad"
    }
  ]
}
```

Returns `{ beatPlanId: null, stops: [] }` when no plan exists for today.

Registered in `apps/api/src/index.ts` under `v1.route("/beats", beatsRoutes)`.

Tests in `apps/api/src/routes/beats.test.ts` (written TDD — red before green):
- SE gets plan with stops
- Empty result when no plan exists
- 401 for unauthenticated request

### App Screens

| File | Screen |
|------|--------|
| `src/app/_layout.tsx` | Root layout — imports CSS, calls `initDb()` + `loadFromStorage()`, redirects by auth state |
| `src/app/(auth)/_layout.tsx` | Auth stack with no header |
| `src/app/(auth)/login.tsx` | Email/password form; role guard blocks non-SE; on success calls `setAuth()` then navigates to `/(exec)` |
| `src/app/(exec)/_layout.tsx` | Guard: redirects to login if no token or role ≠ SALES_EXECUTIVE |
| `src/app/(exec)/index.tsx` | Beat list — header with SE name + logout; `FlatList` with pull-to-refresh; status badges (Pending / Checked In / Done); empty state |

### How to Run

```bash
# Terminal 1 — API dev server
cd apps/api && pnpm dev

# Terminal 2 — Expo dev server
cd apps/beyond-distribution-management-systems
npx expo start
# Press 'a' for Android emulator, or scan QR with Expo Go on device
```

For a physical device, create `apps/beyond-distribution-management-systems/.env.local`:
```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8787
```

### Skills Installed

Installed from `https://github.com/obra/superpowers` into `.agents/skills/` (project-level):

`test-driven-development`, `hono`, `neon-postgres`, `postgresql-schema-design`, `postgresql-query-optimization`, `react-native-best-practices`, `shadcn`, `tailwindcss-advanced-layouts`, `typescript-advanced-types`, `expo-tailwind-setup`

Global skills in `~/.claude/skills/`: `workers-best-practices`, `security-review`
