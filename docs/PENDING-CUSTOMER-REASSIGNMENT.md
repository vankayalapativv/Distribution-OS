# Customer Reassignment page (Super-Admin)

**Status:** BUILT 2026-08-25 (was specced 2026-07-31). Per-customer only. Uncommitted;
migration `0072` already applied to prod. See "Build status" at the bottom.

**Goal:** Let a SUPER_ADMIN reassign the complete ownership of a customer from one Sales
Executive to another, from a dedicated web page under **Configure**. **Per customer only —
there is no bulk operation** (decision revised 2026-08-25; see below).

Ownership in this system = `customers.created_by` (a SE sees only the customers they
created; dues/invoice notifications route to that owner). It was done manually via a DB
update once on 2026-07-31 (see "Reference" below) before this page existed.

---

## Confirmed decisions (from the user)

| Decision | Choice |
|----------|--------|
| **Scope of what moves** | **Full history** — ownership + all business records move to the new SE, as if they always handled it |
| **Granularity** | **Per customer ONLY** — no bulk / no "move an executive's whole book" (revised 2026-08-25, was "both") |
| **Access** | **SUPER_ADMIN only** |
| **Beat template** | **Moves too** — `beat_customer_days.executive_id` follows ownership, and any still-pending stop on the old owner's *today* plan is removed so the 7 PM cron can't flag it 'missed' (decided 2026-08-25) |
| **Notes authorship** | **Moves too** — `customer_notes.created_by` + `edited_by` are rewritten to the new SE (decided 2026-08-25) |
| **Audit trail** | **Yes** — a dedicated `customer_reassignments` table (migration `0072`), NOT the old `customer_assignments` table |
| **Preview** | **Full impact preview** before applying (current owner + counts of records that will move + the note that target/KPI/dues numbers shift) |
| **Reversibility** | **One-click "undo last"**, reversing ONLY the exact rows this reassignment moved; available **until superseded** (only the latest not-yet-undone reassignment for a customer can be undone), no time limit (decided 2026-08-25) |
| **SE notifications** | **None** — reassignment is silent; each SE's app reflects the change on next sync (decided 2026-08-25) |

---

## What "full history" moves

Move every record for the customer **currently attributed to the customer's current owner**
(the old `created_by`) over to the new executive. If a record happens to be attributed to a
*third* executive (not the current owner), leave it — only the current owner's records move.

| Table | Column(s) to move |
|-------|-------------------|
| `customers` | `created_by` |
| `orders` | `sales_executive_id`, `created_by` |
| `collections` | `collected_by_user_id`, `created_by` |
| `invoices` | `sales_executive_id`, `created_by` |
| `visits` | `executive_id` |
| `customer_photos` | `uploaded_by` |
| `customer_notes` | `created_by`, `edited_by` |
| `beat_customer_days` | `executive_id` (the weekly beat template) |

