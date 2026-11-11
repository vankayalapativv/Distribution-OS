# PENDING — BusyWin → Sri Aparajita Integration (read-only ongoing sync)

**Status:** SPECCED, not started. Blocked on schema discovery (Phase 0).
**Decided:** 2026-08-10, from the "Integration using BUSY Web Service" package BUSY shared.
**Owner context:** distributor runs **BusyWin** (Busy Accounting) as the book of record for
invoicing, purchases/stock, ledgers and GST. Sri Aparajita is the cloud DMS. Goal is to **mirror**
Busy's data into Sri Aparajita for viewing/analytics — Busy stays authoritative.

---

## 1. Decisions locked with the user (2026-08-10)

| Question | Answer |
|----------|--------|
| Direction / goal | **Ongoing sync** — Busy stays book of record, Sri Aparajita mirrors it |
| Read or write | **Read-only for now** (Busy → Sri Aparajita only; no write-back) |
| Sync window | **Office hours only, 9AM–8PM, Sun off** — no 24/7 needed |
| Connector on the office PC | **Yes, acceptable** (vs exposing the port via a tunnel) |
| BusyWin host | **Single office desktop**, on 9AM–8PM |

**Assumptions still to confirm (defaulted, overridable):**
- **Detail level = full line-item** (item, qty, rate, per-line tax), not just headers.
- **GST = in-app summaries** derived from synced vouchers; **actual filing returns stay in
  Busy's native export** (we do NOT re-derive filing-format GSTR from raw vouchers).

---

## 2. What "BUSY as Web Service" actually is (from the package)

- Not a cloud API. When enabled, **BusyWin itself becomes a local web server on
  `http://localhost:981`** on the PC where it runs. **BusyWin must be open AND the company
  logged in** for it to answer.
- Talked to with plain **HTTP GET** + header fields: `SC` (service code), `UserName`, `Pwd`,
  plus per-service params. Response carries header `Result`=`T`/`F` (+ `Description` on error);
  data in the body.
- **9 service codes only** (no report/GST/ledger-specific endpoints):

| SC | Operation | Use to us |
|----|-----------|-----------|
| **1** | GetXML from Recordset — run **arbitrary SQL** → XML | **PRIMARY read path** for every entity |
| 8 | GetVchXML — one voucher's full XML by `VchCode` | per-voucher detail / spot pulls |
| 9 | GetMasterXML — one master's XML by `MasterCode` | party/item master detail |
| 2,3,4 | Add / modify voucher | not used (read-only) |
| 5,6,7 | Add / modify master | not used (read-only) |

- Response of SC=1 is an XML recordset; SC=2 returns the new `VchCode`. Success = header
  `Result = "T"`. Sample: `Select * from Tran1 where VchType=9`.

### Voucher types we care about (from Master and Voucher types.pdf)
- **Invoicing** → `SALE = 9` (+ `SALE_RETURN = 3`, `CREDIT_NOTE = 18`, `DEBIT_NOTE = 17`)
- **Stock inward** → `PURCHASE = 2` and `MATERIAL_RECEIPT = 4` (+ `PURCHASE_RETURN = 10`,
  `MATERIAL_ISSUE = 11`, `STOCK_TRANSFER = 5`, `STOCK_JOURNAL = 8` if needed later)
- **Ledger** → all voucher types that touch a party account (2,3,4,9,10,14,16,17,18,19…)
- Account model confirmed in voucher XML: `AccDetail` with `AccountName`, `AmtMainCur`,
  **`AmountType` (1 = Debit, 2 = Credit)** — this is the Dr/Cr basis for ledgers.

### Master types (from the PDF)
`ACCOUNT_MASTER = 2`, `ITEM_MASTER = 6`, `MATERIAL_CENTER_MASTER = 11`,
`SALE_TYPE = 13`, `PURCHASE_TYPE = 14`, `TAX_CATEGORY = 25`, `EXECUTIVE = 33`, etc.

---

## 3. Architecture (recommended)

```
Office desktop (9AM–8PM, Mon–Sat)          Cloud (Sri Aparajita)
┌─────────────────────────────┐            ┌───────────────────────────┐
│  BusyWin (open + logged in)  │            │  Workers API (Hono)        │
│  └─ Web Service :981 (local) │            │  POST /integrations/busy/  │
│         ▲  SC=1 SQL (read)   │            │       sync  (shared secret)│
│         │                    │  HTTPS     │         │                  │
│  ┌──────┴───────────┐  ───────────────▶   │         ▼                  │
│  │  Sri Aparajita Connector │  outbound only     │  Neon: busy_* mirror tables│
│  │  (poll, delta)    │                    │  → read-only views in app  │
│  └───────────────────┘                    └───────────────────────────┘
```

**Connector, not tunnel — why:** the web service takes the Busy username/password in **plain
HTTP headers** and runs **arbitrary SQL**. Exposing port 981 to the internet (tunnel) is a real
risk. A connector keeps Busy on `localhost` and makes **outbound HTTPS only** to Sri Aparajita — no
inbound firewall/router changes, nothing exposed. Standard Busy/Tally integration pattern.

