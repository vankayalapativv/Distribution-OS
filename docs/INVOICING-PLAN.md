# Invoicing — Build Plan (Phase 1: Oils)

Replace BusyWin invoicing with in-app invoice generation. Later phases: bearings/filters
pricing, Stock Journal, GST reports/audit. This doc is the agreed spec for Phase 1.

## Decisions (from the client, 2026-08-05)

| Topic | Decision |
|-------|----------|
| Pricing source | **Central price master** (Price + MRP per product & pack), seeded from the MOP file |
| Line math | **MOP is GST-inclusive** → pre-GST `Price = MOP ÷ (1+GST%)`; `Amount = MOP × Qty × (1 − discount%)`, rounded per line to whole rupee (**verified against real invoice data**) |
| Discount | **Per (customer, product)**, with a customer-level default + per-product overrides |
| Schemes / Coupon / Net Realization | Internal margin figures — **NOT shown on the invoice** |
| E-invoice (IRN/QR) + e-way bill | **Manual capture** (paste numbers; no govt/IRP API) |
| Invoice creation | **From an existing order** (Accountant + Super Admin) |
| Invoice date | **Defaults to today** (not edited) |
| Numbering | App **auto-assigns**, FY reset; **first number issued = `BAL/26-27/2000`** |
| Rounding | **Per-line whole rupee** (match BusyWin) |
| Copies | **Original / Duplicate / Triplicate** |
| Inter-state | **Configurable**: CGST+SGST when customer state = seller state, else IGST |
| Config | Everything lives in a new **Configure → Invoicing** area — nothing hardcoded |
| Scope now | **Oils only**; bearings + filters later |

## Pricing model (verified)

MOP file columns: `Category, Product, Pack Size (L), MRP, Market Operating Price, Scheme/Litre, Coupon, Scheme Total, Net Realization`.

- `Scheme Total = Scheme/Litre × pack size`; `Net Realization = MOP − Scheme Total` (internal only).
- **MOP is GST-inclusive.** Proof: DB line `10W30 SL 0.8L` price 293.22, MRP 500 ↔ MOP file MOP 346, MRP 500 → 346 ÷ 1.18 = 293.22 (exact); `20W40 SL 0.9L` MOP 359 ÷ 1.18 = 304.24 (exact).
- Per line: `preGstRate = MOP / (1 + gst)`, shown as **Price**; `taxable = preGstRate × qty × (1 − discount%)`; `gst = taxable × gst%` (split CGST/SGST or IGST); `Amount = round(taxable + gst)` to whole rupee. MRP shown for reference.

## Data model (proposed migrations — NOT yet applied)

```sql
-- 1. Price master (one MOP+MRP per product+pack; re-importable from the MOP file)
create table product_pack_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  pack_size_litres numeric not null,
  mrp numeric not null,
  mop numeric not null,                 -- GST-inclusive
  scheme_per_litre numeric,             -- informational
  coupon numeric,                       -- informational
  invoice_description text,             -- optional override for the printed line (else product_name + pack)
  effective_date date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (product_id, pack_size_litres)
);

-- 2. Per-customer discount: default + per-product overrides
alter table customers add column default_discount_pct numeric not null default 0;
create table customer_product_discounts (
  customer_id uuid not null references customers(id) on delete cascade,
  product_id  uuid not null references products(id)  on delete cascade,
  discount_pct numeric not null,
  primary key (customer_id, product_id)
);

-- 3. Company / seller + numbering (singleton row)
create table invoice_settings (
  id boolean primary key default true check (id),
  seller_name text, gstin text, address text, tel text, email text, logo_url text,
  bank_name text, bank_account text, bank_ifsc text,
  terms text, signatory_label text, payment_qr_url text,
  state_code text not null default '36',      -- Telangana
  number_prefix text not null default 'BAL',
  fy_label text not null default '26-27',
  next_number int not null default 2000,
  rounding text not null default 'line_whole_rupee',
  updated_at timestamptz not null default now()
);

-- 4. Per-HSN GST rate (total %; split /2 for CGST+SGST, full for IGST)
create table hsn_gst_rates ( hsn text primary key, gst_pct numeric not null );
-- seed (confirm): 2710→18, 8482→18, 8421→18, 3820→18

-- 5. Generated-invoice fields (invoices already has station, party_phone, line_items, invoice_source)
alter table invoices
  add column transport_name text,
  add column vehicle_no text,
  add column eway_bill_no text,
  add column irn text,
  add column irn_qr text,
  add column reverse_charge boolean not null default false,
  add column place_of_supply text;
-- line_items gains per-line: discount_pct, gst_pct (alongside existing hsn, mrp, price, amount, quantity, description)
```

Invoice number is issued by atomically incrementing `invoice_settings.next_number` inside the
create transaction (no duplicates); FY rollover bumps `fy_label` and resets `next_number` to 1.

## Configure → Invoicing (new sidebar area, Super Admin)