Also: delete any still-`pending` stop for this customer on the **old owner's `plan_date =
current_date`** beat plan (so tonight's 7 PM cron can't mark it 'missed'). The new owner's
plan re-materializes the stop on next `/beats/today`.

**Deliberately NOT moved (kept factual):**
- `tracking_customer_dwell_events` / GPS points — real records of who was physically at the
  customer; rewriting them would falsify location history.
- Logistics delivery runs (`delivery_runs` / `delivery_run_stops` / `delivery_photos`) —
  logistics, not SE-owned.

**Retroactive effect (surfaced in the UI, not hidden):** moving orders/invoices/collections
retroactively shifts **target actuals, the KPI leaderboard, and dues attribution** from the
old SE to the new one. Actuals are computed at query time from these tables, so no separate
recompute is needed — moving the rows is enough. Dues follow `created_by`.

### Same-row / two-column collision (critical implementation note)

Several tables move **two** columns that can point at the same row (`orders`:
`sales_executive_id` + `created_by`; `collections`; `invoices`; `customer_notes`). Postgres
will only apply **one** update if two data-modifying CTEs touch the same row in one
statement — the other silently no-ops. So the apply/undo statements must:
1. pre-select the id sets per (table, column) on the pre-update snapshot,
2. update each table **once**, moving each column via a `CASE` keyed on those id sets,
3. build the `moved` payload from the pre-selected sets.

This was caught during the rollback proof (first draft used one CTE per column and left
`orders.created_by` / `customer_notes.edited_by` behind). Both `reassign_customer_apply` and
`reassign_undo_apply` in `services/customer-reassign.ts` use the combined-update form.

The whole apply and the whole undo are each **one atomic statement** (a single CTE), so the
multi-table move is all-or-nothing without needing an interactive transaction.

---

## Audit + undo — `customer_reassignments` (migration `0072`)

The old `customer_assignments` table is an assignment-history table (`start_date`/`end_date`/
`is_active`, read by `executive-day.ts`) — **wrong shape** for ID-scoped undo, and left
untouched. Instead, migration `0072` adds:

```
customer_reassignments (
  id, customer_id, from_user_id, to_user_id, assigned_by,
  moved jsonb,          -- table_column -> [exact row ids] (weekdays for the beat) this move changed
  moved_counts jsonb,   -- table -> count, for the preview/history UI
  created_at, undone_at, undone_by
)
```

`moved` is what makes undo **precise**: undo reverses only those ids (and only where the
column still holds the new owner), so anything the new SE did *after* the move stays with
the new SE. **Undo targets the latest `undone_at is null` row for the customer** ("until
superseded"); once a newer reassignment exists, the older one is no longer the undo target.

---

## API (SUPER_ADMIN only) — implemented

In `apps/api/src/routes/customers.ts` (+ `services/customer-reassign.ts`):

- `GET  /customers/:id/reassign/preview` — customer header, current owner, counts of what
  will move, `undoable` (the reversible reassignment or null), full `history`, and the active
  `salesExecutives` list for the target dropdown.
- `POST /customers/:id/reassign` — body `{ toUserId }`. Moves one customer + its history in
  one atomic statement, writes the audit row, logs `customer.reassign`. Returns the history
  entry (with `counts`).
- `POST /customers/:id/reassign/undo` — reverses the latest not-yet-undone reassignment for
  the customer; logs `customer.reassign.undo`. 409 if there's nothing to undo.

**Guardrails:** target must be an active `SALES_EXECUTIVE` (422); can't reassign to the
current owner (422); customer must currently have an owner (422 otherwise); UI confirm step.
**No bulk endpoint.**

---

## Web page — `/reassign`

- Server page `app/(dashboard)/reassign/page.tsx`: `requireSessionRole()` → redirect if not
  SUPER_ADMIN; fetches the customer picker list; passes `actionConfig`.
- Client feature `features/reassign/*` (`reassign-api.ts`, `reassign-view.tsx`) using the
  shared kit (`DashboardShell`, `PageHeader`, `SearchSelect`, `apiRequest`/`apiGet`).
- **Single flow (no tabs):** searchable customer picker → read-only impact preview (current
  owner + a flat count list + retroactive-effect note) → "Reassign to" executive picker →
  inline confirm → apply. Below it, the reassignment **history** with an **Undo** button on
  the one reversible entry.

**Nav:** `reassign` `NavKey` + item under **Configure** in `dashboard-nav.tsx`, SUPER_ADMIN
section only. Label "Reassign Customers", icon `ArrowRightLeft`.

---

## Build status (2026-08-25)

- **Migration `0072_customer_reassignments.sql`** — written and **applied to prod**.
- **API** — `services/customer-reassign.ts` + 3 routes in `routes/customers.ts`; `tsc` clean.
- **Web** — `features/reassign/*` + `app/(dashboard)/reassign/page.tsx` + nav item; `tsc` +
  `eslint` clean.
- **Verified:** apply + undo proven in a rolled-back SQL transaction (both order columns and
  both note columns move; undo restores exactly the moved rows while post-move activity stays
  with the new owner). The read-only path verified live in the browser (preview loads real
  data: e.g. City Motors CUST-0327, owner Srikanth, 4 records to move). The live apply+undo
  path was NOT exercised on prod data pending the user's go-ahead.
- **Not yet:** committed / deployed (api + web).

---

## Reference — the manual reassignment already done (2026-07-31)

CUST-0006 "RK Automobiles" was reassigned from **Upendar** (`upendar@beyondautomobiles.com`,
`32852879-d8c2-4933-9a15-758e23f299af`) → **Murali** (`murali@beyondautomobiles.com`,
`23f897aa-33d3-413e-9b52-4409f66ba953`). That customer had no orders/collections/invoices;
moved `customers.created_by`, `visits.executive_id` (1), `customer_photos.uploaded_by` (1).
The 27 Jul GPS dwell event was intentionally left as Upendar's (factual). This is the exact
behavior the page now automates.

DB access for reference: root `.env` `DATABASE_URL` (Neon, `neondb_owner`); the API connects
via `@neondatabase/serverless`.
