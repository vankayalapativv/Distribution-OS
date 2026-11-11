---
name: dashboard-dues-invoice-ageing
description: WEB dashboard "Collection Dues" card uses TRUE invoice-level ageing (ported from Beyond 2026-10-16) — a customer can appear in several age bands; SE MOBILE dues keep the old oldest-bucket rule
metadata:
  type: reference
---

**The dues ageing model is split by surface (decided + ported 2026-10-16, from Beyond):**

- **WEB dashboard "Collection Dues" card + its drill-down → TRUE invoice-level ageing.** Each unpaid **invoice / opening balance** is aged by **its own date** and its FIFO-adjusted remaining (`outstanding_amount`) is summed into **that** age band. So a customer with a 70-day invoice AND a 5-day invoice contributes to **both** 61+ and 0–30 — not just their oldest bucket. Consequences:
  - A customer can appear in **several buckets**; each bucket's `customers` is the DISTINCT count with an item in that band, so **bucket counts overlap and sum to MORE than `totalCustomers`**.
  - `totalCustomers` = distinct count of all owers; `totalOutstanding` = Σ remaining = the gross debt (unchanged — only the distribution is truthful). These come from a **`grouping sets ((bucket), ())`** query (the total row is the `grouping(bucket)=1` row), in `getMasterDuesSummary` in `apps/api/src/services/dues.ts`.
  - Drill-down (`listMasterDuesCustomers`): **one row per customer in THIS band**, with `bandOutstanding` (their remaining aged into this band — rows sum to the bucket total), `totalOutstanding` (whole balance), `bandOldestDate`/`bandAgeDays` (oldest item within the band). It ALSO returns legacy aliases `oldestInvoiceDate`/`ageDays`/`outstanding` (= the band values) so OLD mobile admin builds don't render ₹NaN.
  - Web shows the note: *"Aged per invoice — a customer with invoices of different ages can appear in more than one band."* Card/drilldown: `dues-helpers.ts` (`DuesCustomerRow` has `band*`+`totalOutstanding`), `dues-card.tsx`, `dues-card-parts.tsx`, `dues-drilldown-table.tsx`, `use-dues-drilldown.ts`.

- **SE MOBILE dues + maps → UNCHANGED, keep the oldest-bucket rule** (a customer sits in exactly ONE bucket by the age of their oldest unpaid item). `GET /dues/me/summary`, `/dues/me/customers`, the dues cron (`runDuesMaintenance`) and `customer_dues_state` are byte-unchanged. Only the Super-Admin/Manager **web** master summary + master drill-down functions were changed.

Buckets are the same 4 everywhere: `0_30` / `30_45` / `45_60` / `60_plus` (≤30, ≤45, ≤60, else). Dues source = `invoices` (outstanding_amount > 0) ∪ `customer_opening_balances` (outstanding_amount > 0), aged from the IST date.

Ported as part of [[beyond-web-reconciliation]] (Beyond = source of truth; the dues `.ts`/`.tsx` files were identically named and differed only in this logic, no branding). Committed by the user 2026-10-16 (incl. SonarQube fixes: Readonly props, optional chain, stable skeleton keys, `NO_FILTERS` const default, `toHaveLength`).
