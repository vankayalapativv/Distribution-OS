# Database Inventory — Sri Aparajita Automobiles & Lubricants

Single-client (standalone) deployment. Analysis date: **2026-07-21**; verified and corrected **2026-07-22** (table count 66 → 69 after migrations 0032/0033; `branches` added to unused; `territory_assignments` reclassified as unused).
Method: every app table (from `packages/db/migrations/`) cross-referenced against all SQL usage in `apps/api`, `apps/web`, `apps/mobile`, combined with live-DB row counts (`pg_stat_user_tables`).

> Field trial has been live since 2026-07-17, so populated tables may contain **real** data. None of the "unused" tables below hold trial data.

## 1. `organization_id` — written but never read

- The column exists on every app table and every INSERT populates it via the `(select id from organizations limit 1)` subquery (~16 service files).
- **No query anywhere filters by `organization_id`.** The single `WHERE`-looking reference just *reads* it to copy into a child INSERT.
- The `organizations` table holds exactly **1 row**, used only to feed that subquery.

**Verdict:** functionally dead in a single-client deployment — inert multi-tenant scaffolding. Harmless; only relevant if a future cleanup wants to drop it.

## 2. Unused tables — 27 of 69 app tables

Zero SQL references in any app code (`branches` and `territory_assignments` appear only in `packages/db` setup/seed scripts, never in the apps). Live DB confirms all are empty except `beats` (1 stale seed row). **None contain field-trial data.**

| Cluster | Tables (0 rows unless noted) |
|---|---|
| Old delivery model — replaced by `delivery_runs*` (migration 0018) | `deliveries`, `delivery_items`, `delivery_proofs` |
| Old beat/territory model — app uses `beat_plans`/`beat_plan_stops` | `beats` *(1 row)*, `beat_assignments`, `territory_assignments`, `branches` |
| Granular RBAC never wired — app uses `roles` + `user_roles` | `permissions`, `role_permissions` |
| Incentives / schemes never built | `executive_incentive_ledger`, `retailer_incentive_ledger`, `retailer_incentive_plans`, `schemes`, `scheme_products` |
| Rules / recommendations never built | `rule_definitions`, `rule_executions`, `recommendations` |
| Analytics snapshots never populated | `customer_monthly_metrics`, `territory_monthly_metrics`, `product_stock_snapshots` |
| Invoicing partial (placeholder) | `invoice_items` |
| Other unbuilt | `approval_requests`, `audit_logs`, `cheque_status_history`, `notification_logs`, `visit_photos`, `visit_products` |

## 3. Wired but empty (referenced by code, 0 rows)

**Not unused** — built features with no trial data yet. Do not confuse with dead tables:

`invoices`, `tasks` / `task_comments` / `task_attachments`, `market_notes` / `market_note_items`, `collection_allocations`, `beat_plans` / `beat_plan_stops`, `customer_assignments`, `daily_executive_performance`, `aging_snapshots`.

Also wired but not yet deployed/populated: `brands`, `filters`, `product_pack_sizes` (migrations 0032/0033, added 2026-07-22).

## 4. Non-app tables (Neon Auth — do not touch)

Present in the DB but **not in any migration** — managed by the Neon Auth provider (singular names, vs the app's plural `users` / `organizations`). They back SUPER_ADMIN login (RS256):

`user`, `account`, `session`, `organization`, `member`, `invitation`, `verification`, `jwks`, `project_config`

(`user`, `account`, `project_config` have 1 row each; the rest empty.)

## Top tables by row count (live)

| Table | Approx rows |
|---|---|
| `bearings` | 1,829 |
| `gps_points` | 1,522 |
| `tracking_device_heartbeats` | 964 |
| `customers` | 216 |
| `product_segments` | 86 |
| `products` | 64 |
| `customer_photos`, `order_items` | 20 each |
| `gps_tracking_sessions` | 18 |
| `users`, `user_roles` | 13 each |

## Summary

- **`organization_id`:** dead but harmless (written, never filtered).
- **27 app tables unused** (26 empty + `beats`'s 1 orphan row), clustered around superseded models and never-built features.

## Resolution — 2026-07-23

Both findings were acted on:

- **Migration `0034_drop_unused_tables.sql`** drops all 27 unused tables (FK-ordered, children first) plus the dead FK columns surviving tables pointed at them with (`customers.beat_id`/`branch_id`, `orders.beat_id`, `visits.beat_id`, `beat_plans.beat_id`, `alerts.rule_execution_id`, `teams`/`territories`/`users.branch_id`). It also relaxes `organization_id` to nullable everywhere and adds the plain unique constraints (`customer_code`, `order_code`, `invoice_number`, `collection_code`, `visit_code`, `territory_code`, `users.email`/`phone`, `products.product_name`, `daily_executive_performance(metric_date, executive_id)`, `aging_snapshots(snapshot_date, invoice_id)`) that replace the old `(organization_id, …)` composites.
- **All application code stopped writing `organization_id`** — the `(select id from organizations limit 1)` subquery was removed from every INSERT in `apps/api` services and `packages/db` setup/seed scripts; `executive-day.ts` no longer selects or copies `beat_id`.
- **Migration `0035_drop_organization_id.sql`** (apply only after the updated API is deployed) drops the `organization_id` column from all 35 surviving tables that had it, recreates the two useful composite indexes without the org prefix, and drops the now-orphaned `organizations` table.

Deploy order matters: apply `0034` → deploy `apps/api` → apply `0035`. The Neon Auth tables in section 4 are untouched.
