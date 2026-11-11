# Distribution OS — Phase 2 build notes (enterprise_id + RLS foundation)

> Working notes for the enterprise foundation. Status: **DONE + live-verified** on the new Neon DB. Schema applied, RLS leak test passes, app-side scoping + auth wiring cut over, full API suite green (1326), and an end-to-end HTTP request proves isolation (`apps/api/src/phase2-live.test.ts`).

## What exists so far

- `packages/db/tools/_source-schema.sql` — the introspected Sri Aparajita live schema (`pg_dump --schema-only`, the true end-state). Source of truth for the consolidation.
- `packages/db/tools/generate-init.mjs` — deterministic generator. Re-run with `node packages/db/tools/generate-init.mjs`.
- `packages/db/migrations/0001_init.sql` — **the single consolidated multi-enterprise baseline** (replaces the 23 old migrations, which are gone from this repo but preserved in the Sri Aparajita repo history).
- `packages/db/tools/verify-rls.mjs` — cross-enterprise leak test (the Phase-2 gate).

## Classification (locked with owner 2026-11-11)

- **Scoped (69 tables)** — `enterprise_id uuid NOT NULL` + `enterprises` FK + RLS. All business tables, **billing tables** (`billing_charges`, `billing_payment_events` — enterprise reads its own, owner reads all via bypass) and **`audit_logs`**.
- **Global (5)** — `roles`, `role_permissions`, `error_events`, `error_groups`, `error_notes` (Error Monitor = platform-global). No `enterprise_id`, no RLS.
- **Excluded** — `schema_migrations` (the migration runner owns it) and all `neon_auth.*` (Neon Auth provisions its own schema on the new DB; no public→neon_auth FK exists, and `users.app_login_id` is a plain text link).
- **New foundation (6)** — `enterprises`, `platform_owners`, `enterprise_billing_config`, `subscription_invoices`, `onboarding_drafts`, `dues_bands`.

## Composite keys (so two enterprises don't collide)

Natural-key uniques made `(enterprise_id, …)`: customer/order/collection/visit codes, invoice number, GRN/adjustment/transfer numbers, expenditure code, `products.product_name`, `brands(category,name)`, `expenditure_categories.name`, `stock_locations.code`, `invoice_series(prefix,fin_year)`, `billing_charges.period_start`, and the **`system_settings` PK → `(enterprise_id, key)`**. Opaque/uuid-based uniques (file keys, tokens, push endpoints, `(user_id,…)` / `(customer_id)` keys) left as-is — already globally unique.

## RLS model (owner-vs-tenant — no FORCE, no BYPASSRLS)

Standard Postgres multi-tenant pattern, chosen so it works on Neon **without superuser**:

- **Owner role** (runs migrations, control-plane, the admin cockpit) = the table owner. RLS is **ENABLE**d but **not FORCE**d, so the owner **bypasses RLS naturally** — it manages `enterprises`, reads across all enterprises, seeds, etc.
- **`app_tenant`** (NOLOGIN) — the enterprise API's role. Non-owner, so RLS **applies**. The app runs each request as `SET LOCAL ROLE app_tenant; SET LOCAL app.enterprise_id = '<id>'` inside the txn → sees only its enterprise. Granted via `GRANT app_tenant TO <owner>` so the owner connection can `SET ROLE` into it.
- **`app_readonly`** (NOLOGIN) — SELECT-only tenant for the Phase-4 MCP.
- Scoped-table policy: `enterprise_id = current_setting('app.enterprise_id', true)::uuid` (USING + WITH CHECK). `current_setting(…, true)` is NULL when unset → **fails closed** (zero rows).
- `enterprises` — tenant gets `FOR SELECT` on its own row (`id = app.enterprise_id`); **writes are owner-only** (so onboarding-submit / approval run on the owner/control-plane path). `onboarding_drafts` — `user_id = app.user_id`. `platform_owners` — RLS on, no policy + privileges revoked from tenants → owner-only.

This removes the earlier `BYPASSRLS` dependency entirely: the owner bypasses because it owns the tables (not forced), and the tenant is isolated because it's a different role. Nothing needs superuser.

## ⚠️ OPEN — to verify on the real Neon DB / still to build

1. **App-side GUC plumbing (the next big piece).** Every request must `SET LOCAL ROLE app_tenant` + `SET LOCAL app.enterprise_id = <caller's enterprise>` inside the same transaction as its queries. The app uses the Neon serverless HTTP driver (stateless per statement), so reads/writes must move into `sql.transaction([...])` (or an equivalent that pins one session) with those two SETs first. This touches `getSqlClient` + every query path — centralised in one helper, not per-call. The enterprise API should also connect on a role that defaults to (or is pinned to) `app_tenant`; the cockpit/migrations use the owner role.
2. **Enterprise-creation path.** Because `enterprises` writes are owner-only, onboarding-submit and owner approval run on the owner/control-plane connection (or a `SECURITY DEFINER` function), not the `app_tenant` connection. Design in the onboarding phase.
3. **Connection role for apply.** The migrate runner uses `postgres.js` (direct TCP) as the DB owner. Confirm the new Neon URL is a **direct** (non-pooled) endpoint for migrations.
4. **Grants to future tables.** New tables created later must also be `GRANT`ed to `app_tenant`/`app_readonly` (add to each future migration, or set `ALTER DEFAULT PRIVILEGES`).

## Done

1. ✅ `pnpm install`; `pnpm migrate` applied `0001_init.sql` to the new Neon DB.
2. ✅ `verify-rls.mjs` passes (incl. INSERT auto-scope via the DEFAULT).
3. ✅ Owner-vs-tenant RLS (no BYPASSRLS) — resolved, no Neon superuser needed.
4. ✅ App-side scoping: `createScopedSqlClient` wraps every query in a one-round-trip
   neon transaction with `SET LOCAL ROLE app_tenant` + the GUC (Proxy preserves
   neon's lazy-descriptor composition — 664 call sites untouched).
5. ✅ Auth wiring: `attachAuthContext` resolves `users.enterprise_id`; `getSqlClient`
   scopes authenticated requests (fail-closed) and uses the owner client otherwise.
6. ✅ Live E2E proof against the real app + DB (`phase2-live.test.ts`).

## Remaining (later sub-phases, not blockers)

- **Owner cockpit / control-plane** reads across enterprises via `getOwnerSqlClient`
  (build when the `admin.` cockpit is built).
- **Enterprise-creation path** (onboarding submit / approval) writes `enterprises`
  on the owner connection (writes are owner-only) — design in Phase 3.
- **Real Neon Auth** on the new DB (the live test mints its own EdDSA token + mocks
  JWKS; a real login needs Neon Auth provisioned for the new project).
- **Least-privilege app role**: the API still connects as the DB owner and `SET ROLE`s
  to `app_tenant` per request; a dedicated login role is a hardening step.
