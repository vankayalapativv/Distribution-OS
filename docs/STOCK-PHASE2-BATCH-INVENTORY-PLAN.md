# Stock Journal — Phase 2: Batch-Level Inventory (Transfer / Adjust)

> Status: **PLANNED, decisions locked, not started** (2026-11-05). Phase 1 + 1b + the Stock-home/lookup/drill-down round are shipped and deployed. This document is the implementation plan for the one deferred piece.
>
> Pairs with [`INVOICING-STOCK-ARCHITECTURE.md`](INVOICING-STOCK-ARCHITECTURE.md). Local dev runs against the **live prod DB** — treat every migration/backfill as production.

## 0. Locked decisions (2026-11-05)

1. **Transfer / Adjust → manual batch pick, FEFO default, ONE lot per line.** The picker pre-selects the soonest-expiry lot; to pull from a second batch you add another line for the same SKU. No auto-split here.
2. **Positive adjustment REQUIRES a batch + expiry** (treated as a corrective receipt / mini stock-in). No "unbatched" positive.
3. **Transfer carries the source lot's shelf location** (rack/shelf/bin) to the destination lot by default (editable).
4. **Invoicing (sales) consumes lots automatically, FEFO, auto-split across lots** — no picker. (Invoicing already writes `kind:"sale"` movements in `invoicing.ts`; Phase 2 makes them lot-aware.)
5. The work ships in **four sub-phases** — see §13.

## 1. Goal

Let **Transfer** and **Adjust** operate on a *specific received batch* so the batch's **expiry date** and **shelf location** travel with the units, and so the Near-expiry (FEFO) report reflects the stock that is actually still on hand per batch — not the as-received quantity.

Concretely:
- Transferring 10 units from Bachupally → Hayatnagar lets you pick *which* lot (e.g. batch `OPN-GT1`, exp Dec 2026) moves, and the destination then knows that expiry.
- A negative adjustment (damage/write-off) is charged against a chosen lot, so the Near-expiry report stops counting units that were destroyed.
- Near-expiry and Stock-lookup show **remaining** per lot, not received.

## 2. Current state (what exists today)

- **Ledger is the source of truth.** `stock_movements` (append-only, signed `qty_units`) + a cached `stock_balances` keyed `(location_id, product_id, pack_size_litres)` with a non-negative CHECK (`stock_balances` is rebuilt from the ledger by `recomputeBalances`). Writers: `movementStmt` / `balanceStmt` in `apps/api/src/services/stock-shared.ts`.
- **Batches are captured only on the way IN.** `goods_receipt_items` (migration `0012`) and `opening_stock_items` (`0013`) carry `batch_number / expiry_date / rack_no / shelf_no / bin_no`. These are **static document rows** — nothing ever decrements them.
- **Transfer / Adjust are qty-only.** `stock_transfer_items` and `stock_adjustment_items` have no batch column; `postTransfer` / `postAdjustment` write movements + balances at `(location, product, pack)` granularity only (`apps/api/src/services/stock.ts`). The UI (`stock-entry-panels.tsx`) uses the qty-only `LineTable`.
- **No per-batch on-hand exists anywhere.** `stock_balances.qty_units` is the only on-hand number, and it has no batch dimension.
- **Right now the stock tables are empty** (E2E dummy data was wiped), so this is the *ideal* time to add the batch dimension — no meaningful backfill yet.

## 3. Design decision — a location-scoped **lot** with ledger-derived on-hand

A **lot** = a distinct parcel of stock sitting in one godown, identified by `(product, pack, brand, batch_number, expiry_date, location)` plus its shelf location at that godown. This mirrors the existing architecture:

- Add a canonical **`stock_lots`** table (the batch identity + its shelf location at a godown).
- Add a cached **`qty_units` per lot** with a non-negative CHECK — the batch analogue of `stock_balances`, maintained by the same decrement-UPDATE / increment-UPSERT pattern and rebuildable from the ledger.
- Add **`batch_id` (→ `stock_lots.id`) to `stock_movements`** so the ledger stays the source of truth and `recomputeBalances` can rebuild lot balances too.
- **Keep aggregate `stock_balances` exactly as is.** Invariant: `stock_balances.qty_units == sum(stock_lots.qty_units)` for each `(location, product, pack)`. The existing on-hand, low-stock, KPI, and drill-down code keeps working unchanged; lots are an added dimension, not a replacement.

