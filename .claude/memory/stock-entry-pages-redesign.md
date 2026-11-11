---
name: stock-entry-pages-redesign
description: "Stock Journal redesign: full-page /stock/entry (sectioned spreadsheet grid) + Stock-home dashboard, stock lookup, per-godown stat-card drill-downs, context-aware shimmers; batch/expiry/location capture (stock-in + opening), FEFO near-expiry. SHIPPED 2026-11-05: committed + api&web deployed + 0014 applied + dummy data wiped. Batch-level inventory deferred."
metadata:
  node_type: memory
  type: project
  originSessionId: 159187b8-bc32-44dd-ab2a-4194814b3bd8
  modified: 2026-11-05T03:29:21.349Z
---

Converting the Stock Journal's modal dialogs into **full pages with a spreadsheet-grid UX**, plus capturing **batch / expiry / rack / shelf / bin** on stock-in and opening and surfacing nearest-expiry SKUs first (FEFO). Relates to [[invoicing-stock-phase1]] and [[oil-segment-canonical-six]].

**Status: SHIPPED 2026-11-05.** Committed (user), then **api + web deployed to prod** (API `sri-aparajita-api`, web `sriaparajita.vardhansystems.in`); migrations 0012/0013/0014 all APPLIED ([[product-names-title-cased]]); the deploy also carried the earlier [[invoice-transport-charge-and-pdf]] commit (351efa7) live. E2E dummy data (2 GRNs, 1 transfer, 1 adjustment, 3 opening items, 11 movements, 8 balances) was **wiped** afterward — stock back to zero, godowns (Bachupally, Hayatnagar) + 230 products kept. New API code has **100% line+branch test coverage** (service + route layers).

## What's built
- **Stock-in spreadsheet grid** (chosen from 4 mock options — artifact https://claude.ai/artifact/3Q3vhF8HteZgULTtBiM8FF). One row per product: Product · Qty · Rate · Batch · Expiry · Rack · Shelf · Bin · Amount (qty×rate, live). Borderless cells. Replaced the old cramped per-line sub-row. Batch/expiry/location stored in `goods_receipt_items` (migration **0012**, applied). `listNearExpiry` orders by `expiry_date asc`.
- **Four dialogs → one page `/stock/entry`** with a segmented switcher (`?type=in|opening|transfer|adjust`), full-page layout (switcher → meta card → grid → sticky action bar). Journal buttons navigate there and return to `/stock` after posting. Pages mock: https://claude.ai/artifact/DgtQUgkCKc5EATYn9gmpyy
- **Phase 1b — opening persistence (migration 0013 APPLIED):** new `opening_stock_items` table (location, product, pack, qty, batch/expiry/rack/shelf/bin, opening_date; types mirror `goods_receipt_items`). `postOpening` writes a detail row per line in-txn; `listNearExpiry` now **UNIONs** GRN + opening (opening rows labelled "Opening stock"). Opening panel uses the full `OpeningGrid`.
- **UX fix:** the sticky ActionBar (summary + Cancel + Post) is **hidden when the grid is empty** (gated on `L.lines.length > 0`); the top-right "← Stock Journal" link handles leaving. Applied to all 4 panels.
- **Stock-home dashboard + extras (2026-11-05):** `/stock` is a "Stock home" dashboard (KPI cards → SKUs/Total litres/Below reorder, Expiring-soon FEFO, On-hand top movers, Recent activity). **Stock lookup** popup (on-hand per godown + batches + recent movements for one product; `GET /stock/lookup`, `lookupProductStock`). **Stat-card drill-downs**: SKUs & Total-litres cards open a per-godown breakdown (`GET /stock/summary/by-godown`, `balancesByGodown`); Below-reorder opens a low-stock list. **Sectioned** entry pages (no switcher, no back-nav); brand-filtered SKU search on stock-in (supplier brand gates/filters); supplier invoice no mandatory. New **MonthYearField** (month+year only, allows future) for expiry. **Context-aware shimmers** everywhere (shared `Shimmer` sweep; godown-switch forces a brief shimmer). Labels are **sentence case** (removed `uppercase` util; acronyms stay upper). Header: Stock lookup · All-godowns filter · Record stock-in · ⋮. New files: `stock-godown-dialog.tsx`, `stock-lookup-dialog.tsx`, `stock-skeletons.tsx`, `components/form/month-year-field.tsx`. All SonarQube findings on the touched files fixed before commit.

## Files
- `apps/web/src/features/stock/stock-entry.tsx` — page shell + switcher (`withQueryClient`, `StockEntryPage`, `EntryType`).
- `apps/web/src/features/stock/stock-entry-panels.tsx` — `StockInPanel/OpeningPanel/TransferPanel/AdjustPanel` + shared `ActionBar`.
- `apps/web/src/features/stock/stock-dialogs.tsx` — NOW the shared "stock-entry kit" (the 4 modal dialogs + `Shell` DELETED). Exports: `useLines, GrnGrid, OpeningGrid, LineTable, LocationSelect, DateCell, qtyInput, outQtyCell, useOnHand, gridCell, num, valid, keyOf, REASONS, Line`.
- `apps/web/src/app/(dashboard)/stock/entry/page.tsx` — route, WRITE_ROLES (SA/MANAGER) only, reads `?type=`.
- `apps/web/src/features/stock/stock-journal.tsx` — buttons use `router.push('/stock/entry?type=…')`; dialog renders/import removed.
- `apps/web/src/features/stock/stock-api.ts` — `NearExpiryRow`/`fetchNearExpiry`; `OpeningLine` + `postOpening` payload gained batch/expiry/location.
- `apps/api/src/services/stock.ts` — `OpeningInput` + `postOpening` write `opening_stock_items`; `listNearExpiry` UNION.
- `apps/api/src/routes/stock.ts` — opening route parses batch/expiry/location.
- `apps/api/src/services/stock.test.ts` + `apps/api/src/routes/stock.test.ts` — 100% line+branch coverage of the new service fns (`balancesByGodown`, `lookupProductStock`, rewritten `listNearExpiry`, extended `postOpening`) and the new routes (48 stock tests).
- `packages/db/migrations/0012_grn_batch_expiry_location.sql`, `0013_opening_stock_items.sql`, `0014_product_name_title_case.sql` — all APPLIED to prod (tracked in `schema_migrations`).

## Deferred — Phase 2 (user agreed to phase it)
**Batch-level inventory:** Transfer/Adjust should let you PICK an existing batch whose expiry + shelf location travel with it. Requires stock tracked **per batch** (schema change: batch-keyed balances) — bigger than UI. Shown in the pages mock but NOT built. Transfer/Adjust are qty-only for now (unchanged from today).

## Done this session (2026-11-05)
E2E tested through the real UI (all features passed) → committed → **deployed api + web** → wiped dummy data → confirmed 0014 applied. Added `balancesByGodown`, `lookupProductStock` services + `/stock/summary/by-godown`, `/stock/lookup`, `/stock/near-expiry` routes, all with 100% test coverage (`services/stock.test.ts` + `routes/stock.test.ts`). The deploy also carried the previously-undeployed [[invoice-transport-charge-and-pdf]] (351efa7) live.
