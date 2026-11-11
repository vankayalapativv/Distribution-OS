# Pending: Fulfillment — link Order → Invoice → Delivery (1:1:1) + statistics

**Status:** Specced & decisions locked 2026-07-25, deferred (build later). Discussion-only
so far — NO code written. Do NOT re-ask the decisions below; build from this doc.

## Goal

Tie the three fulfillment stages together so an order can be tracked end-to-end and
reported on:

**Order (ORD-####) → Invoice → Delivery**

Today these are three silos joined only by *customer*. This gives them a real chain plus a
per-order status trail and a fulfillment funnel/aging dashboard.

## Current state (verified 2026-07-25)

- `orders` has a dead `invoice_id` column that **nothing ever sets**.
- `invoices` has **no order link** — invoices are uploaded as PDFs (BAL format), parsed
  client-side, matched to a **customer by phone** (`party_phone`). Standalone.
- `delivery_runs` / `delivery_stops` (logistics) reference **customer only** — no order or
  invoice.
- Invoice parser (`apps/web/src/features/invoices/invoice-parser.ts`) yields clean totals
  (`totalLitres`, `bearingQty`) + per-line `{ description(free text), hsn, quantity, litres, kind: oil|bearing }`.
  It recognizes **oil vs bearing by HSN only — it does NOT understand filters**.

## Locked decisions

| Decision | Answer |
|----------|--------|
| Cardinality | **Strictly 1 order : 1 invoice : 1 delivery** (1:1:1) |
| Every invoice must attach to an order? | **Yes** — standalone/global upload is retired |
| Upload trigger | **"Upload invoice" button on every un-invoiced order row** |
| Upload dialog | **Order-scoped**: pre-fill order code header, **lock customer from the order**, show the order's target totals |
| Upload guard basis | **Totals**: order total oil litres + order total bearing qty vs invoice `totalLitres`/`bearingQty` |
| Guard exactness | **Exact match** (compare litres rounded to 2 dp to avoid float equality bugs) |
| On mismatch | **Hard block** — refuse the upload, show a plain mismatch message |
| Filters in the match | **Ignored** (client isn't selling filters; parser can't see them anyway) |
| Customer matching | **Drop phone matching** — customer always comes from the order |
| Downstream behaviour | **Identical to today's invoice upload** (see below) — order-row upload is the SAME pipeline, extended |
| SE to notify | **The order's SE** (`orders.sales_executive_id`); **fall back to the customer's SE if the order has no SE** (web-created orders can have a null SE) |
| Delivery link | **Logistics driver picks ONE invoice** for the stop, then photos |
| Multiple invoices per delivery | **No** — one delivery : one invoice |
| Payment/"Paid" stage | **No** — funnel stops at Delivered |
| Outputs | **Both** a per-order status trail AND a fulfillment funnel/aging dashboard |
| Existing (already-uploaded) invoices | **Recommended: leave as legacy/unlinked** (no `order_id`; excluded from the funnel). Manual backfill only if the client asks. |

## Data model

- **`invoices.order_id uuid` — UNIQUE, FK → orders(id).** The UNIQUE constraint enforces
  *both* "one invoice per order" and "one order per invoice" in one stroke. Nullable only
  for the legacy pre-existing rows.
- **Delivery ↔ invoice link — `invoice_id uuid` UNIQUE on the delivery record**
  (`delivery_stops` or a per-delivery row — confirm the exact table when building).
- The dead `orders.invoice_id` can be retired or kept in sync; the canonical link is
  `invoices.order_id`.
- Migration adds the two columns + unique indexes.

## Workflow 1 — Invoice upload from an order row (SUPER_ADMIN / ACCOUNTANT)

1. Every order row **without an invoice yet** shows an **"Upload invoice"** button
   (rows that already have one show a link to it instead).
2. Clicking opens the **order-scoped** upload dialog:
   - Header: "Attaching invoice to **ORD-0123**".
   - **Customer locked** (from the order — not editable, no phone search).
   - Shows the **target totals** the invoice must match: the order's total oil litres and
     total bearing qty.
3. PDF is parsed with the existing parser (invoice no, date, amounts, oils litres, bearing qty).
4. **Guard (hard):** require
   `round(orderOilLitres,2) === round(invoice.totalLitres,2)` **AND**
   `orderBearingQty === invoice.bearingQty`.
   - Mismatch → **block** with a message, e.g. *"Ordered 98 L oils / 5 bearings, but this
     invoice is 90 L / 5 — it doesn't match this order."* Nothing is saved.
   - Filters on the order are **excluded** from the comparison.
5. On pass, run the **SAME pipeline as today's upload** (`apps/api/.../invoices.ts`
   createInvoice + `POST /invoices` multipart) — i.e. it must ALSO:
   - set `outstanding_amount = grand total` (dues/ageing clock starts on invoice date),
   - store the PDF in R2 + `GET /invoice-files/:id` streaming,
   - appear in the Invoices list, feed collections/dues,
   - notify the SE (`se_notifications` + Expo push) — **the order's SE**, falling back to
     the customer's SE if null,
   - PLUS set `invoices.order_id = <order>` and take `customer_id` from the order.
