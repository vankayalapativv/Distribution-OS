# Bearing removal — deferred plan (as of 2026-10-04)

**Status: NOT STARTED. Deferred by the user on 2026-10-04.** This client (Sri Aparajita)
is **purely oils** — no bearings, no filters. Two related pieces of work are both deferred
and captured here: **(1) the app-wide bearing removal** (this document, below), and **(2) the
mobile Orders company/brand tabs** (see the dedicated section at the end). Neither is built
yet — implementation was started and then reverted on 2026-10-04 so the tree stays clean until
we pick these up.

## Decisions already taken
- **Scope when we do it:** mobile **and** web (app-wide).
- **Depth:** NOT decided. The user has not chosen UI-only vs full schema removal. **Default
  recommendation: UI-only — hide bearings from every screen but KEEP the DB tables, columns,
  and historical read paths.** Rationale below. Do not drop schema without an explicit decision.
- **Client is purely oils** — so the "Other products" value target (the old bearing slot) has
  nothing non-oil to measure and can be removed from the UI too.

## Why UI-only is the safe default (landmines)
1. **`se_targets.target_bearing_value` (migration `0041`)** is no longer "bearings" — the code
   (`apps/api/src/services/targets.ts:126-131`) repurposed it to sum the value of **all non-oil
   products** (bearings + filters + quantity-unit products). Mobile already labels it
   *"Other products"* (`apps/mobile/src/components/home/performance-card-body.tsx:31`). For a
   purely-oil client this slot targets nothing → remove from UI; do NOT just "delete the bearing
   target".
2. **Invoice parsing keys off HSN, not a flag:** `8482 = bearing`, `8421 = filter`, else oil
   (`apps/web/src/features/invoices/invoice-parse-items.ts:4-6,22-23`;
   `apps/api/src/services/invoice-sku-match.ts:76,82-86`). If a received invoice ever carries an
   8482 line, removing bearing handling from the parser would mis-class it as oil (wrong
   litres/segment math) or drop it. Keep the parser tolerant of 8482 even after UI removal.
3. **Historical orders reference bearings:** `order_items.bearing_id` / `bearing_part_no` +
   the `bearings` table (migrations `0019`, `0033`, `0050`, `0076`). Order-detail reads,
   fulfillment predicates, order roll-ups, and dashboard/report queries all
   `filter (where oi.bearing_id is not null)`. Dropping these breaks history reads. Leave intact.
4. **`sales_return_items.kind='bearing'` (migration `0049`)** — same caution as invoices.
5. **`bearings.ts` keeps `moq:1`** for old installed APKs — confirm field APK rollout before
   changing the bearings response shape.

## Full touchpoint map
The exhaustive file:line map lives in the session transcript (exploration agent
`aa5c0210a8ec50905`, 2026-10-04). Grouped surfaces to remove/hide:

### API (`apps/api/src/`)
- Targets: `services/targets.ts`, `routes/targets.ts` — drop the `bearingValue`/`target_bearing_value`
  slot from inputs + payloads (or rename to a neutral non-oil slot if a future client needs it).
- Invoices: `services/invoices.ts`, `routes/invoices.ts`, `services/invoice-sku-match.ts` —
  keep HSN-8482 tolerant parsing; stop surfacing a dedicated "bearing" aggregate.
- Dashboard/analytics/reports: `services/dashboard-analytics.ts`, `services/sku-analytics.ts`,
  `services/dashboard-metrics.ts`, `services/reports.ts`, `routes/dashboard.ts`
  (`GET /analytics/bearings`).
- Orders: `services/orders.ts`, `services/orders-queries.ts`, `services/fulfillment.ts`,
  `services/sales-returns.ts` — keep historical read paths; stop creating new bearing lines.
- Catalogue entity: `services/bearings.ts`, `routes/bearings.ts`, `routes/orders.ts`
  (`/orders/bearings`) — stop exposing for new entry.
- `apps/mcp/src/instructions.ts` — doc string mentions bearings.

### Web (`apps/web/src/`)
- Orders: `features/orders/order-line-items-tabs.tsx` (tabs `["oils","bearings","filters"]`),
  `order-bearing-lines.tsx`, `order-bearing-line-row.tsx`, `use-bearing-lines.ts`,
  `orders-create-helpers.ts`, draft/seed/submit/types files, `orders-api.ts` (`listBearings`).
- Products mgmt: `features/products/bearing-*.tsx`, `use-bearing-form.ts`, `products-types.ts`
  (`ManagedBearing`), catalogue config/export.
- Targets: `features/targets/*` — remove the bearing-value bar/field.
- Invoices: `features/invoices/*` — keep HSN tolerance; drop bearing-specific UI.
- Reports: `features/reports/reports-tables-bearings.tsx`, `reports-catalog.ts`.
- Dashboard: `features/dashboard/*` bearing columns/cards.

