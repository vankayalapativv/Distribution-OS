# Invoicing & Stock Management — Architecture

> **Status:** Design (approved decisions captured 2026-10-31). No code yet.
> **Audience:** Sri Aparajita engineering + CA.
> **Phasing:** Phase 1 = **Invoicing + Stock**. Phase 2 = **GST reports** (GSTR-1/3B). Phase 3 (optional) = live IRN/e-way generation.
> **Verify tax facts against CBIC/GSTN before go-live** — thresholds and rates change.

## 1. Decisions (locked)

| Area | Decision |
|---|---|
| Invoicing | **Generate** GST tax invoices in-app (today the system only uploads/parses PDFs). |
| Pricing | **Rate entered at invoice time** by the accountant — no price master yet (add later). |
| Order ↔ invoice | Invoice is raised **from an order** *and* can be **standalone** (counter sale, `order_id` null). **Partial / multiple** invoices per order allowed. Cancelling an invoice **adds the qty back** to the order's open balance and reverses stock. |
| e-invoice / e-way | **Capture only** (store IRN / e-way numbers) — **no** IRP/GSP generation yet. Design pluggable for Phase 3. |
| Stock | **Full stock ledger** (append-only) — **GRN (purchases) + opening stock** in; invoice/dispatch out; transfers; adjustments. Balances **derived** and cached. |
| Locations / GSTIN | **A few godowns in Telangana under ONE GSTIN.** Stock is per-location; one GST registration. |
| CA export | **GSTR-1-ready Excel** (B2B / B2CS / HSN sheets + CGST/SGST/IGST split). Optional, on demand. |

## 2. Principles

