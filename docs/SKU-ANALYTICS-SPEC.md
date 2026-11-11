# SKU Analytics — agreed spec (discussed 2026-07-23, not yet built)

Money-per-SKU analytics from **uploaded invoice line items** (`invoices.line_items`
jsonb) — the only source with prices; SE app orders carry no money by design.

## Placement & access
- New **"SKU analytics — Billed (from invoices)"** section on the SA + Manager
  dashboard, beside the existing (order-based) Oils-by-segment / Bearings tables.
- **Two-truths handling: label, don't merge.** Existing cards remain order-based
  ("Ordered (app)"); this section is explicitly "Billed (from invoices)" with a
  one-line caption. Numbers are expected to differ.
- Reuses the dashboard's Today/Week/Month + custom date-range switcher.

## Tables
- **Oils table** (litres-led) and **separate small bearings table** (units-led),
  mirroring the current dashboard split.
- One row per **base product**, expandable to its pack sizes
  (grouping: strip the trailing pack token — "SILKOLENE SUPER 4 SAE 20W40 1L" →
  base "SILKOLENE SUPER 4 SAE 20W40", packs 1L/5L/… inside).
- Columns: **Litres (default sort)** · Units/packs · Invoices/customers count
  ("order frequency") · **₹ before GST** (qty × unit price from lines).
- Expand a row → **top 5 buyers** of that SKU (litres/units + ₹).

## Roll-ups & trends
- Revenue by **brand** and by **segment** (₹ before GST).
- **Month-by-month trend** (last 6 months) per SKU / overall — will be sparse
  until invoice uploads accumulate; expected.

## Caveats agreed
- Completeness tracks the accountant's upload discipline — skewed if only some
  invoices are uploaded.
- Ranked by volume (litres/units/frequency) per the user; revenue shown as a
  column, not the default sort.