A transfer therefore **decrements the source lot** and **finds-or-creates a destination lot** (same product/pack/brand/batch/expiry, destination location) and increments it — the expiry **and the source shelf location** ride along (editable at the destination).

**Sales (invoicing)** consume lots the same way a transfer-out does, but **automatically FEFO-allocated**: for each `kind:"sale"` line the service walks the SKU's lots at the selling godown oldest-expiry-first and decrements across as many as needed to cover the line qty (auto-split), writing one `sale` movement per lot touched. No user picking.

> Rejected alternative: adding `qty_remaining` to `goods_receipt_items` / `opening_stock_items` directly. Those are immutable document rows tied to one location; a transfer to another godown has no row to land on, forcing lot-splitting hacks. A dedicated `stock_lots` table is cleaner and matches the ledger/cache design already in place.

## 4. Schema changes (new migration, e.g. `0015_stock_lots.sql`)

```sql
BEGIN;

-- 4.1 The lot (batch identity at a godown + its shelf location there).
CREATE TABLE IF NOT EXISTS stock_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES products(id),
  pack_size_litres numeric NOT NULL,
  brand            text,
  location_id      uuid NOT NULL REFERENCES stock_locations(id),
  batch_number     text,
  expiry_date      date,
  rack_no          text,
  shelf_no         text,
  bin_no           text,
  qty_units        numeric NOT NULL DEFAULT 0 CHECK (qty_units >= 0),  -- cached on-hand for THIS lot
  source_type      text,     -- 'grn' | 'opening' | 'transfer' | 'adjustment'
  source_id        uuid,     -- originating document id
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Fast "find-or-create destination lot" + "available lots for a SKU at a godown".
CREATE INDEX IF NOT EXISTS stock_lots_sku_loc_idx
  ON stock_lots (location_id, product_id, pack_size_litres);
-- Identity match for find-or-create (NULLs compared via a normalized key — see §6.2).

-- 4.2 Ledger gains the batch dimension (source of truth for lot on-hand).
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES stock_lots(id);
CREATE INDEX IF NOT EXISTS stock_movements_batch_idx ON stock_movements (batch_id);

-- 4.3 Document lines record which lot they touched (audit + document detail).
ALTER TABLE stock_transfer_items   ADD COLUMN IF NOT EXISTS from_batch_id uuid REFERENCES stock_lots(id);
ALTER TABLE stock_transfer_items   ADD COLUMN IF NOT EXISTS to_batch_id   uuid REFERENCES stock_lots(id);
ALTER TABLE stock_adjustment_items ADD COLUMN IF NOT EXISTS batch_id      uuid REFERENCES stock_lots(id);

COMMIT;
```

Notes:
- `gen_random_uuid()` needs `pgcrypto` (already used elsewhere in this DB — verify, else `crypto.randomUUID()` from the service like `postTransfer` does today).
- The per-lot `CHECK (qty_units >= 0)` is the batch-level hard-block backstop, exactly like `stock_balances`.
- Everything is **additive** (new table + nullable columns), so the deployed Phase-1 API keeps working between migrate and deploy.

## 5. Backfill (`stock_lots` seeding)

Because the stock tables are currently empty, backfill is a **no-op today** — build Phase 2 before real stock accumulates and there is nothing to reconcile.

When real stock *does* exist later, the backfill is:
1. Insert one `stock_lots` row per `goods_receipt_items` and `opening_stock_items` row (carry product/pack/brand/batch/expiry/location/shelf, `source_type`, `source_id`).
2. Set each lot's `qty_units` by allocating historical consumption **FEFO** (oldest expiry first) against the aggregate `stock_balances` so that `sum(lot.qty_units) == stock_balances.qty_units` per `(location, product, pack)`.
3. Any aggregate on-hand with **no** matching lot (stock that entered without batch metadata) seeds a single **"unbatched" lot** (null batch/expiry) to preserve the invariant.
Ship this as a one-off script in `packages/db` guarded to run once (or a `--baseline`-style step), never as part of the normal migrate.

## 6. Service layer (`apps/api/src/services/stock.ts` + `stock-shared.ts`)