1. **Server-authoritative, ledger-based.** The API owns invoice numbering, tax computation, and every stock movement. The web app renders PDFs/Excel from server data but never invents numbers or balances.
2. **Append-only ledgers; derived balances.** Stock balances and "qty invoiced per order" are *computed* from immutable movement rows, with a maintained cache table for fast reads (the project's existing "recompute converges" pattern — see `neon-http-driver-transactions` memory).
3. **Workers + Neon fit.** Neon HTTP driver = **batch-only transactions** (no interactive `BEGIN`). Every multi-row write (invoice + items + stock-out, or GRN + items + stock-in) goes out as **one batched statement set**. Use `crypto.randomUUID()`; money math in SQL `numeric`, never JS float (per `AGENTS.md`).
4. **Single-client, one org.** No `organization_id` (removed in 0034/0035). One GSTIN stored in `system_settings` / company profile.
5. **Oils-only, pack-size SKUs.** A stock/invoice line is `product × pack_size_litres × brand`; HSN 2710, qty in units, litres derived.

## 3. Data model (new + extended tables)

New migration series `0004_*` onward. Sketches (not final DDL):

### 3.1 Locations
```
stock_locations (
  id uuid pk,
  name text not null,            -- "Main Godown", "Kukatpally Branch"
  code text unique,              -- short code, used in invoice series prefix (optional)
  address_line1/2, city, state, pincode,
  is_default boolean default false,  -- default fulfilling location
  status text default 'active',
  created_at, updated_at
)
```
All in Telangana under the single company GSTIN (company GSTIN lives in company profile, not per-location).

### 3.2 Stock ledger (source of truth) + balance cache
```
stock_movements (                 -- APPEND ONLY, never updated
  id uuid pk,
  location_id uuid -> stock_locations,
  product_id uuid -> products,
  pack_size_litres numeric(10,2) not null,  -- the SKU dimension
  brand text,                               -- snapshot (products.brand today)
  qty_units numeric(14,2) not null,         -- +in / -out
  litres numeric(14,2),                     -- derived (qty * pack), signed
  kind text not null,                       -- 'opening' | 'grn' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'sale_reversal'
  ref_type text, ref_id uuid,               -- links to grn / invoice / transfer / adjustment
  note text,
  moved_at timestamptz default now(),
  created_by uuid -> users
)

stock_balances (                  -- MAINTAINED CACHE (recompute-able from movements)
  location_id uuid, product_id uuid, pack_size_litres numeric(10,2),
  qty_units numeric(14,2) not null default 0,
  updated_at timestamptz,
  primary key (location_id, product_id, pack_size_litres)
)
```
- **Transfer = two movements**: `transfer_out` (−) at source, `transfer_in` (+) at destination, same `ref_id` (a `stock_transfers` row). Total qty across locations unchanged.
- **Every write updates `stock_balances` in the same batch** (`insert … on conflict … do update set qty_units = qty_units + ${delta}`). A nightly/admin **recompute** job can rebuild `stock_balances` from `stock_movements` to self-heal drift.

### 3.3 Purchases (GRN) — stock in
```
purchases (                        -- "goods received" header
  id uuid pk, grn_no text unique,
  location_id uuid -> stock_locations,       -- receiving godown
  supplier_name text, supplier_invoice_no text, supplier_invoice_date date,
  received_date date, total_value numeric(14,2),
  status text default 'posted',               -- posted | cancelled
  created_by uuid, created_at
)
purchase_items (
  id uuid pk, purchase_id uuid -> purchases on delete cascade,
  product_id uuid, pack_size_litres numeric(10,2), brand text,
  qty_units numeric(14,2) not null, rate numeric(14,4), amount numeric(14,2)
)
```
Posting a GRN → `stock_movements` `kind='grn'` (+qty) per item at the GRN's location.

### 3.4 Invoicing (extend existing `invoices`, add items + numbering)
Today `invoices` is upload-oriented (`invoice_pdf_url`, parsed `line_items` jsonb, `irn`, `eway_bill_no`, `place_of_supply`). We keep that table and **add structured generation**:

```
-- extend invoices:
  source text default 'uploaded'      -- 'generated' | 'uploaded'
  location_id uuid -> stock_locations -- the godown that fulfilled it
  buyer_gstin text, buyer_state_code text, supply_type text  -- 'intra' | 'inter'
  cgst/sgst/igst numeric, round_off numeric, status text     -- 'draft'|'final'|'cancelled'
  series_id uuid, cancelled_at, cancelled_by, cancel_reason

invoice_items (                        -- structured lines for GENERATED invoices
  id uuid pk, invoice_id uuid -> invoices on delete cascade,
  product_id uuid, pack_size_litres numeric(10,2), brand text, segment text,
  hsn_code text default '27101980',
  qty_units numeric(14,2) not null,
  rate numeric(14,4) not null,          -- ENTERED at invoice time
  taxable_amount numeric(14,2) not null,
  gst_rate numeric(5,2) default 18,
  cgst numeric(14,2), sgst numeric(14,2), igst numeric(14,2),
  line_total numeric(14,2),
  order_item_id uuid                    -- link back to the order line (nullable for standalone)
)

invoice_series (                        -- gap-free, per-financial-year numbering
  id uuid pk, name text, prefix text,   -- e.g. "SA/" or "SA/KKP/"
  fin_year text,                        -- "2026-27"
  next_seq int not null default 1,
  location_id uuid null                 -- optional per-location series
)
```
`invoices.order_id` already exists → links generated invoices to their order.

### 3.5 Stock adjustments & transfers (documents)
```
stock_adjustments (id, location_id, product_id, pack_size_litres, qty_units(+/-), reason, created_by, created_at)
stock_transfers   (id, from_location_id, to_location_id, transfer_date, note, status, created_by)
stock_transfer_items (transfer_id, product_id, pack_size_litres, qty_units)
```
Posting writes the matching `stock_movements` (+ balance updates) in one batch.

## 4. Core flows

### 4.1 Generate an invoice (the central flow)
1. Accountant opens **New invoice** → picks **customer**, **fulfilling location**, and (optionally) an **order** to pull lines from; or adds lines manually (standalone).
2. For each line: product + pack + **qty** + **rate (typed)**. Server computes `taxable = qty × rate`, then the **tax split** (§5).
3. Server, in **one batch**:
   - allocate the next **invoice number** from `invoice_series` for the current FY (atomic — advisory lock or `update … returning next_seq`),
   - insert `invoices` (`source='generated'`, `status='final'`) + `invoice_items`,
   - write `stock_movements` `kind='sale'` (−qty) at the location + update `stock_balances`,
   - (if from an order) the order's **invoiced qty** is now derivable; no separate write needed.
4. API returns the invoice payload. **Web renders the PDF** (client-side, like today's pdf.js parsing but in reverse) and **uploads it to R2** → `invoice_pdf_url`. PDF is a *rendering*; the record is authoritative.
5. IRN / e-way (if the user has them from the portal) are **entered** and stored — no generation.

**Stock guard:** block or warn on negative stock at the location (configurable: hard-block vs allow-negative-with-flag).

### 4.2 Cancel an invoice
Set `status='cancelled'` + write `stock_movements` `kind='sale_reversal'` (+qty back) in one batch. The order's open balance **re-opens** automatically (invoiced qty is derived). Invoice number is retained (GST requires no gaps — cancelled invoices stay in the series, marked cancelled).

### 4.3 GRN (stock in) / Transfer / Adjustment / Opening
Each posts its document + the matching signed `stock_movements` + balance updates in one batch. Opening stock = `kind='opening'` movements, entered once per location at go-live.

## 5. GST tax logic (single Telangana GSTIN)

- **Place of supply** = buyer's state (from `buyer_state_code`, defaulting to the customer's state).
- **Intra-state** (buyer in Telangana): **CGST + SGST** (9% + 9% for oils HSN 2710 @ 18% — *confirm rate*).
- **Inter-state** (buyer elsewhere): **IGST** (18%).
- `supply_type` derived = `intra` if buyer state == company state (Telangana), else `inter`.
- **Rounding:** per-line `numeric`, invoice `round_off` to nearest rupee on the grand total. All in SQL `numeric`.
- HSN default `27101980` (oils); editable per line.

## 6. CA Excel export (GSTR-1-ready)

On-demand (a "Export for CA" button, date range / month). Generated **client-side** from the invoices in the period (SheetJS), multiple sheets:
- **B2B** — invoices where buyer GSTIN present: buyer GSTIN, invoice no/date, place of supply, taxable, CGST, SGST, IGST, total.
- **B2CS** — B2C small (no GSTIN), summarised by state + rate.
- **HSN summary** — per HSN: qty, taxable, tax split.
- **Docs** — invoice number ranges issued/cancelled (GSTR-1 "Documents issued").
This maps 1:1 onto GSTR-1 tables so the CA can file directly; it is **not** a portal upload, just the register.

## 7. API surface (apps/api, `/api/v1`, office roles)

```
Invoicing
  POST   /invoices/generate            # the §4.1 flow (number + items + stock-out, one batch)
  POST   /invoices/:id/cancel          # §4.2
  GET    /invoices, /invoices/:id      # extend existing
  GET    /invoices/export?from&to      # data for the CA Excel (web builds the file)
  (existing POST /invoices stays for uploaded PDFs)

Stock
  GET    /stock/locations ; POST/PATCH
  GET    /stock/balances?location&q    # from stock_balances
  GET    /stock/ledger?product&location&from&to   # movement history
  POST   /stock/grn ; POST /stock/grn/:id/cancel
  POST   /stock/transfers
  POST   /stock/adjustments
  POST   /stock/opening                # bulk opening stock
  POST   /stock/recompute              # rebuild balances from movements (admin)
```
Services mirror the existing layout: `services/invoicing.ts`, `services/stock.ts`, `services/purchases.ts`, `services/invoice-pdf.ts` (data shape), `services/ca-export.ts` (data shape).

## 8. Platform & roles

- **Web only** (office): **SUPER_ADMIN + ACCOUNTANT** generate/cancel invoices + run the CA export; **SUPER_ADMIN + MANAGER + ACCOUNTANT** view stock; stock-in/transfer/adjust = **SUPER_ADMIN + MANAGER** (confirm). Never mobile for invoicing/stock.
- New nav: **Invoices** (exists) gains a "New invoice" action; a new **Stock** section (Balances / Movements / GRN / Transfers / Adjustments).

## 9. Phase 2 — GST reports (later)

Built on the same structured `invoice_items` + `purchase_items`:
- **GSTR-1** (outward) from invoices; **GSTR-3B** summary (outward tax + ITC from purchases); **HSN summary**; **Documents issued**.
- Reuse the Reports page pattern (cards → drill-in → chart + table → Excel/PDF), or a dedicated GST section. The CA Excel (§6) is the bridge until/unless portal filing is added.

## 10. Phase 3 — e-invoice / e-way (optional, pluggable)

Keep a thin `einvoice_provider` seam: today a no-op that just stores manually-entered `irn`/`eway_bill_no`; later an adapter to a GSP/IRP that, on invoice finalize, calls the IRP for an IRN + QR and the e-way API — **only if turnover crosses ₹5 Cr** (e-invoicing) or consignment > the Telangana e-way threshold. No schema change needed (fields already exist).

## 11. Decisions — RESOLVED (2026-10-31)

1. **GST rate** — **18% on everything** (HSN 2710). Rate still stored per line so a future exception is a data change, not code.
2. **Invoice series** — **one company-wide series per financial year**, gap-free, resets 1 April: `SA/2026-27/00001`.
3. **Short stock** — **hard-block**. Pre-check + a non-negative balance CHECK backstop; generation returns 409 `STOCK_SHORT`.
4. **Opening stock** — **CSV import + a screen** (both post to `POST /stock/opening`).
5. **B2C** — **a fair number of counter sales** without GSTIN → standalone (no-order) invoices supported; B2CS sheet matters in the CA export. A no-GSTIN buyer in Telangana is treated intra-state (CGST+SGST).
6. **PDF** — **design a clean GST-compliant layout** (rendered client-side, uploaded to R2), reviewed after.

Chosen UX (from the canvas prototype): **New Invoice = Layout A (single page)**, **Stock Journal = Layout A (tabs)**.

## 12. Build status

**Done (2026-10-31):**
- Migration [`packages/db/migrations/0004_stock_and_invoicing.sql`](../packages/db/migrations/0004_stock_and_invoicing.sql) — stock_locations, stock_movements (+nonneg balance CHECK), stock_balances, goods_receipts(+items), stock_transfers(+items), stock_adjustments(+items), invoice_series, invoice_items; `invoices` extended (location_id, series_id, supply_type, cgst/sgst/igst, round_off, doc_status, cancel fields). **Not yet applied** — run against the DB (see below).
- API (`apps/api`): `services/stock-shared.ts`, `services/stock-locations.ts`, `services/stock.ts`, `services/invoicing.ts`; routes `routes/stock.ts` (`/stock/*`) + `/invoices/generate` + `/invoices/:id/cancel`; registered in `index.ts`. Typechecks clean.

**To apply the migration** (hits the shared prod Neon DB — run it yourself). Check status first: it should list **only `0004_stock_and_invoicing.sql`** as pending (0001–0003 already recorded). If so, apply:
```bash
pnpm --filter @sri-aparajita/db run migrate -- --status
```
```bash
pnpm --filter @sri-aparajita/db run migrate
```
If `--status` instead shows 0001–0003 as pending too, the tracking table is fresh — tell me before applying (0001–0003 must be baselined as already-applied, never re-run, and `--baseline` would wrongly skip 0004 as well).

**Next:** web screens — Stock Journal (tabs) + New Invoice (single page) + GRN/Transfer/Adjustment/Opening + CA export; then the invoice PDF renderer and the GSTR-1 Excel.
