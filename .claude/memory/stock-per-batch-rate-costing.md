---
name: stock-per-batch-rate-costing
description: "Per-batch rate on stock_lots (migration 0017, rate IN lot identity) → FEFO COGS on invoices (0018, invoice_items.cogs_amount) → Profitability report (/reports/profit, by invoice/customer/sku/area); rate now MANDATORY on stock-in+opening; stock VALUATION page built then REMOVED; ₹ stripped from entry screens. Migrations 0016/0017/0018 APPLIED to prod; code UNCOMMITTED 2026-11-06"
metadata:
  node_type: memory
  type: project
  originSessionId: f1881b67-1d6b-4ccc-99cb-7dba425d1e08
  modified: 2026-11-05T21:06:09.049Z
---

**Per-batch rate → COGS → profit** (2026-11-06). Migrations **0016/0017/0018 APPLIED to prod by the user**; feature code is **UNCOMMITTED, not deployed**. API kept 100% line coverage throughout.

- **Rate MANDATORY (>0)** on BOTH stock-in (GRN) and opening lines — entry grid (red cell + a "N rows need a rate" gate that blocks Post), Excel import (distinct "Rate is required." / "must be >0" row errors), and API 422 guard (`isPositiveRate` in `services/stock.ts`). Opening lines gained `rate`+`amount` (migration **0016 `opening_stock_rate`**).
- **Per-batch rate on lots** (migration **0017 `stock_lot_rate`**): `stock_lots.rate numeric(12,4)`; the lot-identity UNIQUE index now includes `coalesce(rate,-1)` → **same batch+expiry at a DIFFERENT rate = a DISTINCT lot** (user choice "separate lot per rate"). Existing lots were **backfilled** from their originating GRN/opening row. `ensureLots`+`lotIdentityKey` carry rate; **transfers INHERIT the source lot's rate** (cost follows goods); positive "found-stock" adjustments stay **unpriced (null)**. FEFO (`fefoSplit`/`allocateSaleFefo`) + `currentSaleLots` now carry each drawn lot's rate. Batch read surfaces (near-expiry table+cards, stock lookup, transfer/adjust batch pickers `@rate`) show the rate.
- **COGS on invoices** (migration **0018 `invoice_item_cogs`**): `invoice_items.cogs_amount`; at generate AND edit, line COGS = Σ(qty × FEFO-drawn lot rate), **NULL when any drawn lot is unpriced** (so "cost unknown" ≠ zero). `lineCogs()` in `services/invoicing.ts`.
- **Profitability report** — `GET /reports/profit?from=&to=&groupBy=invoice|customer|sku|area`, web page **`/reports/profit`** (linked via a "Profitability" button on `/reports`), service `services/profit.ts`. **Profit = sold (ex-GST taxable) − expense share − COGS.** Expense/unit = ALL period expenditures ÷ ALL units sold where **1 piece = 1 litre** (user chose: period-expenses÷units, ex-GST sold price, **generated invoices only**). ⚠️ Per-litre allocation makes **bulk drums (e.g. 210 L) soak up a huge expense share → they read as big losses**; flagged to the user as a questionable basis — **revenue-share was my recommended alternative, deferred**.
- **Stock VALUATION page was BUILT then REMOVED ENTIRELY** at user request: `stockValuation` service, `GET /stock/valuation`, page `/stock/valuation`, and the "Valuation" nav button are all **deleted**. Migrations 0017/0018 were KEPT (FEFO/COGS/profit depend on the columns).
- **₹ symbol removed** from the Opening + Stock-in **entry** screens and their Excel-import dialogs (column headers, row values, summaries) — scoped to those screens only; ₹ still used elsewhere (the profit report uses `rupeesExact`).
- **Products bulk-import review dialog**: the Packs column now shows pack **SIZES** (`1L, 4L` — comma-separated, no space before L, **amber**) instead of a count; MRP/MOP/DLP are NOT shown (user pref). `features/products/products-import-dialog.tsx`.

**DB state after this session:** the whole **stock journal** (lots/movements/balances/goods_receipts/transfers/adjustments/opening) and **ALL invoices** were **WIPED to zero**; invoice series reset to **#1**; GRN/TRF/ADJ numbering auto-resets (it's derived from `max()` of the now-empty tables — no series table). **KEPT:** 252 products / 487 packs, 2 godowns (**Bachupally** default + **Hayatnagar**), 34 collections. (For testing, 5 generated invoices + 4 expenses were created to verify the profit report end-to-end, then fully reversed via the cancel path + a row purge.) Generating an invoice fires an Expo push to the customer's SE — can't be suppressed in the generate flow.

Related: [[excel-bulk-import]], [[stock-quantity-products]], [[stock-phase2-batch-lots]], [[oil-segment-canonical-six]], [[local-dev-uses-live-prod]].