**Connector** = a small Windows program (a scheduled task / tray app / service). Each cycle,
during office hours only:
1. SC=1 query Busy for rows changed since the last watermark.
2. Convert XML recordset → JSON.
3. `POST` to the Sri Aparajita endpoint with a shared secret over HTTPS.
4. Sri Aparajita upserts into `busy_*` mirror tables (idempotent on Busy's `VchCode`).

**Delta / watermark:** Busy's `VchCode` is a monotonic unique id. Track the max synced
`VchCode` (and a last-modified marker if the schema has one) per entity; pull `WHERE VchCode >
@last`. Re-pull a trailing window (e.g. last N days) each run to catch in-place edits, since
edits reuse the same `VchCode`. (Exact modified-timestamp column TBD in Phase 0.)

**Sync cadence:** every ~5–15 min, 09:00–20:00 IST Mon–Sat. Mirrors how Sri Aparajita already gates
its cloud cron to office hours (see `project-cron-cost-window`).

**Security:** connector holds Busy creds locally + a Sri Aparajita API secret; Sri Aparajita endpoint
authenticates the secret and is the only writer to `busy_*` tables. No Busy creds in the cloud.

---

## 4. THE BLOCKER — Phase 0 schema discovery

The package documents **only the table name `Tran1`**. It does NOT give columns, the item-detail
table, the ledger/account-entry table, or the GST tax-breakup columns. **No real query can be
written until we have Busy's DB schema.** Close this one of two ways:

- **(a)** Busy sends their **DB schema / data dictionary** (table + column layout), OR
- **(b)** a short **session on the office PC** to introspect a live company via SC=1:
  - `Select * from Tran1` (limit a few) — voucher header columns, find `VchCode`, `VchType`,
    `VchNo`, date, party master code, amounts.
  - Discover the **item-detail** table (the per-line item/qty/rate/tax rows) and the
    **account-entry** table (the Dr/Cr `AmountType` rows) that pair with `Tran1`.
  - Discover **master** tables for party name + **GSTIN**, item name/HSN, tax category.
  - Confirm **CGST/SGST/IGST / taxable value / HSN** columns for GST summaries.
  - Confirm a **modified/updated** column (for delta), else fall back to trailing-window re-pull.

Deliverable of Phase 0: a short `docs/BUSY-SCHEMA.md` mapping Busy tables/columns → the fields
we need, plus the exact SQL for each entity.

---

## 5. Mirror data model (Neon) — sketch, finalize after Phase 0

- `busy_invoices` (Sale/Sale-return/Credit/Debit-note headers): `vch_code` (unique), `vch_type`,
  `vch_no`, `vch_date`, `party_master_code`, `party_name`, `party_gstin`, `taxable`, `cgst`,
  `sgst`, `igst`, `total`, `raw_xml`, `synced_at`.
- `busy_invoice_items` (line detail): `vch_code` FK, `sr_no`, `item_name`, `hsn`, `qty`, `unit`,
  `rate`, `amount`, `tax_category`, `tax_pct`, `tax_amount`.
- `busy_purchases` + `busy_purchase_items` (Purchase 2 / Material Receipt 4 — stock inward).
- `busy_ledger_entries` (per-account Dr/Cr lines across all voucher types): `vch_code`, `vch_type`,
  `vch_date`, `account_master_code`, `account_name`, `amount`, `dr_cr` (from `AmountType`),
  `narration`, `running_balance` computed app-side per account.
- `busy_gst_summary` (derived rollups by period × rate × in/out) — or compute on read.
- `busy_sync_state` (per-entity watermark: last `vch_code`, last run, row counts, last error).

All read-only in the app — displayed as "from BusyWin" so it's not confused with Sri Aparajita's own
invoicing/stock/ledger modules (which coexist; product decision on merging deferred).

---

## 6. Phasing

- **Phase 0** — schema discovery (BLOCKER; needs Busy schema or a PC session).
- **Phase 1** — connector skeleton + `POST /integrations/busy/sync` + **Sales invoices**
  end-to-end (mirror table + read-only screen). Proves the whole pipe.
- **Phase 2** — **Purchases / Material Receipts** (stock inward) + **Ledger**.
- **Phase 3** — **GST summaries** in-app.
- **Later (out of scope now)** — write-back (Sri Aparajita → Busy voucher creation via SC=2), if ever.

---

## 7. GST — options recap
1. **No GST endpoint** in the web service (confirmed — only SC 1–9).
2. **Summaries in Sri Aparajita**: derive CGST/SGST/IGST/HSN rollups from synced Sale/Purchase vouchers
   (needs the tax columns from Phase 0). Good for dashboards, **not filing**.
3. **Filing returns** (GSTR-1/3B/2B portal format): use **Busy's own native GST export** (the
   connector can grab the generated file), or the **GSTN portal API via a GSP** — a separate
   integration. Do NOT re-derive filing returns from raw vouchers.

---

## 8. Immediate next action (on the user)
Get the **Busy DB schema** from Busy, **or** arrange a short **session on the office PC** so the
Phase 0 discovery queries can be run. Everything else is blocked on that.
