---
name: sales-return-restock
description: "Sales returns were LEDGER-ONLY (no stock came back) — fixed 2026-11-08 to restock the original sale's lots (migration 0020 + Phases 1-3); also fixes the Recent-activity \"edited invoice shows 2x units\" display bug. Built + 100% tested + live-verified, UNCOMMITTED/UNDEPLOYED. Over-return blocked by UI + API (units & outstanding caps)"
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-08T11:40:48.589Z
---

Two linked stock fixes built 2026-11-08, **UNCOMMITTED + UNDEPLOYED** (migration `0020` IS applied to prod). All in `apps/api/src/services/stock.ts` + `sales-returns.ts` (+ web `features/stock/*`).

## A. Recent-activity display bug (the trigger)
`listInvoiceStockActivity` + `getInvoiceStockLots` summed `abs(qty_units)` over an invoice's sale ledger, so an **edited** invoice (sale −2, sale_reversal +2, re-applied sale −2) showed **4 units instead of 2** (it climbed 2→4→6 per edit). **Real stock was always correct** — display-only. Fix: net the ledger (`-sum` over sale+sale_reversal), one row per invoice. Verified live (SA/2026-27/00001 read 2, not 4).

## B. Sales returns now RESTOCK (were ledger-only — a real bug)
`createSalesReturn` only wrote `sales_returns` + reduced invoice outstanding — **no stock movement, no on-hand change** (confirmed: only `'returned'` order-STATUS strings existed, never a stock movement). So returns credited the customer but left inventory short. User confirmed it's a bug; wants stock back in the **original sale's lot(s)**, and a **Return row in Recent activity**.

- **Phase 0 — migration `0020_stock_return_movement_kind.sql` (APPLIED to prod):** adds `'return'` to `stock_movements_kind_check` (was opening/grn/sale/sale_reversal/transfer_in/transfer_out/adjustment). Also added `'return'` to the `MovementKind` TS union in `stock-shared.ts`.
- **Phase 1 — restock on create:** new `allocateReturnRestock(sql, invoiceId, lines)` — reverse-FEFO (earliest-expiry still-out lot first), capped at still-out qty, same batch/expiry/**rate**, into the invoice's selling godown. `createSalesReturn` posts a `return` movement (+qty, `ref_type='invoice'`, `ref_id=invoiceId`, `batch_id`) + lot/balance increments IN THE SAME transaction. **GENERATED invoices only** (uploaded invoices never moved our stock → skip). `currentSaleLots` now nets `'return'` too, so "still out" is accurate and edit/cancel don't re-credit returned units.
- **Phase 2 — Return row:** `listInvoiceStockActivity` groups per (invoice, rowKind): a SALE row (net of sale/sale_reversal) + a RETURN row (sum of `return` moves), each with its own `max(moved_at)`. `getInvoiceStockLots` gains a `return` drawer. Web: `stock-journal.tsx` (teal **Return** badge, "N units returned"), `stock-invoice-detail.tsx` ("Stock returned", +qty), `stock-api.ts` types, `routes/stock.ts` accepts `kind=return`.
- **Phase 3 — edit/delete adjusts stock by DELTA:** `updateSalesReturn` computes new−old per SKU; `allocateReturnAdjustment` posts +delta (restock to still-out lots) or −delta (pull back from the invoice's returned lots, latest-expiry first); `STOCK_SHORT` 409 if returned stock was already re-sold. Delta approach needs no per-return movement tracking.

**Tests:** 1299 API tests pass, **100% lines**. **Live-verified** on prod-via-local: partial(1)+full(2) return restored on-hand exactly to the batch; Return row + drawer show batch 01; edit up (1→3, +2) and down (3→1, −2) tracked on-hand. See [[billing-v2-webhook-architecture]]-style local=prod caveat ([[local-dev-uses-live-prod]]).

## Over-return guards (defense-in-depth, verified live)
Return > returnable is blocked on BOTH layers: **UI** disables submit + inline error (value/outstanding cap) on create AND edit; **API** `buildReturnLines` throws **422** — a per-line **units cap** `"only N left to return, X requested"` (checked FIRST) and an **outstanding/value cap**. Proven by a direct API POST (bypassing the disabled button) → 422, nothing written.

## ⚠️ Gaps / follow-ups
- **Deployed prod API still has the OLD returns code** (no restock) → returns made through production are stock-short until this is deployed. **Backfill needed = none now** (0 shortfall; all existing returns were made via the new local code).
- **Direct invoices (no order) are NOT returnable** — returns key off `invoice_line_allocations`, which only exist for order-linked invoices ("Nothing available to return"). Possible separate gap.

**Key files:** `apps/api/src/services/stock.ts`, `sales-returns.ts`, `stock-shared.ts`, `routes/stock.ts`; `apps/web/src/features/stock/{stock-journal,stock-invoice-detail,stock-api}.tsx`; migration `0020`. Related: [[stock-phase2-batch-lots]], [[stock-per-batch-rate-costing]], [[local-dev-uses-live-prod]].