### Mobile (`apps/mobile/src/`)
- Orders Bearings tab: removed as a side-effect of the brand-tabs work (see that section).
- `lib/performance.ts` + `components/home/performance-card-body.tsx` ("Other products" stat),
  `lib/admin-dashboard.ts`/`lib/admin-drill.ts`/`components/home/admin-kpi-grid.tsx`
  (Bearings KPI card + drill), `lib/order-detail-map.ts` (`kind:"bearing"`),
  `components/order-detail-body.tsx` (keep for reading historical bearing lines).

### Tests
Many `*.test.ts(x)` reference bearings across api/web/mobile — update alongside each surface.

## Recommended sequencing when picked up
1. Confirm depth (UI-only vs schema) with the user.
2. Web + mobile UI removal of bearing entry + the "Other products" target slot.
3. Keep all historical read paths and HSN-8482 parse tolerance.
4. Leave `bearings` table + `order_items.bearing_id` schema in place unless schema removal is
   explicitly chosen.

---

# Mobile Orders — company/brand tabs (deferred plan, 2026-10-04)

**Status: NOT STARTED. Deferred by the user on 2026-10-04** (implementation started then reverted).

## Goal (user's words)
On the mobile New Order screen, the catalogue currently has two hardcoded top tabs — **Oils /
Bearings**. Replace them with **company/brand tabs** (Fuchs, Savsol, MFC, …). Tapping a company
shows only that company's SKUs. This client has no bearings, so the Bearings tab disappears as a
natural consequence.

## Decisions already taken
- **Tabs are dynamic** — built from the brands present in the catalogue, not a hardcoded list.
- **Keep the existing segment pills** (Car / 2W / 3W / Commercial / Agri / Gear Oil) as a
  **sub-filter *within* the selected brand**.
- Client is **purely oils**, so tabs are oil brands only.

## Implementation map (verified 2026-10-04)

### API — additive, low-risk
- `apps/api/src/services/orders-queries.ts` → `listProducts` (`GET /orders/products`): add
  `p.brand` to the select. The column already exists (`products.brand`, migration `0033`) but is
  NOT currently sent to mobile.
- `apps/api/src/services/orders-shared.ts` → `mapProductRow`: return `brand: nullStr(row.brand)`
  (null for legacy products with no brand). `nullStr` already lives in that file.

### Mobile — confined to the order catalogue (do NOT touch review/cart/targets — that's the
bearing-removal pass)
- `apps/mobile/src/lib/order/types.ts`: add `brand: string | null` to `Product`; add an
  `OTHER_BRAND = "Other"` constant + `brandOf(p)` helper (trims, falls back to `OTHER_BRAND`).
- `apps/mobile/src/lib/order/use-catalogue.ts`: replace the `tab: "oils" | "bearings"` state
  with an active-brand string. Derive the brand list from `products` (via `brandOf`, sorted;
  `Other` last). Default active brand = first brand. `availableSegments` + `filteredProducts`
  are computed from the active brand's products. **Reset `segmentFilter` to null when the brand
  changes** (otherwise a pill from brand A can empty brand B's list). Drop `bearings`,
  `filteredBearings`, `onRequestBearings`, `selectTab`.
- `apps/mobile/src/components/order/catalogue-header.tsx`: render the brand tabs in a horizontal
  `ScrollView` (there may be several brands → must scroll); keep the segment chips below, now
  gated on `segments.length > 0` instead of `tab === "oils"`. Search placeholder becomes
  "Search products" always.
- `apps/mobile/src/components/order/catalogue-list.tsx`: render products only (remove the
  `tab === "bearings"` branch + `BearingRow` import).
- `apps/mobile/src/components/order/catalogue-screen.tsx`: stop passing bearings props; pass the
  active brand + brand list + `onBrand`.
- `apps/mobile/src/app/order/new.tsx`: stop wiring the Bearings tab. Leave the `bearings` query
  disabled (pass `false`) rather than ripping out `use-order-queries.ts` / `api.ts` — the
  bearing-removal pass cleans that up. `ReviewScreen` keeps receiving an empty bearing list.

### Leave untouched (belongs to the bearing-removal pass, NOT this feature)
- `use-order-cart.ts` bearing cart state, `review-screen.tsx` / `review-lines.tsx` bearing
  sections, `/orders/bearings` endpoint, web order screen. They become unreachable from the
  mobile catalogue but are not deleted here.

## Risks / watch-outs
- A product with a null/blank brand must still be orderable → the `Other` bucket handles it.
  Check prod for null-brand oils before assuming every product has a brand.
- Products load async, but `new.tsx` only mounts the catalogue after oils resolve, so the brand
  list is populated at first render. Still, init the active brand lazily
  (`activeBrand = selected ?? brands[0] ?? null`) so it can't go stale.
- No DB migration needed — `products.brand` already exists.