6. The old **global standalone upload is removed** (see "Invoices page" below).

## Workflow 2 — Delivery links the invoice (LOGISTICS, mobile)

1. At a delivery stop, the driver selects **one invoice number** from that customer's
   **invoiced-but-not-yet-delivered** list (this doubles as logistics' "to-deliver" worklist),
   then takes the delivery photos as today.
2. Saving sets `delivery.invoice_id` (unique → one delivery per invoice).
3. This is a change to the mobile logistics delivery flow → **needs a new APK**.

## Outputs (build both)

- **Per-order status trail** — on the order detail page: *Created (date) → Invoiced INV-###
  (date, amount, PDF) → Delivered (driver, date, photos)*. Plus a **fulfillment badge on the
  Orders list** (Ordered / Invoiced / Delivered).
- **Fulfillment dashboard** (SA/Manager) — funnel counts (Ordered → Invoiced → Delivered),
  conversion %, **aging alerts** (approved but un-invoiced for N days; invoiced but
  un-delivered for N days), and cycle-times (order→invoice, invoice→delivery days),
  sliceable by SE / customer / period.
- **No Paid stage** (collections↔invoice already exist separately).

## What happens to the Invoices page (`/dashboard/invoices`)

Since invoices can now only be created from an order row, the Invoices page becomes a
**read-only registry** (recommended):

- **Remove the standalone "Upload invoice" button** + its global upload dialog.
- Keep the list, search, outstanding, and row-click → PDF.
- **Add a linked "Order" column** (ORD-#### → links back to the order) so the registry
  shows the order each invoice fulfills.
- Keep it SUPER_ADMIN + ACCOUNTANT.

(Do NOT delete the page — a global invoice registry with search/outstanding is still useful.)

## Edge cases / build notes

- **Float precision:** compare oil litres rounded to 2 dp; never raw `===` on floats.
- **Null order SE:** fall back to the customer's SE for the notification.
- **Filters:** excluded from the match; if an order has filters, they simply don't affect
  pass/fail (parser can't see them).
- **Legacy invoices:** pre-existing rows keep `order_id = null` and are excluded from the
  funnel; no forced backfill.
- **Roles:** invoice-upload/link = SA + ACCOUNTANT; delivery-link = LOGISTICS.

## Rough build order (when greenlit)

1. Migration: `invoices.order_id` (unique FK) + delivery `invoice_id` (unique).
2. API: order-scoped invoice create (reuse createInvoice + guard + order_id + order-SE
   notify); remove/redirect the global upload; add `order_id` to invoice list rows.
3. Web: per-row "Upload invoice" button + order-scoped dialog with the guard; Invoices page
   → read-only registry + Order column; per-order trail + Orders-list badge.
4. Mobile (logistics): "select invoice" step in the delivery flow → new APK.
5. Fulfillment dashboard (funnel + aging + cycle times).