1. **Company & seller** — name, GSTIN, address, tel, email, logo, bank (name/A-C/IFSC), terms, signatory, payment-QR, state.
2. **Numbering** — prefix, FY label, next number (seed 2000), FY-reset toggle.
3. **Tax** — per-HSN GST rate; intra vs inter-state handled automatically from customer state.
4. **Price master** — table of product × pack (MRP, MOP); **Import from MOP** action (match by product name + pack, review unmatched).
5. **Customer discounts** — per customer: default % + per-product overrides.
6. Rounding + copies settings.

## Generate-from-order flow (Accountant + Super Admin)

Order detail → **Generate Invoice** → lines prefill from the order (product + pack + qty);
Price/MRP auto from the master; per-line discount pre-filled from customer (editable). Accountant
adds transport / vehicle / station and pastes e-way bill / IRN / QR. Date = today. Compute taxable →
CGST+SGST or IGST → whole-rupee amounts → grand total + tax summary + amount-in-words → save
(invoice + line_items, `invoice_source='generated'`, outstanding = grand total, notify SE — existing logic).
Partial invoicing (multiple invoices per order) is already supported and stays.

## PDF generation (Workers-safe)

Generating a PDF on Cloudflare Workers has no headless Chrome, so render **client-side** in the
accountant's browser (pdfmake / jsPDF-autotable — table-friendly) in the exact BAL layout, produce
Original/Duplicate/Triplicate, then upload the bytes to R2 via the existing invoice-file store so
the current `/api/invoice-files/:id` viewer shows it unchanged.

## MOP import

Parse the 4-page MOP PDF → rows `(category, product, pack, mrp, mop, scheme, coupon)`. Match each to a
DB product by **product name + pack size** (names align closely; segment ~ category). Present a review
screen for unmatched/ambiguous rows (e.g. `20W40 SP` ↔ `20W40 API SP`). Confirmed rows upsert into
`product_pack_prices`.

## Phasing

- **1a** Configure → Invoicing: company settings, numbering, HSN GST, price master + MOP import, customer discounts.
- **1b** Generate-from-order + compute + save (number issuance).
- **1c** PDF template (BAL, 3 copies) + store/view.
- **2** Bearings + filters pricing (extend price master + line kinds).
- **3** Stock Journal (Add/Modify/List).
- **4** GST reports + audit.

## Open items to confirm

