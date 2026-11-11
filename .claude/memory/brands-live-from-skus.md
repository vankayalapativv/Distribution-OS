---
name: brands-live-from-skus
description: listBrands now derives the brand list LIVE from the catalogue SKU tables (products/bearings/filters), so a brand with no SKUs is never shown; the brands master table is still written but no longer read for listing
metadata:
  type: reference
---

**`listBrands(sql, category)` in `apps/api/src/services/brands.ts` was changed (2026-10-15, deployed)** to return only brands that **actually have ≥1 SKU** — `select distinct btrim(brand) from <table> where brand is not null and btrim(brand) <> ''`, where the table is `products` (oils) / `bearings` / `filters`. So a brand with zero SKUs is **never listed** anywhere a brand appears (web Products brand filter + the add/edit brand pick-or-type dropdown; `/brands?category=`). This is "we don't need the brand if it has no SKU."

- Drove the fix: an orphan oil brand **"Vishnu"** sat in the `brands` master table with 0 products and showed in the filter; now hidden. Fuchs / Mahindra First Choice / Savsol stay (they have products).
- The `brands` master table + `ensureBrand` upsert are **still written** on product create (mandatory-brand validation) — they're just **no longer read** for listing. Deriving from SKUs also catches bulk-imported brands that were never upserted into `brands`.
- **Mobile was already correct** — the New-Order brand/company tabs derive `availableBrands` from the fetched products (distinct `product.brand`), so they never showed empty brands. This change only brought the WEB in line.

Deployed to the Cloudflare Worker API 2026-10-15 (web reads the deployed API). See [[savsol-dual-brand-and-segments]].
