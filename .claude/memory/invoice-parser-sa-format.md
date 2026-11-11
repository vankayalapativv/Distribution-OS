---
name: invoice-parser-sa-format
description: The web invoice-upload parser was rewritten for Sri Aparajita's actual tax-invoice format (oils-only, HSN on the line ABOVE the row, GST-EXCLUSIVE line amounts, Original+Duplicate copy dedup)
metadata:
  type: reference
---

**The client-side invoice-upload parser (`apps/web/src/features/invoices/invoice-parse-*.ts`) was rewritten 2026-10-15** from the old Beyond "BAL" Busy export to **Sri Aparajita's actual format** (text-layer PDFs only, no OCR; oils-only). Validated against 4 real SAE invoices (3677/3679/3684/3685).

**SA "SRI APARAJITA ENTERPRISES" tax-invoice format quirks (vs the old Beyond BAL one):**
- **Invoice no keeps the financial-year suffix**: `SAE/3677/2026-27` — the old regex `[A-Z]{2,5}\/[\w-]+\/\d+` truncated the `-27`; now `[A-Z]{2,6}\/[\w-]+\/[\w-]+`.
- **HSN/SAC prints on its OWN line ABOVE each item row** (not inline). Parser carries a `pendingHsn` forward: a line matching `^\s*(\d{6,8})\s*$` sets it, the next item row consumes it.
- **Item row** = `N. <desc> <Qty> <Unit> <PCKG> <Price> <Amount>` (Unit = `Pcs.`/`Nos`). No MRP/Disc%/CGST%/SGST% columns. Qty/PCKG/Price/Amount each carry exactly 2 decimals (keeps a pack size like `205L`/`2.5L` in the desc from being read as a column). **Every line is an oil** (`kind: "oil"`; the catalogue has no bearings/filters here).
- **Line Amount is GST-EXCLUSIVE**: the amounts sum to the **taxable value**, NOT the grand total. So reconciliation checks `Σ line amounts ≈ taxableValue` (not vs grand total — the old Beyond check would always fail). Grand total parsed from `Grand Total … <last 2-dec number>`; tax summary row `18% <taxable> <cgst> <sgst> <totaltax>`.
- **Each PDF is Original Copy + an identical Duplicate Copy** → parse only up to the `Duplicate Copy` marker or items double-count.
- Litres per line = `packSizeLitres(description) × qty` (handles `1Lt`, `1 L`, `205L`, `250ml`, `900ML SL`).

**"Bearing qty" UI removed** from the invoice review form + the "· N brg" list badge (SA is oils-only). The data-model field `ParsedInvoice.bearingQty` / `InvoiceDetail.bearingQty` is KEPT (still posted as 0 to the unchanged API/DB) — only the UI went.

The invoice **upload/create** path, customer phone-match, and PDF streaming are unchanged; only the parsing of the fixed BAL format → SA format was swapped. See [[local-dev-uses-live-prod]].
