---
name: sri-aparajita-bearings-removed
description: Sri-Aparajita catalogue is now Oils-only; bearings + filters fully removed (mobile→web→API→DB) as of 2026-10-17
metadata:
  type: project
---

Sri-Aparajita's catalogue is **Oils only**. Bearings AND filters were removed end-to-end in a 4-phase effort (completed 2026-10-17), each phase committed separately by the user after a SonarQube pass:

- **Phase 1 (mobile):** bearings removed from the SE app; oil-only stats cards restored (shipped via EAS OTA).
- **Phase 2 (web):** catalogue→orders→invoices→reports→dashboard→targets all oils-only.
- **Phase 3 (API):** deleted `routes/bearings.ts`, `routes/filters.ts`, `services/bearings.ts`, `services/filters.ts`; removed `/bearings`, `/filters`, `/orders/bearings`, `/orders/filters`, `/dashboard/analytics/bearings`; dropped bearing/filter from order pipeline, invoices (`bearingQty`), targets (`target_bearing_value` value-slot), sku-analytics, sales-returns, tracking, brands (`BRAND_CATEGORIES=["oils"]`).
- **Phase 4 (DB):** migration `0098_drop_bearings_filters.sql` — HARD DROP + data purge. Dropped `bearings`+`filters` tables, `order_items.{bearing_id,bearing_part_no,filter_id,filter_part_no,filter_type}`, `invoices.bearing_qty`, `se_targets.target_bearing_value`, `stock_items.bearing_id`; tightened `order_items_line_kind` (oil-only), `stock_items.category`, `brands.category` CHECKs; purged legacy non-oil order lines (+ their allocations/sales-return items), bearing stock rows, bearings/filters brand rows. Applied + verified against PROD Neon.

**Deploy ordering caveat:** columns were dropped BEFORE confirming the Phase 3 API was deployed. The deployed `apps/api` MUST be the bearing-free (Phase 3) build — an older deployed API queries the now-dropped columns/tables and 500s. See [[project-local-web-uses-deployed-api]] and [[project-deploy]].

Contrast with [[sree-balaji-catalogue]]: Sree-Balaji kept a `parts` table (Hero Genuine Parts, renamed from bearings in its own migration 0096). Sri-Aparajita has NO parts/bearings/filters at all — pure oils.