1. **Invoice line description**: use the current product name + pack (`10W30 SL 0.8L`), or the old branded text (`SILKOLENE SUPER 4 SAE 10W30 0.8L`)? Proposal: product name + pack, with an optional per-product `invoice_description` override in the price master.
2. **GST rate seed** = 18% for 2710 / 8482 / 8421 / 3820 — confirm.
3. **Due date / credit terms** on generated invoices: keep the existing 60-day setting, or per-customer credit terms?
4. **First number** `BAL/26-27/2000` = the first number the app will issue (BusyWin's last was 1999 or lower) — confirm.

---

# BUILD STATUS & RESUME NOTES (updated 2026-08-06)

**Working style (client goal):** TDD, **≤100 lines per file**, one phase at a time.

> **⚠️ ARCHITECTURE SIMPLIFIED (2026-08-06) — pricing folded into the Products page.**
> The client asked to make this lightweight, so the separate **Price-Master screen + MOP-import
> chain was deleted**. MRP+MOP are now edited as **per-pack rows inside the existing product
> create/edit dialog**. A product's packs became `[{packSize, mrp, mop}]` (MRP/MOP optional).
> `/products` GET returns `packs`; POST/PATCH accept `packs` and upsert `product_pack_prices`
> next to `product_pack_sizes`. Products list gained a **"Packs · MOP"** column. New files:
> api `services/product-packs.ts` (TDD), web `features/products/pack-rows.tsx`.
> **Deleted:** api `routes/invoicing-prices.ts` + services `prices.ts`/`mop-import`/`mop-match`/`mop-parse`;
> web `price-master.tsx`/`mop-import-panel.tsx`/`prices-api.ts`/`invoicing-tabs.tsx` + the
> `/dashboard/invoicing/prices` route. `/invoicing/prices` API route unregistered; the Invoicing
> settings page is now a single screen (no tabs). The generate pipeline still reads
> `product_pack_prices` directly (unchanged). The "MOP import" / "price master" mentions below are
> **historical** — ignore them for pricing UI; edit prices on the product itself.

## Confirmed decisions (beyond the table above)
- Invoice **line description** = current product name + pack (`10W30 SL 0.8L`).
- **GST seed** = 18% for 2710 / 8482 / 8421 / 3820 (configurable).
- Invoice **date** = today; header fields editable = Transport / Vehicle / Station + E-way / IRN / QR + **per-line discount**.
- Numbering: app auto-assigns; **first issued = `BAL/26-27/2000`**, FY reset.
- Discount can be **varied per product**; oils first (bearings/filters later).
- Everything configurable under **Configure → Invoicing** (nothing hardcoded).

## DONE ✅ (Phase 1, oils) — all TDD, all files ≤100 lines

**DB — migration `packages/db/migrations/0053_invoicing.sql` APPLIED to the live DB:**
`product_pack_prices`, `customer_product_discounts` (+ `customers.default_discount_pct`),
`hsn_gst_rates` (seeded 18%), `invoice_settings` singleton (seeded `next_number=2000`, `fy_label=26-27`),
new `invoices` cols: `transport_name, vehicle_no, eway_bill_no, irn, irn_qr, reverse_charge, place_of_supply`.

**API pure logic (`apps/api/src/services/invoicing/`, ~40 tests):**
`invoice-calc` (MOP→price/amount, whole-rupee, CGST/SGST vs IGST — verified vs real ₹26,124 invoice),
`invoice-number` (BAL/FY/issue+reset), `discount` (override precedence), `mop-parse` + `mop-match`
(parse MOP list + match by name/pack), `mop-import` (`buildMopImport`), `settings` (map),
`invoice-build` + `invoice-resolve` (order lines → priced build lines), `generate-data` (loader),
`generate` (`computeGeneratedInvoice`, read-only), `commit` (`commitGeneratedInvoice`, ONE transaction:
bump number + insert invoice `invoice_source='generated'` + insert `invoice_line_allocations` → order flips
to Invoiced + SE `se_notifications`).

**API routes (`apps/api/src/routes/`):** `invoicing.ts` (GET/PUT `/invoicing/settings` SA; GET `/invoicing/company`
SA+Accountant) + mounts `invoicing-prices.ts` (GET `/prices`, `/prices/products`, POST `/prices/import`, POST `/prices`),
`invoicing-generate.ts` (POST `/orders/:id/preview` read-only, POST `/orders/:id/generate` commit),
`invoicing-pdf.ts` (POST `/invoices/:id/pdf` → R2 `invoices/…` + set `invoice_pdf_url`). Registered in `index.ts`.

**Web (`apps/web/src/features/invoicing/` + `app/dashboard/invoicing/`):** Configure→Invoicing nav (Super Admin,
`dashboard-nav.tsx`). `/dashboard/invoicing` company/numbering **settings form**; `/dashboard/invoicing/prices`
**Price Master + MOP import review** (paste MOP text → auto-upsert matched, assign unmatched via product picker).
**Generate Invoice** action in Orders row menu (SA/Accountant) → `generate-invoice-dialog.tsx`: live preview
(lines + totals + invoice no), **editable per-line Disc %** (`preview-lines.tsx`, re-previews server-side),
header fields, Generate → commit → **render PDF client-side** (jsPDF+autotable: `invoice-pdf.ts` + `invoice-pdf-blocks.ts`,
`amount-in-words.ts` TDD, Original/Duplicate/Triplicate) → upload → viewable via existing `/api/invoice-files`.

**Price master seeded:** 57 of 74 retail MOP SKUs loaded; pricing verified exact vs real invoices.

**Live-verified in browser:** Configure settings save; Price Master + MOP import (assign unmatched); Generate dialog
preview (ORD-0152 → BAL/26-27/2000, ₹4,460); **per-line discount** (10% → ₹4,014, taxable 3,401.69). Did NOT commit a
real invoice (avoids burning #2000) — `next_number` still 2000, no invoice created.

## PENDING / TODO (resume here)
1. **17 unmatched MOP SKUs** — resolve via the Price Master import review (name gaps: `10W30 SCOOT`↔`10W30 MAX SCOOT`,
   `20W40 SP`↔`20W40 API SP`, `15W40 CK4 UNIMAX`↔`CI4+`; `15W40 CF4 UNIVERSAL` & `TITAN FORMULA 5W40 SN` not in catalogue).
2. **Bulk-pack (205L/50L/26L/27L drum) prices** not loaded — branded names differ; second MOP table.
3. **PDF layout not pixel-matched** to BusyWin — all fields present + correct, but spacing/borders need visual tuning
   once a real one is generated. (jsPDF hand-drawn header/party/footer + autotable line/tax tables.)
4. **inter-state detection is name-based** (`customer.address_state != 'Telangana'`) — no proper state-code map yet.
5. Expo **push** on generate (only in-app `se_notifications` row now; upload flow also pushes).
6. **due_date** = invoice_date (mirrors upload). Confirm if it should be invoice_date + credit days.
7. **Phase 2** bearings + filters pricing; **Phase 3** Stock Journal (Add/Modify/List); **Phase 4** GST reports + audit.

## DEPLOY / ENV STATE
- **API deployed** by client 2026-08-06 (deployed API has all `/invoicing/*` routes; verified 401 not 404).
- **Web NOT committed / NOT deployed** — all invoicing web changes (incl. per-line discount) are uncommitted working-tree.
- **`apps/web/.env.local`** currently points at **local API** (`http://localhost:8787/api/v1`) — flip back to
  `https://api.vardhansystems.workers.dev/api/v1` for a pure prod test.
- First real **Generate** will issue **BAL/26-27/2000**, mark the order Invoiced, notify the SE, store the PDF.

## Reference files
- Spec/decisions: this doc. Reference invoices: `~/Downloads/PAVAN SAI …pdf`, `SRI VENKATESWARA …pdf`.
- Price list: `~/Downloads/MOP 18MAY26 (1).pdf` (retail rows 1-74 + BULK PACKS section).
- Memory: `project-invoicing-build.md`.
