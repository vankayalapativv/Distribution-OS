# On hold until the Invoices section is complete — ALL DONE 2026-07-24

> **Status:** Invoices section shipped 2026-07-23; feature 1 (targets trim,
> migration 0038) and feature 2 (dues buckets, migration 0039) both shipped
> 2026-07-24. This file is now a historical record of the decisions.

Decided 2026-07-23: build the **complete Invoices section first**. Only after
invoices are fully working do the two features below make sense (dues ageing
needs real invoice data; targets change rides along in the same release).

## 1. Targets → Oil Sales + Bearing Sales only

Remove **Collections** and **Visits** from the targets feature everywhere:

- **API** (`apps/api/src/services/targets.ts` + routes): drop
  `target_collections` / `target_visits` from `GET /targets/me`, `GET /targets`,
  `PUT /targets/:userId` (and eventually the `se_targets` columns, migration).
- **Web** (`apps/web/src/features/targets/*`): Targets card and edit dialog show
  only Oil litres and Bearings qty.
- **Mobile** (`apps/mobile/src/components/performance-card.tsx`): same trim.
- Open question (not yet answered): do the cards keep showing collections/visits
  *actuals* without target bars, or show only the two target metrics?

## 2. Collection dues — ageing buckets + SE notifications — DONE 2026-07-24

Client wants SEs to know how many of their customers sit in each dues bucket:
**0–30 · 30–45 · 45–60 · 60+ days**.

Decisions (answered 2026-07-24):
- **Age basis: invoice date** (dues clock = invoice date, matching Invoices).
- **One bucket per customer**, decided by their **oldest invoice with
  outstanding > 0**.
- **Push on crossing**: daily server check (cron, gated to once per IST day
  after 9 AM via `system_settings.dues_last_run_date`); an UPWARD bucket move
  inserts an `se_notifications` row (type `dues_bucket`) + Expo push. First
  sight seeds silently; downward moves silent; cleared dues delete state.
- **Drill-down**: Home bucket counts tap through to the customer list
  (outstanding + oldest-invoice age) → customer page.

Implementation: migration `0039_customer_dues_state.sql`;
`apps/api/src/services/dues.ts` + `routes/dues.ts` (`GET /dues/me/summary`,
`GET /dues/me/customers?bucket=`); cron hook in `apps/api/src/index.ts`;
mobile `lib/dues.ts`, `components/dues-card.tsx`, `app/dues/[bucket].tsx`,
Alerts screen "Collections due" feed.

## Prerequisite: Invoices section (to build first)

The `invoices` table is wired but empty today — nothing creates invoices.
"Complete Invoices section" = entry/generation flow (web, presumably
ACCOUNTANT/SUPER_ADMIN), list + detail pages, and the outstanding/ageing
fields kept correct so collections reconciliation and the mobile credit gate
run on real data. Scope to be specced when work starts.


> **Update 2026-07-23:** the Invoices section is BUILT (see AGENTS.md). The two features below are now unblocked.
