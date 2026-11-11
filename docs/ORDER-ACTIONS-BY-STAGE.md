# Order Actions by Fulfillment Stage + Partial-Edit

**Date:** 2026-07-30
**Status:** Menu rules ✅ shipped + verified. Full-edit (Ordered) ✅ verified (no-op re-save round-trips cleanly after the refactor). Partial-edit ("edit un-invoiced remainder") ✅ **built** (API deployed + web) but ⚠️ **untested end-to-end** — there are **0 partially-delivered orders today**, so the locked-lines dialog + API partial path have only been typecheck/logic-verified. The API enforces the billed-quantity floor, so data can't be corrupted even if the UI has a rough edge.

## Per-stage Actions menu (web Orders list)

| Stage | Menu |
|-------|------|
| **Ordered** (no invoice) | Upload invoice · **Edit (full)** · Cancel — SA/Manager (Upload: SA/Accountant) |
| **Invoiced** (invoiced, 0 delivered) | **Cancel only** |
| **Partially delivered** (some delivered, not complete) | Cancel · Upload invoice · **Edit (un-invoiced remainder)** — SA/Manager/**Accountant** |
| **Delivered** (fully billed + delivered) | **No ⋮ button at all** |

Cancelled orders keep a disabled Cancel. ✅ **Verified live:** Delivered = no ⋮, Invoiced = Cancel only, Ordered = all three.

## Partial-edit — locked decisions

- **Editable scope:** the **un-billed portion**. For a line ordered 100 / billed 60, the user can change the remaining 40 (down or up). Roles: **SA, Manager, Accountant**.
- **Hard rule (server-enforced):** a line's quantity can **never** drop below what's already invoiced on it. The API rejects `newQty < invoicedUnits` with a 422 — even if the client misbehaves.
- **Fully-un-invoiced lines** (invoicedUnits = 0): fully editable — change/add/remove.
- **Customer** is NOT changeable on a partially-delivered order (invoices already reference it); only SE + date + line quantities.

## Implementation

### API (`apps/api/src/services/orders.ts` — `updateOrder`)
Compute the order's stage from invoice/delivery aggregates, then:
- `ordered` → existing **full replace** (delete all order_items, reinsert).
- `invoiced` / `delivered` → **409** (no edit).
- `partially_delivered` → **partial**:
  1. Load existing order_items + their allocated (invoiced) qty from `invoice_line_allocations`.
  2. Payload items carry an optional **`orderItemId`** — present for existing (locked) lines, absent for new lines.
  3. For each locked item: assert it's a real line of this order and `qty >= invoicedUnits`; **UPDATE** its `quantity_units` + `total_litres` in place (never delete — FK to allocations).
  4. **DELETE** only the un-allocated existing order_items (`id <> all(allocatedIds)`) — must run **before** the fresh inserts.
  5. **INSERT** the fresh (no-orderItemId) lines via `prepareOrderItems`.
  6. Update header (SE + date only, **not** customer).
  7. Recompute `orders.total_litres` from the resulting rows (last statement).
- Route (`PATCH /orders/:id`): add **ACCOUNTANT**; parse `orderItemId` per item.
- `OrderItemInput` gains optional `orderItemId`.

### Web
- `EditableOrder.items` gains `orderItemId` + `invoicedUnits` (from `getOrderById`'s `skuProgress`, keyed by `orderItemId`).
- Edit dialog (partial mode, i.e. order has any invoiced line):
  - **Locked-lines editor**: each invoiced line shows `{label} · {invoicedUnits} billed` + a total-qty input (min = invoicedUnits). Sends `{orderItemId, quantityUnits, …}`.
  - **Editable grid**: seeded only with fully-un-invoiced lines; add/remove/edit freely. Sends items with no orderItemId.
  - Customer field read-only.
- Menu: turn Edit on for `partially_delivered` (SA/Manager/Accountant).

## Verification

**Verified (live):**
- Menu per stage — Delivered = no ⋮, Invoiced = Cancel only, Ordered = Upload/Edit/Cancel.
- Full-edit (Ordered) round-trips cleanly (real no-op re-save).
- Partially-delivered path via a **client-side injected** partial row (no backend mutation):
  menu = Cancel + Upload + Edit ✅; dialog shows the locked-lines editor with `min` = billed
  qty ✅; setting qty below billed is blocked client-side (no PATCH) ✅; a valid save sends
  the correct partial payload `{ orderItemId, quantityUnits }` ✅ (PATCH was intercepted so
  no real order changed).

**Still needs a REAL partially-delivered order** to confirm the **API partial-update SQL**
executes correctly end-to-end (update-in-place of billed lines, delete-only-un-invoiced,
recomputed totals). The server also enforces the billed-qty floor (422), so data can't be
corrupted meanwhile. Repro to create one: take an Ordered order → upload an invoice for
PART of its SKUs → deliver that invoice (delivery run) → it becomes `partially_delivered`.