### 6.1 New shared writer — `lotBalanceStmt`
Mirror `balanceStmt`: decrement = plain UPDATE on `stock_lots` by `id` (row pre-exists; CHECK is the backstop); increment handled by the lot upsert in find-or-create. Add `batch_id` to `MovementInput` + `movementStmt`.

### 6.2 `getOrCreateLot(sql, { locationId, productId, packSizeLitres, brand, batchNumber, expiryDate, rack/shelf/bin, source })`
Find an existing lot at the location with the same identity (`product, pack, brand, batch_number, expiry_date` — compare NULLs safely, e.g. `coalesce(batch_number,'') = …` / `expiry_date IS NOT DISTINCT FROM …`), else insert one. Returns the lot id. Used by GRN, opening, transfer-in, positive adjustment.

### 6.3 `postGrn` / `postOpening` (extend)
For each line, `getOrCreateLot(...)` (source `grn`/`opening`) and set the created movement's `batch_id` to that lot; increment the lot's `qty_units`. (They already collect batch/expiry/location, so this is wiring, not new input.) Aggregate `stock_balances` writes stay unchanged.

### 6.4 `postTransfer` (rework)
Per line the input now carries `fromBatchId` (+ optional destination shelf). For each line, in one transaction:
- Decrement the source lot (`lotBalanceStmt` −qty) + `transfer_out` movement with `batch_id = fromBatchId`.
- `getOrCreateLot` at the **destination** (same product/pack/brand/batch_number/expiry; new shelf) → increment it + `transfer_in` movement with `batch_id = destLotId`.
- Keep the existing aggregate `balanceStmt` −from / +to.
- Record `from_batch_id` / `to_batch_id` on `stock_transfer_items`.
- Hard-block: requested qty ≤ source **lot** remaining (tighter than today's per-SKU `shortLines`); the per-lot CHECK is the backstop.

### 6.5 `postAdjustment` (rework)
- **Negative** delta: input carries `batchId` (required); decrement that lot + `adjustment` movement with `batch_id`; aggregate `balanceStmt` −; block if `abs(delta) >` lot remaining.
- **Positive** delta: **requires** batch + expiry (+ optional shelf) → `getOrCreateLot` (source `adjustment`) + increment. A positive adjust is a corrective receipt, so it is batched like opening/stock-in. Validate 422 if a positive line omits batch/expiry.

### 6.7 Invoicing — `invoicing.ts` lot consumption (Phase 2d)
Replace each one-shot `kind:"sale"` `movementStmt` (`invoicing.ts` ~line 311 and ~line 551) with a shared **`allocateSaleFefo(sql, { locationId, productId, packSizeLitres, qtyUnits })`** that:
- lists the SKU's lots at `locationId` with `qty_units > 0`, **FEFO** (`expiry_date ASC NULLS LAST`), and walks them decrementing until the line qty is covered (auto-split);
- emits one `sale` movement per lot touched (`batch_id` set, `refType:"invoice"`, `refId`), plus the lot decrements, plus the existing aggregate `balanceStmt` −;
- throws `STOCK_SHORT` (409) if the lots don't total enough (same backstop as transfer). Reversal (`sale_reversal`) must re-credit the **same lots** it took from — so record the per-lot allocation on the invoice's stock lines (e.g. an `invoice_stock_allocations` row, or reuse the movements' `batch_id` to reverse symmetrically).

### 6.6 Reads
- **`listAvailableLots(sql, { locationId, productId, packSizeLitres })`** → lots with `qty_units > 0`, FEFO-sorted (`expiry_date ASC NULLS LAST`), each `{ id, batchNumber, expiryDate, rack/shelf/bin, qtyUnits, daysToExpiry }`. Drives the picker.
- **`listNearExpiry` / `lookupProductStock`**: switch the quantity source from as-received (`goods_receipt_items` / `opening_stock_items`) to **`stock_lots.qty_units`** (remaining) where `qty_units > 0`. This is the accuracy payoff; keep the UNION shape so the UI is unchanged.
- **`recomputeBalances`**: also rebuild `stock_lots.qty_units` from `sum(stock_movements.qty_units) GROUP BY batch_id`.

## 7. API routes (`apps/api/src/routes/stock.ts`)
- **`GET /stock/lots?locationId=&productId=&packSizeLitres=`** (OFFICE roles) → `listAvailableLots`. Feeds the batch picker.
- **`POST /stock/transfers`**: each line gains `fromBatchId` (required) + optional dest shelf. Validate the lot belongs to the source godown.
- **`POST /stock/adjustments`**: each line gains `batchId` (required for negative; optional batch fields for positive).
- `near-expiry` / `lookup` unchanged in shape (now lot-backed).
- **Invoicing: no new route.** Lot consumption is internal to `invoicing.ts` (Phase 2d); the invoice generate/void endpoints are unchanged in shape.

## 8. Web UI (`apps/web/src/features/stock/*`)
- **Batch picker in Transfer & Adjust.** Replace the qty-only `LineTable` for these two panels with a lot-aware row: after choosing a SKU, a **batch dropdown** (`GET /stock/lots`) listing `batch · exp MMM YYYY · shelf · remaining N`, FEFO-sorted, plus the qty field capped at that lot's remaining. Reuse `SearchSelect` + `MonthYearField`/`formatMonthYear` for display.
  - **FEFO default, ONE lot per line:** pre-select the soonest-expiry lot; each line is exactly one lot. To pull from a second batch, add another line for the same SKU (no auto-split in the UI).
- **Transfer** pre-fills the destination shelf (rack/shelf/bin) from the source lot (editable per line — decision #3).
- **Positive adjustment** shows **required** batch + expiry fields (plus optional shelf), like the opening grid; the form blocks submit until a positive line has them.
- **Invoicing** has **no picker** — lot consumption is automatic/FEFO server-side (Phase 2d); the generate-invoice UI is unchanged.
- `stock-doc-detail.tsx`: show the batch on transfer/adjust line detail (from `from_batch_id` / `batch_id`).
- Stock-in / Opening panels: **unchanged** UI (they already capture batch; only the backend now also creates a lot).

## 9. Shared types (`apps/web/src/features/stock/stock-api.ts`)
- `MoveLine` gains `fromBatchId: string` (+ optional dest shelf); `AdjLine` gains `batchId: string | null` (+ optional batch fields for positive).
- New `Lot` type + `fetchAvailableLots(cfg, { locationId, productId, packSizeLitres })`.
- Mirror the input types in `apps/api/src/services/stock.ts` (`TransferInput` / `AdjustmentInput` lines).

## 10. Decisions
All locked — see **§0**. (Transfer/Adjust = manual pick, FEFO default, one lot per line; positive adjust requires batch+expiry; transfer carries source shelf; invoicing = auto-FEFO, auto-split, no picker.)

## 11. Testing
- **Service** (`services/stock.test.ts`): `getOrCreateLot` find vs create (incl. NULL batch/expiry identity); `postGrn`/`postOpening` create+increment a lot and tag the movement; `postTransfer` decrements source lot + find-or-creates dest lot (same batch/expiry, new location) + keeps `sum(lots)==balance`; `postAdjustment` −/+ ; per-lot over-decrement → `STOCK_SHORT`; `listAvailableLots` FEFO order; `listNearExpiry`/`lookupProductStock` now read remaining; `recomputeBalances` rebuilds lot balances. Target the same **100% line+branch** bar as Phase 1.
- **Route** (`routes/stock.test.ts`): `GET /stock/lots`; transfer/adjust payloads with `batchId`; 422 when a negative adjust/transfer line omits its batch.

## 12. Rollout (local = prod — be careful)
1. Land code + migration `0015` behind the additive schema (nothing breaks pre-deploy).
2. Apply `0015` (`pnpm --filter @sri-aparajita/db run migrate`; user-run, prod-gated).
3. Run the one-off backfill **only if** real stock exists (currently empty → skip).
4. Deploy API, then web.
5. Smoke-test: receive a batch → transfer part of it to the other godown → confirm the destination lot carries the expiry and Near-expiry reflects remaining; negative-adjust a lot → confirm Near-expiry drops it.

## 13. Phased delivery (authoritative)

Four sub-phases, each independently shippable (typecheck + lint + 100% tests + deploy) and each preserving the invariant `sum(lots) == stock_balances`. Build in order; **2a carries the migration** and must land first.

### Phase 2a — Foundation: lots + inbound + accurate remaining *(no UI change)*
The base everything else builds on. Lowest risk; ship and let it bake.
- **DB:** migration `0015_stock_lots.sql` (§4) — `stock_lots`, `stock_movements.batch_id`, batch FKs on transfer/adjust items. Additive only.
- **API:** `lotBalanceStmt` + `batch_id` on `MovementInput`/`movementStmt` (`stock-shared.ts`); `getOrCreateLot`; `postGrn` + `postOpening` create/increment lots and tag movements; `recomputeBalances` rebuilds `stock_lots.qty_units`; `listNearExpiry` + `lookupProductStock` read **remaining** from `stock_lots` (keep response shape).
- **Backfill:** no-op while stock is empty; include the guarded one-off script (§5) for later.
- **Tests:** `getOrCreateLot` find/create incl. NULL-batch/expiry identity; grn/opening create+increment+tag; near-expiry/lookup from remaining; recompute rebuilds lots; invariant holds. 100% on new code.
- **Deploy:** apply `0015`, deploy API (+ web only if lookup/near-expiry display tweaks). **Verify:** receive two batches, confirm per-lot remaining + near-expiry.

### Phase 2b — Transfer by batch *(manual pick, FEFO default, one lot per line)*
- **API:** `GET /stock/lots?locationId=&productId=&packSizeLitres=` (`listAvailableLots`, FEFO); `postTransfer` rework — per line `fromBatchId` (required), decrement source lot, find-or-create destination lot (carry batch/expiry + **source shelf**, editable), aggregate balances unchanged, write `from_batch_id`/`to_batch_id`; per-lot short-block.
- **Web:** Transfer panel uses a lot-aware row — SKU → batch dropdown (`batch · exp · shelf · remaining`, FEFO-preselected) + qty capped at lot remaining; add-another-line to split across batches; destination-shelf fields pre-filled from source. Shared types (`MoveLine.fromBatchId`, `Lot`, `fetchAvailableLots`).
- **Tests:** service (decrement source, dest find-vs-create, shelf carry, invariant, over-qty → `STOCK_SHORT`) + route (`/stock/lots`, transfer payload, 422 missing batch). **Deploy:** API + web. **Verify:** transfer part of a lot cross-godown; destination carries expiry + shelf.

### Phase 2c — Adjust by batch *(negative pick; positive requires batch+expiry)*
- **API:** `postAdjustment` rework — negative line `batchId` (required) decrements the lot; positive line requires batch+expiry → `getOrCreateLot` + increment; 422 validation; write `batch_id` on items.
- **Web:** Adjust panel — negative rows get the batch picker; positive rows show required batch+expiry (+optional shelf) like opening; submit gated.
- **Tests:** negative decrement + positive create, 422s, invariant. **Deploy:** API + web. **Verify:** damage-adjust a lot drops it from near-expiry; positive adjust creates a batched lot.

### Phase 2d — Invoicing consumes lots *(automatic FEFO, auto-split, no picker)*
- **API:** `allocateSaleFefo` (§6.7); swap the two `kind:"sale"` sites in `invoicing.ts` to allocate across lots FEFO, emit one `sale` movement per lot touched, `STOCK_SHORT` if short; make `sale_reversal` re-credit the same lots (record per-lot allocation, e.g. `invoice_stock_allocations`, or reverse by the movements' `batch_id`). Needs a small migration if an allocation table is added.
- **Tests:** single-lot sale, multi-lot auto-split, exact-boundary, short → 409, reversal restores the same lots, invariant after sale+reversal. **Deploy:** API (+ web if any invoice display shows batches). **Verify:** generate an invoice that spans two batches; confirm both decremented oldest-first and a void restores them.

> Dependency: 2b/2c/2d all require 2a. 2b, 2c, 2d are independent of each other and can ship in any order after 2a.

## 14. Effort (rough)
- 2a: ~0.5–1 day (migration + inbound wiring + read swap + tests).
- 2b: ~1 day (lots endpoint + transfer rework + picker UI + tests).
- 2c: ~0.5 day (adjust rework + UI + tests).
- 2d: ~0.5–1 day (FEFO allocator + reversal symmetry + tests).

---
*Generated 2026-11-05; decisions locked + phased 2026-11-05. Supersedes the "Deferred — Phase 2" note in Claude memory `stock-entry-pages-redesign`.*
