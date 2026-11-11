---
name: stock-quantity-products
description: "Piece-sold (unit=quantity) products are now stockable in the Stock Journal via a pack=1 sentinel shown as \"pcs\"; listSkus unions them + returns unit; entry flow done, READ surfaces still show \"1 L\". Verified E2E, UNCOMMITTED 2026-11-05"
metadata:
  node_type: memory
  type: project
  originSessionId: dca6a78c-d107-4ed8-971e-085a2787a64d
  modified: 2026-11-05T15:54:10.656Z
---

**Quantity (piece-sold) products in the Stock Journal.** ~7 catalogue products have `unit='quantity'` with **0 packs** (accessories: cloths, spray guns, ceramic coating). The whole stock pipeline keys on `(productId, pack_size_litres)` which is **NOT NULL** everywhere, so these were previously **unstockable** (excluded by `listSkus`, absent from picker/grids/templates).

**Fix (locked decision):** represent a piece product with a **sentinel `pack_size_litres = 1`**, displayed as **"pcs"** (not "1 L"). `listSkus` now **UNION ALLs** quantity products (synthetic pack=1) and returns the `unit` field; the web `Sku` type gained `unit`; a `packLabel(pack, unit)` helper (`features/stock/stock-api.ts`) returns `"5 L"` or `"pcs"`. `unit` is threaded through `Line`/`TransferLine`/`AdjustLine`/`ImportedStockLine`, so the **SKU picker, stock-in/opening/transfer/adjust grids, and the Excel templates** all show "pcs". Template "Pack (L)" column renamed to "Pack" (unit-agnostic). API `listSkus` 100% line coverage.

**Scope = the ENTRY flow only** (picker + grids + templates). ⚠️ **Read surfaces still show "1 L"** for piece products — the stock home On-hand table, "Total litres" tile (it COUNTS pieces as litres, e.g. 25 pcs → +25 L), Stock lookup, Recent activity, per-godown breakdown, invoice/doc detail — because those queries don't return `unit`. Extending "pcs" there = add `unit` to ~5 read queries + display (deferred follow-on).

**Verified end-to-end live** on "Kelvinn Microfibre Cloth" (then fully wiped): Opening 25 → Stock-in +10 (merged into the same lot by batch) → Transfer 10 to another godown (batch carried, `transfer_out`/`transfer_in`), all at pack=1. The pack=1 sentinel satisfies the NOT NULL constraints and flows through lots/balances/movements unchanged. **UNCOMMITTED, not deployed** (2026-11-05). Part of the same work as [[excel-bulk-import]]; remember [[local-dev-uses-live-prod]].
