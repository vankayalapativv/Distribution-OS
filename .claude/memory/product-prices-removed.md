---
name: product-prices-removed
description: "MRP/MOP/DLP DROPPED from product_packs (migration 0019 APPLIED) — the catalogue is pack-SIZE only; the client now enters MRP/DLP/MOP per scenario in the Margin simulator (margin_simulations unchanged). Removed from product create/edit + list + bulk-import template (now 6 cols) + PDF export + the margin product-price prefill. Invoices untouched. API 100% cov, UNCOMMITTED 2026-11-06"
metadata:
  node_type: memory
  type: project
  originSessionId: f1881b67-1d6b-4ccc-99cb-7dba425d1e08
  modified: 2026-11-05T21:38:55.136Z
---

**Product pricing removed from the catalogue** (2026-11-06). MRP/MOP/DLP are no longer a property of a product — the client enters them **per scenario in the Margin simulator**. Migration **0019 `drop_product_pack_prices` APPLIED to prod** drops `product_packs.mrp/mop/dlp` (destructive; old per-pack prices discarded — user-approved). The code never references those columns anymore, so it worked both **before and after** the drop (no migration-ordering risk, unlike 0016–0018). Feature code **UNCOMMITTED, not deployed**.

- **`product_packs` is now pack-SIZE only.** API: `product-packs.ts` (`PackInput` = `{packSize}`, `packWriteArrays` = `{sizes}`), `products.ts` (PRODUCT_SELECT json drops mrp/mop/dlp; create/update/bulk inserts list only `pack_size_litres`; `mapPacks`/`resolvePackArrays` size-only); the route just passes `packs` through. **`invoice_items.mrp` is a SEPARATE client-typed line snapshot — UNTOUCHED** (invoice creation never prefilled MRP from the product).
- **Web — removed everywhere:** `products-types.ts` `ProductPack` = `{packSize, stock*}`; `pack-rows.tsx` is now size chips only (no MRP/MOP/DLP inputs); product-list column "Packs · MOP" → **"Pack sizes"** (`oil-columns.tsx`); add/edit dialog step "Packs & pricing" → **"Pack sizes"** (`add-product-wizard.tsx`, `product-dialog.tsx`); the **bulk-import template is now 6 columns** (`Product Name · Brand · Unit · Segments · HSN · Pack Size (L)`) — `products-import.ts` `BulkPack` = `{packSize}`, parser drops the price cols; the catalogue **PDF export** drops the MRP/MOP columns (`catalogue-export.ts` / `catalogue-export-rows.ts`).
- **Margin simulator:** stopped pulling prices from the product — `OilProduct.packs` are size-only (`margin-api.ts`) and `margin-entry-dialog.tsx` no longer prefills MRP from the product pack. The simulator's OWN **MRP / DLP / MOP inputs stay** (the client types all three); the `margin_simulations` table and `margin.ts` are unchanged.
- **1290 API tests pass; products + product-packs services 100% line coverage.** Verified live (Products list + Edit dialog show sizes only; Margin table keeps MRP/DLP/MOP). Nothing committed.

Related: [[excel-bulk-import]], [[stock-per-batch-rate-costing]], [[oil-segment-canonical-six]], [[local-dev-uses-live-prod]].
