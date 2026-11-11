# Product HSN + HSN-based invoice matching

**Date:** 2026-07-30
**Status:** ✅ Code-complete + 23 invoice tests pass + typecheck clean. ⏳ **Needs migration `0046` applied FIRST, then API + web deploy, then verify.**

## Why
Invoice uploads were blocked when a line wasn't engine oil. The parser guessed *"HSN 2710 = oil, everything else = bearing"*, so **coolant (HSN 3820)** was mislabelled a bearing and couldn't match its product SKU on the order (e.g. MG Car Service coolant on ORD-0058). Fix: products carry their own HSN, and matching is HSN-driven.

## Design (locked with the user)
- **Products** get a **required HSN** (`products.hsn_code`). Backfill: oils → **2710**, coolant → **3820**.
- **Bearings = 8482, filters = 8421** — constants handled in code, not stored.
- **Matching** = exact HSN gate, then disambiguate: 8482 → bearing (part-no), oil (graded) → grade + pack, other product (coolant) → HSN + name overlap. HSN must match **exactly** (user's choice).

## Changes
- **Migration** `packages/db/migrations/0046_product_hsn.sql` — adds `products.hsn_code`, backfills (2710 default, 3820 for coolant/fricofin/antifreeze), sets NOT NULL.
- **API**
  - `services/products.ts` — `ProductInput.hsnCode` (required, 4–8 digits), stored on create/update, returned in `PRODUCT_SELECT`/`mapProductRow`.
  - `routes/products.ts` — POST + PATCH read `hsnCode` (required).
  - `services/orders.ts` — the invoiceable-items query surfaces each SKU's `hsnCode` (product's own, else 8482 bearing / 8421 filter).
- **Web**
  - `features/products/product-create-dialog.tsx` — required **HSN Code** field (numeric, hint: 2710 oil / 3820 coolant).
  - `features/products/products-api.ts` — `ManagedProduct.hsnCode`.
  - `features/invoices/invoice-sku-match.ts` — `InvoiceableItem.hsnCode`; `lineMatchesSku` rewired to the HSN gate; `BEARING_HSN` exported.
  - `features/invoices/invoice-parser.ts` — line `kind` now anchored on **8482** (bearing), so non-oil products aren't mislabelled bearings.
  - Tests: 4 new HSN cases in `invoice-sku-match.test.ts`.

## Rollout order (IMPORTANT)
1. **Apply migration `0046` to the DB** — via Neon Console or `DATABASE_URL=… node packages/db/dist/setup.js`. **Do this FIRST** — the API now selects `p.hsn_code`, so deploying before the column exists would 500 the Products + invoiceable endpoints.
2. **Deploy the API.**
3. **Deploy the web app.**
4. **Verify:** re-upload the MG Car Service invoice against **ORD-0058** → the coolant line matches its SKU → **Save invoice** enabled. Also confirm New Product now requires an HSN.

## Notes
- Existing orders (like ORD-0058) work immediately after the backfill — the invoiceable query reads HSN from the **product** (join), so orders don't need re-creating.
- `order_items.hsn_code` (a snapshot column) is left as-is; matching uses the product's HSN, not the snapshot.
