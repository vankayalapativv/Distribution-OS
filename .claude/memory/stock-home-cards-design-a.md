---
name: stock-home-cards-design-a
description: Stock-home three cards (Expiring soon / On hand / Recent activity) redesigned to Design A dense tables on one shared 6-col grid; home-only components leave the View-all drill-downs untouched; plus the expiry month-picker now current-month-onward
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-08T13:23:21.365Z
---

Stock home dashboard redesign, 2026-11-08 (committed `4df7fa3` + key-fix `50df974`; NOT deployed — local web hits prod API/data per [[local-dev-uses-live-prod]]).

## What changed (`apps/web/src/features/stock/stock-journal.tsx`)
The three **home** cards are now "Design A" — dense data-tables sharing **one 6-column grid** so columns line up vertically across all three cards: `const HOME_COLS` (`w-[28/13/15/18/13/13%]`) rendered via `<HomeColGroup>` + `table-fixed` in each table.
- **Home-only components** (do NOT touch the "View all" drill-downs): `ExpiringList` (rewritten to a table), new `HomeBalances`, new `HomeActivityTable`. The full-page drill-downs still use the ORIGINAL shared components — `BalancesTable`, `ActivityFeed`, `NearExpiryTable` — so "home cards only" stays true.
- `useActivity` now emits structured `detail` / `locationName` / `amount` fields, and **`secondary` is derived from them so it stays byte-identical** → the untouched `ActivityFeed` drill-down renders exactly as before.

## Locked design decisions (non-obvious, easy to revert by mistake)
- **Amber identity on Expiring soon ONLY**; On hand + Recent activity are neutral.
- **Number columns are CENTERED** (user chose "let's see"): Qty/Litres/Reorder, Days left/On hand, Value/Date. Revert target if disliked = right-aligned.
- **On hand home shows BRAND only — segment chip removed** (home card only; the "View all balances" drill-down still shows brand + segment).
- **Reorder pencil** is hover-only, positioned `absolute right-2 top-1/2 -translate-y-1/2` inside the (relative) Reorder `<td>` = row's right edge, vertically centered. It opens the existing reorder-level **input** dialog (`setReorderRow` → StockDialogs).
- **Days-left dot removed** entirely; the day text colour still signals urgency (red ≤7d/expired, amber ≤30d, muted beyond) via `expirySeverity().txt`.
- Headline figures kept bold (On hand qty/litres, expiry on-hand, activity value).

## Expiry month picker — current-month-onward (`apps/web/src/components/form/month-year-field.tsx`)
Past months disabled (greyed, non-clickable); the `‹` previous-year arrow disabled at the current year; opening never lands on a past year. Shared field → applies to BOTH stock-in and opening-stock expiry inputs.

## Gotcha
`HOME_COLS` repeats width classes (three `w-[13%]`) → **key `<col>` by index, not by the class string**, or React logs a duplicate-key warning on every render (was firing hundreds of times). Fixed in `50df974`.

Related: [[stock-entry-pages-redesign]], [[stock-phase2-batch-lots]], [[feedback-ask-with-options]].
