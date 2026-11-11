---
name: stock-phase2-batch-lots
description: "Stock Phase 2 = batch/lot inventory (stock_lots, migration 0015) — transfer/adjust manual FEFO pick, invoicing auto-FEFO; +invoice deductions in Recent activity; API 100% lines; DEPLOYED 2026-11-05; demo data left in prod"
metadata:
  node_type: memory
  type: project
  originSessionId: dca6a78c-d107-4ed8-971e-085a2787a64d
  modified: 2026-11-08T11:41:05.898Z
---

**Stock Phase 2 — batch-level (lot) inventory.** Adds a third layer under the Stock Journal: ledger `stock_movements` (append-only, truth) → `stock_balances` cache (location+product+pack) → **`stock_lots`** batch cache (migration **`0015_stock_lots.sql`**, APPLIED to prod 2026-11-05). A lot is location-scoped with cached `qty_units` (`>= 0` CHECK) + a NULL-safe identity unique index on (location, product, pack, coalesce brand/batch/expiry). `batch_id` added to `stock_movements`; `from_batch_id`/`to_batch_id` on `stock_transfer_items`; `batch_id` on `stock_adjustment_items`. **Invariant: `sum(stock_lots.qty) == stock_balances` per (location, product, pack).** `lotBalanceStmt(sql, lotId, delta)` in stock-shared.ts writes the signed delta.

**Picking model (locked decision):** Transfer (2b) + Adjust (2c) = **manual batch pick, FEFO default, one lot per line** (transfer carries batch/expiry/shelf to a find-or-created destination lot). Invoicing/sales (2d) = **automatic FEFO auto-split across lots, no picker** (`allocateSaleFefo`/`fefoSplit`, null expiry sorts last, one sale movement per lot). Invoice **edit** recomputes a merged availability (current on-hand + reversal credits) in JS because Neon batch txns can't read post-reversal state; **cancel** reverses via `currentSaleLots`.

**New feature (Recent activity):** invoice stock deductions now appear in the Stock page's Recent activity — `listInvoiceStockActivity` + `getInvoiceStockLots` services; routes `GET /stock/invoice-activity` + `/stock/invoice-lots`; web `stock-invoice-detail.tsx` drawer. Sale rows (rose) + reversal rows (emerald), generated invoices only, filtered by godown; click opens a per-batch deducted/credited breakdown.

**Gotcha:** Neon HTTP driver has **no bulk-insert helper** (`sql(rows, cols)` is postgres.js only) — lot bulk get-or-create (`ensureLots`) uses parameterized `unnest(${arr}::uuid[], ...)`.

**Status (2026-11-05):** phases 2a–2d + the activity feature all built; API **100% line coverage** (1276 tests). 17 SonarQube findings fixed (nested ternaries→if/else, `!lot || lot.x`→split guard, `String(unknown)`→`str()`/object-guard, `!(x>0)`→`<=0`). **DEPLOYED** API + web (latest: API `18419c41`, web `367666ad`). Code left UNCOMMITTED (user commits themselves). Remember [[local-dev-uses-live-prod]] — these demo writes hit production. Builds on [[stock-entry-pages-redesign]]; see [[neon-http-driver-transactions]], [[invoice-parser-sa-format]]. Deferred: batch-pick is only on transfer/adjust/sale so far; see docs/STOCK-PHASE2-BATCH-INVENTORY-PLAN.md.

**⚠️ PROD TRANSACTIONAL DATA WIPED 2026-11-08** (supersedes the "demo data left in prod" note): on the user's instruction, deleted ALL invoices (3→0, +items/allocations/se_notifications cascade), ALL sales_returns (4→0), the ENTIRE stock journal (stock_movements 15→0, stock_lots 1→0, stock_balances 1→0, goods_receipts 1→0 → **stock is now ZERO for every SKU**), and ONE order (ORD-0019, the session's test order — the other 18 orders KEPT). Detached `collection_allocations` (1→0). **KEPT:** collections (40 headers, now unallocated), customers (229), products/SKUs (252), godowns (2), customer_opening_balances (1). **invoice_series reset → next = SA/2026-27/00001.** Done atomically via `run_sql_transaction`; recoverable via the 7-day PITR + daily snapshots + `manual-2026-11-06-baseline` ([[neon-backups-and-privacy]]). The 18 kept orders now read as un-invoiced. See [[sales-return-restock]] for the returns work that preceded the wipe.
