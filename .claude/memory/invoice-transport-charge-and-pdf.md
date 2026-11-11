---
name: invoice-transport-charge-and-pdf
description: Generated-invoice transportation charge + the invoice PDF design updates (2026-11)
metadata:
  node_type: memory
  type: project
  originSessionId: 44dd24ad-4f17-4dea-9900-c94e577c570c
  modified: 2026-11-05T03:29:34.947Z
---

Added **transportation charges** to generated invoices + redesigned the invoice PDF. Committed `351efa7` (2026-11-05). **Migration `0011` APPLIED to prod.** **DEPLOYED to prod 2026-11-05** — carried live by the Stock-work api+web deploy (API `sri-aparajita-api`, web `sriaparajita.vardhansystems.in`); the deploy bundles the whole committed tree, so the `shared` PDF renderer + generate form are live.

**Transport charge** (goods sent via Porter/Rapido, billed to the customer):
- Added **directly to the grand total, NO GST** on it (owner-confirmed). `grand = taxable + GST + transport`.
- New column `invoices.transport_charge` (migration `0011_invoice_transport_charge.sql`, `numeric(14,2) default 0`). Distinct from the existing `transport` text column (= transporter name in the party box).
- `compute()` in `apps/api/src/services/invoicing.ts` takes `transportCharge`; stored in `transport_charge` AND folded into `invoice_net_value`/`outstanding_amount` (so dues/credit include it). Flows through generate + edit (`PATCH /:id/generated`) + `getInvoicePdfData` + edit-data. Routes read `body.transportCharge`.
- Web: a **"Transportation charges" ₹ input above the Grand total** in `invoice-generate-summary.tsx` (`summaryFigures(lines, supply, transportCharge)`); `invoice-generate.tsx` holds the state + prefills on edit.

**Invoice PDF redesign** (all in `packages/shared/src/invoice-pdf.ts` — the single on-demand renderer used by api+web; remember to rebuild `shared` dist after editing):
- Side margins `M` 42→28 pt (~15mm→~10mm).
- Line items: **no horizontal row dividers** (per-body-cell `lineWidth {top:0,bottom:0,left:0.5,right:0.5}`); column verticals + header rule + outer frame kept.
- **Totals moved into the line-items table foot**: `Total` (Σ line amounts) → `Transportation Charges` → `Grand Total` (3 rows only when transport>0; else single `Grand Total`). The **separate right-side Grand Total was removed** (CGST/SGST tax grid kept).
- Description strips a trailing pack `(N L)`/`(NL)` (the renderer already appends `{pack}L`, so names that carry the pack don't double it).
- Payment QR bigger (`qs` 56→72, footer `rowH` min 96→108); the **UPI id line under the QR was removed**; bank band label `UPI:`→`UPI id:`; `for <company>` raised to leave a signing gap above `Authorised Signatory`.

**Note:** local dev uses the live prod DB ([[local-dev-uses-live-prod]]), so the migration being applied means the generate flow works locally. No invoice was generated end-to-end through the running app in-session; verified via unit tests (API + web) and standalone sample PDFs rendered through `buildInvoiceDoc`.
