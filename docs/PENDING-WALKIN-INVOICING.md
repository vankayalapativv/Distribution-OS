# PENDING — Walk-in Customers for Manual Invoicing

> **Status: DEFERRED (2026-08-06).** User asked to build this later. Nothing was
> implemented. Resume from the open questions below.

## Requirement (verbatim intent)

Inside **Manual** invoicing (the "Create Invoice → Manual" flow), invoices are for
**walk-in customers**, NOT the regular `customers` table. Add a new table
**`walk_in_customers`**. The client manually types:

- **Name** — mandatory
- **Address** — mandatory
- **Phone** — mandatory
- **GST** — optional

Then inputs the **SKUs, quantities, MOP price, discount**, and generates the invoice
with those details. The walk-in data is **stored in the DB** and the invoices must
**show up in the invoices table**.

## Schema facts found (2026-08-06)

- `invoices.customer_id` is **NOT NULL** → must be made **nullable** for walk-in.
- Invoices list query (`apps/api/src/services/invoices.ts` ~line 468–487) does an
  **INNER JOIN customers** for `customerName` → walk-in rows (null customer_id) would be
  **dropped**. Change to LEFT JOIN customers + LEFT JOIN walk_in_customers, then
  `coalesce(c.legal_name, w.name)` for the displayed name.
- The manual invoice pipeline already exists and is the base to extend:
  - Web: `manual-invoice-dialog.tsx`, `manual-customer-field.tsx` (existing-customer
    picker — to be replaced by a walk-in form), `manual-line-add.tsx`.
  - API: `manual-data.ts` (`loadManualData`), `manual-generate.ts`
    (`computeManualInvoice` / `commitManualInvoice`), route `invoicing-manual.ts`
    (`POST /invoicing/manual/preview|generate`).
  - Per-line **MOP + Discount editing already work** (preview shows MRP read-only, MOP +
    Disc% editable) — reuse as-is for walk-in.

## Likely implementation shape (once questions answered)

- Migration: `create table walk_in_customers (id, name, address, phone, gstin nullable,
  created_by, created_at)`; `alter table invoices alter column customer_id drop not null`;
  `alter table invoices add column walk_in_customer_id uuid references walk_in_customers(id)`.
- `loadManualData` variant that takes typed walk-in details instead of a customerId, and
  a commit that inserts the walk_in_customers row (or reuses) + the invoice with
  `walk_in_customer_id`, `customer_id = null`, `sales_executive_id = null`.
- Invoices list LEFT-join + coalesce name (+ a "Walk-in" tag).
- Manual dialog: swap the customer picker for a Name/Address/Phone/GST form.

## OPEN QUESTIONS (must confirm before building — do not assume)

1. **Manual scope** — Does Manual become **walk-in only** (typed details; never the
   regular customers table)? Rename the tile to "Walk-in customer"? Or keep BOTH
   (pick existing customer OR walk-in)? ("From an order" stays as-is.)
2. **SKU source** — Pick from the **product catalogue** (MOP pre-fills from price master,
   HSN/GST auto — matches current builder) OR **free-typed** SKUs where the client sets
   MOP + GST% + description per line (no catalogue, no MRP)?
3. **Tax / place of supply** — Always **intra-state (Telangana → CGST+SGST)**, or
   **capture the walk-in's state** so out-of-state bills IGST?
4. **Storage & view** — **New `walk_in_customers` row per invoice** (snapshot) or
   **reuse by phone** (dedupe)? And: show only in the invoices table (name + "Walk-in"
   tag), or also add a separate **Walk-in Customers** list page?
