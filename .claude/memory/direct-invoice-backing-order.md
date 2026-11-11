---
name: direct-invoice-backing-order
description: "Every in-system GENERATED invoice now always has an order behind it. A direct (ad-hoc, order-less) invoice auto-creates a backing order (orders.origin='invoice') in the same txn, so order_id + invoice_line_allocations always exist → directly-generated invoices are now returnable / order-reportable. Committed 2663cce, DEPLOYED prod 2026-11-10."
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-10T10:12:45.797Z
---

**Direct invoices are now backed by an auto-created order.** Committed `2663cce`, **DEPLOYED to prod 2026-11-10** (API version `0a52ebbc`, web `c880fbe1`). Migration `0023` applied to prod first (DB-before-deploy).

**The problem it fixed:** a directly-generated (ad-hoc) invoice — the `/invoices/new` "New invoice" path, `invoice_source='generated'`, `order_id` NULL — wrote NO `invoice_line_allocations`, so it was invisible to sales returns, order-based reports and SE order attribution. Sales returns key entirely off `invoice_line_allocations → order_items`, so a direct invoice simply wasn't returnable.

**The fix (all in `apps/api/src/services/invoicing.ts`):** when `generateInvoice` has no `orderId`, `allocateAndInsertInvoice` pre-generates an order UUID + one `order_item` UUID per line (explicit ids — the Neon batch driver can't read a generated id mid-transaction) and, in the SAME `sql.transaction`, inserts a backing order + order_items BEFORE the invoice, then points every invoice line's `order_item_id` and writes an allocation for every line. The backing order mirrors the invoice: `order_date`=invoice date, `sales_executive_id`=resolved SE, `order_status='approved'`, **`origin='invoice'`**.
- **edit** (`editGeneratedInvoice`): rebuilds the backing order's `order_items` to match the edited lines (fresh ids, re-pointed allocations); **blocked with 409 if a sales return exists** (`/* edit_invoice_return_guard */`) — `sales_return_items.order_item_id` FKs the order items, and editing a returned invoice is incoherent. Over-invoice guard skipped for backing orders.
- **cancel** (`cancelInvoice`): sets the backing order `order_status='cancelled'` + note, so it drops out of the pipeline with the invoice.
- **Order-linked (generate-from-order) invoices are UNCHANGED** — `isBacking` is false, no backing order, uses the real `orderItemId`. Verified live.

**Schema:** migration `0023_order_origin.sql` adds `orders.origin text NOT NULL DEFAULT 'standard'` + CHECK `in ('standard','invoice')`. **No `order_status` CHECK change** — 'cancelled' is already a live value and `order_status` has no CHECK (unlike the [[attendance-holiday-feature]] / billing 'paused' bugs). Web Orders list shows a "From invoice" badge for `origin='invoice'` (`orders-shared.ts` ORDER_LIST_COLUMNS + mapOrderRow; `orders-columns.tsx`).

**Shared helper:** extracted `nextOrderCode(sql)` into `orders-shared.ts` (ORD-#### = `max(substring(order_code from 5)::int)+1`); now used by BOTH `orders.ts` createOrder and the backing-order path. Generate retries on `orders_order_code_key` AND `invoices_invoice_number_key` (`isUniqueViolation`/`retryOnUniqueViolation` now take `string | string[]`).

**Verified E2E against LIVE prod** via the running app ([[local-dev-uses-live-prod]]): generate→backing order+allocations+badge, returnable (recorded a real sales return), edit-rebuild, cancel-cascade, edit-blocked-by-return, AND the order→invoice regression. All test data deleted + stock/series restored afterward. 1320 API tests pass. Code-review + security-review run (no security issues; 3 cleanups fixed, 1 low-prob concurrency note on the pre-existing invoice-series-gap race left as-is). Decisions (owner-locked): auto-create approach, generated-direct scope only (uploaded PDFs untouched), no backfill (invoices table was empty — wiped 2026-11-08), invoice date + invoice's SE, edit rebuilds, cancel cascades.

Commit `2663cce` is on `main`, **pushed to origin 2026-11-10**.
