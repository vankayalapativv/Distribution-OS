# GSTR-1 Monthly Export + Email-to-CA — Architecture

**Goal:** A monthly GST report of all transactions, exported in the **official GSTN GSTR-1 Excel Workbook Template** format (the CA uploads it to the GST Offline Tool as-is), with a one-click **"Email to CA"** that sends the file + a summary. Generic, per-enterprise, scoped by RLS. Validated against `VKR SALES OCT 2026.xls` (a real filled GSTN template).

Reference file inspected: GSTN template, October data — B2B 4 recipients / 109 invoices / ₹17.4L taxable @18%; B2CS ₹11.1L; HSN (b2b+b2c) 19 HSNs incl. engine oil (27101980) + auto parts; docs GSTAL/893–1079 + IGSAL/5–6 = 189 docs; mostly intra-state Telangana (36) with a little inter-state IGST.

---

## 1. What already exists (don't rebuild)

| Piece | Location | State |
|---|---|---|
| Export aggregation service | `apps/api/src/services/invoice-gst-export.ts` → `getInvoiceExport(sql, from, to)` | Returns `{period, b2b[], b2cs[], hsn[], docs, totals}`. **Simplified flat shape**, not GSTN-column-exact. |
| Route | `GET /api/v1/invoices/export` (`routes/invoices.ts`) | SUPER_ADMIN + ACCOUNTANT. Returns the JSON above. |
| Enterprise scoping | `lib/db.ts` RLS GUC `app.enterprise_id` | **Automatic** — every query is already per-enterprise. No code change needed for "generic". |
| Invoice data | `invoices` + `invoice_items` | `gst_number`, `buyer_state_code`, `place_of_supply`, `taxable_value`, `cgst/sgst/igst_amount`, `invoice_net_value`, `reverse_charge`, `invoice_source`, `doc_status`; items carry `hsn_code`, `gst_rate`, `qty_units`, `taxable_amount`, `cgst/sgst/igst`. |
| Seller identity | `enterprises` | `legal_name`, `trade_name`, `gstin`, `address_*`, `state_code` (default `36`), `pincode`. Drives header + intra/inter-state. |
| Credit-note source | `sales_returns` | Returns exist; **not yet surfaced** as CDNR/CDNUR. |
| Email transport | Resend, raw `fetch("https://api.resend.com/emails")` in `services/billing-reminders.ts` | Works today (text/html). **No attachment usage yet** — Resend supports `attachments:[{filename, content:<base64>}]`. |
| xlsx library | `apps/web` has `xlsx@0.18.5` (SheetJS) | API has none yet. |

**Net:** the hard parts (enterprise-scoped aggregation, tax split, seller identity, email transport) are in place. The work is (a) widen the aggregation to full GSTR-1 scope, (b) emit the **exact** GSTN template, (c) wire **email-to-CA**, (d) build the web UI.

---

## 2. Gaps to close

### 2a. Scope — current export is a subset
The existing service covers **B2B, B2CS (lumped), one HSN rollup, Docs**. Full GSTR-1 (per your scope) also needs:

- **B2CL** — inter-state B2C, invoice-value **> ₹2,50,000**, listed invoice-wise (split out of B2CS).
- **B2CS** — everything else unregistered, consolidated by **POS + rate + (intra/inter)**.
- **CDNR** — credit/debit notes to **registered** buyers (sales returns where the customer has a GSTIN).
- **CDNUR** — credit/debit notes to **unregistered** buyers.
- **EXEMP** — nil-rated / exempt / non-GST outward supplies (split inter/intra, registered/unregistered).
- **HSN split** — GSTN template has **two** sheets: `hsn(b2b)` and `hsn(b2c)`. Current export has one combined rollup.
- **Docs issued** — invoice + credit-note number ranges with count + cancelled (mostly present; extend to credit notes).

### 2b. Format fidelity — flat shape ≠ GSTN columns
The GSTN template sheets have fixed names, a summary band at the top, a header row at a fixed row index, and specific columns. Current `b2b[]` is invoice-level with a handful of fields; GSTN `b2b,sez,de` needs **one row per invoice × rate** with: GSTIN, Receiver Name, Invoice Number, Invoice date, Invoice Value, Place Of Supply, Reverse Charge, Applicable % of Tax Rate, Invoice Type, E-Commerce GSTIN, Rate, Taxable Value, Cess. The aggregation must be regrouped to rate-level and the missing columns (Receiver Name, Invoice Value, Invoice Type, Cess) added.

