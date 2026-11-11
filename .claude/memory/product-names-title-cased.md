---
name: product-names-title-cased
description: "product_name normalized ALL-CAPS → smart Title Case (migration 0014, 228/230 products); matching is case-insensitive so safe; do NOT re-run the ALL-CAPS catalogue importer afterward (would create duplicates against the product_name UNIQUE constraint)."
metadata:
  node_type: memory
  type: project
  originSessionId: 159187b8-bc32-44dd-ab2a-4194814b3bd8
  modified: 2026-11-05T03:28:03.883Z
---

Product catalogue names were stored in **ALL-CAPS**; normalized to **smart Title Case** for readability — oil/grade/fluid codes (5W-30, ATF, GT1, PLA, CHF, CVTF, DCTF, FFL, MET, FE, LC, JD, ZX, GSM, SAE, API, SP, SN, SL, LL, HD, EP, RTU, EU…) stay uppercase; every other word Title-cased. e.g. `TITAN GT1 FLEX 5 SAE 0W-20` → `Titan GT1 Flex 5 SAE 0W-20`.

- **Stored data change** (user chose this over display-only), everywhere product_name is read (web, mobile, invoices). Migration **`0014_product_name_title_case.sql`** = 228 guarded `UPDATE id → new name` (of 230 products). Generated from a smart-case transform (scratchpad `preview-case.mjs`), reviewed in an artifact before applying.
- **Safe — matching is case-insensitive:** `invoice-sku-match.ts` (`matchTokens` → `toUpperCase`) and `sku-analytics.ts` (`normalizeName` = `toUpperCase().replace(/[^A-Z0-9]+/g,"")`) both ignore case (and sku-analytics ignores punctuation). Reports group by live name; brand derivation reads the `brand` column. No after-name collisions vs the `products_product_name_key` UNIQUE constraint (verified).
- ⚠️ **Do NOT re-run the ALL-CAPS catalogue importer** after this — it matches by exact name, so it would see Title-Case names as new and INSERT duplicates. If re-importing, make the importer case-insensitive first. Relates to [[oil-segment-canonical-six]] (re-seed reintroduces old vocab).
- Status: **APPLIED to prod** — `schema_migrations` records `0014_product_name_title_case.sql` applied 2026-11-05 00:55 UTC (checksum `76c21e72…`, no drift). `pnpm --filter @sri-aparajita/db run migrate -- --status` shows Applied 14 / Pending 0. Catalogue is Title-cased; only 2 all-acronym names left upper ("LC ATF TASA TQ", "LC UTTO") = the 230−228. Committed with the stock work ([[stock-entry-pages-redesign]]).
