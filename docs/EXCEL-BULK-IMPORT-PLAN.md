# Excel Bulk Import — Products & Stock Journal

**Goal:** let clients download a predefined Excel template, fill it in, and upload it back to bulk-create data in two places:

1. **Products** — add new products from a filled template.
2. **Stock Journal** — enter quantities at **Record stock-in** and **Opening stock** from a pre-filled catalogue template.

Status: **planning** (code reviewed, decisions locked). Build phase-by-phase; nothing deploys until the user says so.

---

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Products template layout | **One row per pack** — same `Name+Brand` rows group into one product |
| 2 | Stock template identity | **Pre-filled** with catalogue SKUs (Product · Pack · Brand); client fills quantities |
| 3 | Upload flow (both) | **Review screen → Confirm** (parse, show per-row validation, then commit) |
| 4 | Stock header fields | **From the page UI** (godown / supplier / date); Excel carries line items only |
| 5 | Products duplicate name | **Flag the row as an error** (blocks that row; other rows still import) |
| 6 | Stock-in template scope | **Filtered to the supplier brand** picked in the page. Opening = **all SKUs** |
| 7 | Stock template columns | Qty (+ **Rate** for stock-in) + optional **Batch · Expiry · Rack · Shelf · Bin**. Blank/zero-qty rows ignored |
| 8 | Products template helpers | **Example row + Reference sheet** (valid brands + allowed segments; dropdown validation where feasible) |
| 9 | Stock "Confirm" result | **Loads valid rows into the on-screen entry grid**; client then presses the normal Post button |

---

## Data shapes (from code review)

**Product** (`POST /products`, `createProduct` in `apps/api/src/services/products.ts`):
`productName` + `brand` (oils brand, `ensureBrand`) + `hsnCode` (exactly 8 digits) + `unit` (`litres` | `quantity`) + `segments[]` (canonical six: `Car, 2W, 3W, Commercial, Agri, Gear Oil`; plus `Coolant, Grease`) + `packs[]` (each: `packSize` litres, `mrp`, `mop`, `dlp` — all optional prices). Duplicate `product_name` → 409. `litres` products need ≥1 pack; `quantity` products have no packs.

**Stock-in line** (`POST /grn`): `productId` + `packSizeLitres` + `brand` + `qtyUnits` + `rate` + optional `batchNumber, expiryDate, rackNo, shelfNo, binNo`. Header: `locationId`, `supplierName` (brand), `supplierInvoiceNo`, `receivedDate`. **One brand per entry.**

**Opening line** (`POST /opening`): same line shape **minus rate**. Header: `locationId`, `openingDate`.

Stock lines reference **existing** catalogue SKUs by `productId + packSizeLitres + brand` — so the pre-filled template carries a hidden/locked `productId` (or resolves Name+Pack+Brand on import) to avoid name-matching errors.

**Libraries:** `xlsx` (SheetJS `0.18.5`) is already a dependency in `apps/web`. No new API needed for stock (reuses `/grn`, `/opening`); Products needs one new bulk endpoint.

---

## Phases

### Phase 1 — API: `POST /products/bulk`
- New endpoint (SUPER_ADMIN, MANAGER — same as `POST /products`) accepting an array of product inputs.
- Server-side validation per item mirroring `createProduct`: normalize name, validate HSN (8 digits), segments, brand, packs. Collect per-row results.
- **Duplicate names** (already in catalogue, or repeated within the payload) → that item reported as an error; valid items still insert.
- **Set-based + atomic**: insert all valid products + their segments + packs in one batched transaction (no round-trip per row — Workers subrequest cap; money/multi-write rule). Return `{ created: [...], errors: [{ row, message }] }`.
- Tests: service + route, **100% lines** (per project standard). Includes dup-in-catalogue, dup-in-file, bad HSN, bad segment, quantity vs litres, empty payload.
- Files: `apps/api/src/services/products.ts`, `apps/api/src/routes/products.ts`, `+ .test.ts`.
- Acceptance: `pnpm --filter @sri-aparajita/api test` green + 100% new-code lines.

### Phase 2 — Web: Products template + upload
- **Download template** button (Products page header): builds an `.xlsx` with
  - Sheet 1 `Products`: header row `Product Name · Brand · Unit · Segments · HSN · Pack Size (L) · MRP · MOP · DLP`, one greyed **example** row, one blank starter row.
  - Sheet 2 `Reference`: valid **brands** (from the live brands list) and allowed **segments**; apply Excel data-validation dropdowns on Brand/Unit/Segments columns where feasible.
- **Upload** button → parse with `xlsx` → group rows by `Name+Brand` into products → client-side validation (mirror server rules) → **review dialog**: table of products with per-row status (valid / error reason), counts, and a **Confirm** that calls `POST /products/bulk`; show the server's per-row errors back in the dialog; invalidate the catalogue query on success.
- New shared helper module for xlsx read/write (reused in Phase 3).
- Files: `apps/web/src/features/products/*` (new `products-import.ts`, `products-import-dialog.tsx`, template builder), header wiring in `products-list.tsx`/`products-dialogs.tsx`; new `apps/web/src/lib/xlsx-io.ts` (shared).
- Acceptance: live browser test — download, fill 2 products (multi-pack), upload, review (incl. a deliberate duplicate → error), confirm, see them in the catalogue. typecheck + lint clean.

### Phase 3 — Web: Stock-in Excel (pre-filled, brand-filtered)
- In **Stock-in** panel: after godown + supplier brand are chosen, enable **Download template** → pre-filled sheet of that brand's catalogue SKUs (`Product · Pack · Brand` locked) + empty `Qty · Rate · Batch · Expiry · Rack · Shelf · Bin` columns; carries `productId` (hidden/locked) for exact mapping.
- **Upload** → parse → ignore blank/zero-qty rows → validate (qty > 0, rate ≥ 0 or blank, known SKU) → **review dialog** → **Confirm loads valid rows into the existing entry grid** (via `L.add` + `L.set`), where the client sees totals and presses **Post stock-in** as normal.
- Reuses `apps/web/src/lib/xlsx-io.ts` and a shared stock-import review component.
- Files: `apps/web/src/features/stock/*` (new `stock-import.ts`, `stock-import-dialog.tsx`), wiring in `stock-entry-panels.tsx` (`StockInPanel`).
- Acceptance: live test — pick godown+brand, download, fill quantities + a batch/expiry, upload, review, confirm → rows appear in the grid with correct totals; Post works.

### Phase 4 — Web: Opening stock Excel (all SKUs)
- In **Opening** panel: **Download template** → pre-filled sheet of **all** catalogue SKUs + empty `Qty · Batch · Expiry · Rack · Shelf · Bin` (no Rate).
- Same upload → review → **load into grid** flow, reusing the Phase 3 components.
- Files: `stock-entry-panels.tsx` (`OpeningPanel`), reuse `stock-import*`.
- Acceptance: live test — download, fill quantities, upload, review, confirm → rows in grid; Save opening stock works.

---

## Conventions / guardrails
- Build **one phase at a time**; stop and report after each for review.
- API tests must hit **100% lines** on new code.
- Workers runtime rules (web-standard APIs only; set-based batched writes; `success()` wrapper; `requireRole`/`requireCapability`; SQL comment tags).
- **No deploy** until the user explicitly asks. Commits are the user's call.
- Reference: product/stock data shapes above; existing invoice-upload review pattern (`features/invoices/*`) as the UX model for the review dialog.

---

## Open questions
None — all decisions locked above. Revisit only if a phase surfaces a new one.