### 2c. UQC (unit of measure) — **data gap**
GSTN `hsn` sheets require a **UQC** per HSN (e.g. `BOX-BOX`, `NOS-NUMBERS`, `LTR-LITRE`). The app does **not** store UQC per product. The VKR file used `BOX-BOX` for every line. Decision needed (see §6) — recommended: a default UQC per enterprise (configurable), overridable later by a per-product column.

### 2d. xlsx generation + email attachment — not built
No GSTR-1 workbook builder exists, and email has never sent an attachment. Decision needed on **where** the workbook is built (§6).

### 2e. Web UI — none
No page consumes `/invoices/export`; no download, no preview, no "Email to CA".

---

## 3. Proposed architecture

### 3.1 Data layer — widen the aggregation service
Extend `invoice-gst-export.ts` into a full GSTR-1 dataset, still one function, still RLS-scoped, still **generated invoices only** (they carry the structured split; uploaded/parsed invoices are a different format and stay excluded — same rule as today):

```
getGstr1Dataset(sql, from, to) -> {
  period, seller: { gstin, legalName, stateCode },
  b2b[]      // registered, rate-level rows
  b2cl[]     // inter-state B2C, invoice value > 2.5L, invoice-level
  b2cs[]     // consolidated: POS + rate + supplyType(INTRA/INTER)
  cdnr[]     // credit/debit notes, registered (from sales_returns)
  cdnur[]    // credit/debit notes, unregistered
  exemp[]    // nil/exempt/non-gst, by (registered/unregistered × intra/inter)
  hsnB2b[]   // HSN rollup for B2B supplies  + UQC
  hsnB2c[]   // HSN rollup for B2C supplies  + UQC
  docs[]     // issued ranges (invoices + credit notes) with cancelled count
  totals     // reconciliation (taxable, cgst, sgst, igst, cess, invoice count)
}
```

Routing rules baked into SQL:
- **Registered vs unregistered:** `gst_number` present → B2B / CDNR; else → B2CS / B2CL / CDNUR.
- **Intra vs inter-state:** compare buyer POS state code vs **seller `state_code`**. Intra → CGST+SGST; inter → IGST. (Matches how invoices were raised; we read the stored split, we don't recompute tax.)
- **B2CL cutoff:** inter-state **and** `invoice_net_value > 250000` → B2CL (invoice-wise); else B2CS (consolidated).
- **Exempt:** lines with `gst_rate = 0` / flagged exempt → EXEMP, excluded from taxable sheets.
- **Credit notes:** `sales_returns` → CDNR/CDNUR by buyer GSTIN presence; note type = Credit, original-invoice ref carried.

### 3.2 Workbook builder — exact GSTN template
Ship the **blank official GSTN GSTR-1 Excel Workbook Template** as a static asset and **fill** it (open with SheetJS, write data rows under each sheet's header, leave the summary band + sheet names + column layout untouched). Filling the real template — rather than building sheets from scratch — is the safest path to **GST Offline Tool acceptance**.

- One builder, `buildGstr1Workbook(dataset, templateBytes) -> Uint8Array`, pure JS (SheetJS), **no Node APIs** → runs on Workers.
- Golden test: feed the October dataset, assert the output matches `VKR SALES OCT 2026.xls` section totals (B2B ₹17.4L, B2CS ₹11.1L, HSN counts, docs 189) cell-for-cell on the summary rows.

### 3.3 Where it runs — **recommend API/Workers** (single source of truth)
Build server-side so the **downloaded** file and the **emailed** file are byte-identical and email needs no browser round-trip:

- `GET  /api/v1/invoices/gstr1.xlsx?from=&to=` → streams the workbook (download).
- `POST /api/v1/invoices/gstr1/email?from=&to=` → builds the same workbook, emails it to the enterprise's CA with a summary, returns `{sent, to, summary}`.

Both call `getGstr1Dataset` → `buildGstr1Workbook`. (Fallback if SheetJS-write on Workers proves problematic: keep web building the file for download and POST the base64 to a thin `/gstr1/email` that only attaches + sends. Noted as the §6 decision.)

### 3.4 Email-to-CA
- **CA email config:** add `ca_email` (+ optional `ca_name`) to the enterprise profile / Settings. Per-enterprise, editable by SUPER_ADMIN (and ACCOUNTANT read).
- **Send:** extend the Resend helper to accept `attachments` (`{filename:"GSTR1-<enterprise>-<YYYY-MM>.xlsx", content:<base64>}`); subject `GSTR-1 <Month YYYY> — <legal_name>`; HTML body = period + section totals (taxable, tax, invoice/doc counts) so the CA sees the summary without opening the file.
- **Trigger:** ACCOUNTANT or SUPER_ADMIN, from the UI. **Explicit confirm** before sending (outbound email to a third party) — show "Send GSTR-1 for <Month> to <ca_email>?"; never auto-send.
- Guardrails: 422 if `ca_email` unset (prompt to configure); audit-log every send (`entityLabel` = period).

### 3.5 Web UI — Reports → GSTR-1
New page under Reports (SUPER_ADMIN + ACCOUNTANT): month picker (default last closed month) → **preview** (section cards: B2B / B2CL / B2CS / CDNR / CDNUR / EXEMP / HSN / Docs with counts + totals, from `/invoices/export`) → **Download .xlsx** + **Email to CA** (shows the configured CA address; disabled with a hint if unset). Reuse the existing table/skeleton components.

---

## 4. Build phases

1. **Dataset** — ✅ **DONE (2026-11-16).** `invoice-gst-export.ts` → `getGstr1Dataset` with seller header + B2B (rate-level) / B2CL / B2CS / CDNR / CDNUR / EXEMP / HSN(b2b) / HSN(b2c) / Docs(array) / totals. Route + mock updated; service test rewritten; interim web builder (`invoice-ca-export.ts`) + Tax Export report migrated to the new shape. API suite 1386 pass, web typecheck clean. **Gaps surfaced (for later phases):** (a) credit notes have no stored document number → synthesized `CN/YYYYMM/####`; (b) EXEMP can't distinguish nil vs exempt vs non-GST → all land in "exempted"; (c) CDNR/CDNUR tax split derived from the original line's `gst_rate` via `invoice_items.order_item_id` (a return item with no matching invoice line is dropped).
2. **Workbook** — ✅ **DONE (2026-11-16).** `xlsx@0.18.5` added to `apps/api`; `services/gstr1-workbook.ts` → `buildGstr1Workbook(dataset)` reproduces the exact GSTN layout for all 9 section sheets (summary band rows 1-3, header row 4, data row 5+), with `dd-Mon-yyyy` dates, canonical `NN-StateName` POS, `Regular B2B`/`OE`/`C` types and the full state-code map — verified cell-for-cell against `VKR SALES OCT 2026.xls`. Wired `GET /invoices/gstr1.xlsx?from=&to=` (SUPER_ADMIN+ACCOUNTANT). **SheetJS bundles for Workers** — `wrangler --dry-run` builds clean (gzip 837 KiB). Golden test (9 assertions) + full suite 1395 pass. **Note:** we reproduce the fixed layout from scratch rather than embedding the blank binary (VKR is a 14 MB `.xls`; the layout is fixed and the tool recomputes the summary band). **Deferred to Phase 5:** runtime-in-workerd generation + an actual GST Offline Tool import (confirms whether the tool accepts the 9 data sheets or needs the full 32-sheet template incl `master`).
3. **Email** — ✅ **DONE (2026-11-16).** CA contact stored as `company_ca_email` / `company_ca_name` in `system_settings` (the enterprise profile store — **no migration**), added to `CompanyProfile` + the Settings PATCH schema (email-validated). New `lib/email.ts` — reusable Resend helper with **attachment** support + chunked `arrayBufferToBase64`; `billing-reminders` refactored onto it (one Resend implementation). `POST /invoices/gstr1/email?from=&to=` (SUPER_ADMIN+ACCOUNTANT) builds the workbook, emails it to the CA with a period-summary body, audit-logs the send; **422** when no CA email is set, **503** when the provider is unconfigured/rejects. The web confirms before calling. Tests: email helper (5) + settings round-trip (3) + endpoint 200/422/503/403 (5). Full suite 1408 pass. **Still to wire (Phase 4):** the Settings UI field for CA email + the "Email to CA" button.
4. **Web UI** — ✅ **DONE (2026-11-16).** Settings → Company gained a **Chartered Accountant** section (`settings-ca.tsx`): `caName` + `caEmail` (email-validated), read/edit/empty states, PATCHed via `/system-settings`; `CompanyProfile` + `EMPTY_COMPANY` extended. Reports → **GST Report** card (renamed from "Tax Export") opens the detail: GSTR-1 preview (section counts + totals) with **Download .xlsx** (now the server-built official template via new `apiDownload` helper + `GET /invoices/gstr1.xlsx`, so download == emailed file) and **Email to CA** (confirm dialog showing the configured CA address + doc count/taxable → `POST /invoices/gstr1/email`; button disabled with a Settings hint when no CA email). Dropped the old client-side SheetJS builder (`downloadCaExport`). Web typecheck + lint clean; settings/reports/invoices suites 39 pass. **Live walkthrough deferred to Phase 5** (auth-gated pages; sign-in is the prod Neon Auth host).
5. **Verify** — 🔄 **IN PROGRESS (2026-11-16).** Code review of Phases 1–4 (medium) found 5 issues — **all fixed**, full suite 1408 pass: (1) CDNR/CDNUR now share one note-number sequence across both sheets (was duplicate CN/YYYYMM/0001 → Offline Tool rejection); (2) B2CS/B2CL split uses the same derived supply type, so a NULL `supply_type` >₹2.5L invoice is never dropped from both sheets; (3) credit-note tax derives intra/inter with the same fallback (was ₹0 tax on NULL `supply_type`); (4) email HTML escapes company fields; (5) the ~12 dataset queries run as one `Promise.all` batch after the seller lookup. **Full template (2026-11-16):** the workbook now ships the **complete 32-sheet template** in the template's own order — the nine data sheets plus every amendment / export / advance / e-commerce sheet, the `master` reference sheet and `Help Instruction`, reproduced verbatim from a skeleton (`gstr1-template-skeleton.json`, extracted from VKR). **Live test data:** created 15 real B2B invoices (+ 15 GST customers, checksum-valid GSTINs) for **Vardhan Demo**, Oct 2026 — 12 intra + 3 inter-state, 5 HSN codes incl one at 5% — directly in Neon (export-test rows: no backing order/stock, left in place per the user). Generated the live workbook via `createScopedSqlClient` → `getGstr1Dataset` → `buildGstr1Workbook` and sent `GSTR1-VardhanDemo-2026-10-LIVE.xlsx`. **Two more fixes from the live data:** (6) POS now prefers `buyer_state_code` over `place_of_supply` (this app stores the state NAME in `place_of_supply`, so POS renders `36-Telangana` not `Telangana`); (7) GST dates returned as `to_char(...,'YYYY-MM-DD')` text instead of a Neon `date`→JS `Date`, so `dateIso` no longer shifts a day under a non-UTC runtime (Oct 1 was printing as 30-Sep locally). Full suite 1409 pass. **Still needs the user:** import the live workbook into the GST Offline Tool to confirm the full template is accepted; then the deployed web Download/Email on a real month + a test email.

---

## 5. Risks / watch-items
- **Offline Tool strictness** — exact sheet names, header row position, date format (`dd-MMM-yyyy`), state code format (`36-Telangana`), number precision. Mitigated by filling the real template + golden test.
- **SheetJS write on Workers** — pure-JS write is expected to work; validate early in Phase 2 (fallback in §3.3).
- **UQC correctness** — a wrong UQC fails Offline Tool HSN validation. See §6.
- **Rounding** — do all money math in SQL `numeric` (per house rule), not JS float; carry 2-dp values straight into cells.
- **CDNR direction** — sales return = Credit note (reduces outward tax); keep sign/type exactly as GSTN expects.

---

## 6. Decisions (locked 2026-11-16)
1. **xlsx build location → API / Workers.** One `buildGstr1Workbook` on the server; download and emailed file are byte-identical; validate SheetJS-write on Workers early in Phase 2 (web-fallback kept in reserve only if it fails).
2. **UQC → enterprise-wide default now.** One configurable default UQC per enterprise (default `BOX-BOX`, as VKR used); add a per-product `uqc` override column in a later phase.
3. **Template → fill the real blank GSTN template asset.** Max Offline Tool compatibility; golden-test against VKR October totals.
4. **CA email → enterprise profile / Settings.** Single `ca_email` (+ `ca_name`) on the enterprise, edited by SUPER_ADMIN; one CA per enterprise for v1.
