# Pending: Expenditure analytics — more charts + period comparison

Specced and agreed 2026-07-24, **deferred** to work on something else first.
Every decision below was made by the user; do not re-litigate them, just build.
Only the "Open questions" section (empty today) needs asking before starting.

## Layout

```
Expenditure                 [1 Jul – 31 Jul ▾]  [+ Category]  [+ Record Expenditure]
──────────────────────────────────────────────────────────────────────────────────
Total spend      Compulsory       Variable         Categories used
₹1,93,120        ₹1,64,870        ₹28,250          15
↑ 12% vs prev    ↑ 4% vs prev     ↓ 8% vs prev     +2 vs prev
──────────────────────────────────────────────────────────────────────────────────
[ Donut: by category ]          [ Category comparison: this vs prev ]
[ Monthly stacked bars, 12mo ]  [ Spend per person: this vs prev ]
──────────────────────────────────────────────────────────────────────────────────
[type ▾] [category ▾] [search]     ← filter bar keeps only these
[ table ]
```

## Decisions (all user-confirmed)

**Period picker**
- Moves OUT of the filter bar to the **top, left of `+ Category`**. One period
  control for the whole page — no duplicate date controls.
- shadcn date-range picker **with quick presets**: This month, Last month,
  Last 3 months, Last 6 months, This year, plus Custom.

**Comparison basis**
- **Automatic: the immediately preceding equal span.** Pick 1–31 Jul → compares
  to 1–30 Jun. Pick a 90-day range → compares to the prior 90 days. Works for
  any custom range; no separate baseline dropdown.

**Where deltas show**
- ↑/↓ % badge on **each of the four summary cards**, AND comparison charts.
- Zero baseline (previous period had ₹0) renders **"new"**, never `↑∞%`.

**Charts** (2-up grid)
1. **Donut — by category** (already built; top 10 + "Other", blue=compulsory,
   grey=variable).
2. **Monthly stacked bars, rolling 12 months** — compulsory (blue) stacked on
   variable (grey). Stack height *is* total spend, so trend + split read from
   one chart. This **merges** what were originally two separate requested charts
   (a spend-trend line and a compulsory-vs-variable chart) — user chose to merge.
3. **Category comparison bars** — **top 8 categories by current-period spend**,
   each with a this-period vs previous-period bar pair.
4. **Spend per person** — **any entry with a `userId` person link** (not
   hard-scoped to fuel/food, so it stays correct if other spend is attributed to
   someone later). Shows **this vs previous period** bar pairs per person.

**Filtering**
- **Everything filters together.** The type / category / search filters drive
  all four charts, the summary cards AND the table, so the whole page always
  describes one consistent slice. (User explicitly chose this over keeping the
  12-month trend as a fixed unfiltered reference.)

## Technical plan

**One new endpoint** rather than four round trips:

```
GET /expenditures/analytics?from=&to=&type=&categoryId=&q=
```

Returns in a single payload:
- `current` — summary for the selected period (total, compulsory, variable,
  entries, per-category breakdown)
- `previous` — the same shape for the auto-derived preceding equal span
- `monthly` — rolling 12-month series, each month split compulsory/variable
- `people` — per-person totals for current AND previous period

Note it takes the **same filter params as the list**, because everything filters
together. All of it is indexed aggregate SQL over `expenditures` (already
indexed on `expenditure_date` and `category_id`).

## Gotchas carried forward

- **Every new chart needs `isAnimationActive={false}`.** Recharts 3.8 + React 19
  creates the sector/bar groups but never emits their `<path>` elements when the
  entry animation is on — the chart renders completely blank. This bit the donut
  already; see the comment in `expenditure-breakdown-chart.tsx`.
- Reuse the existing blue (compulsory) / slate-grey (variable) palette so the
  new charts stay consistent with the type pills and the donut.
- Recharts percentage radii (`innerRadius="55%"`) did NOT resolve in v3 — use
  numbers.

## Data caveat when building

At spec time the DB held only **3 real expenditure entries, all dated today**,
so the 12-month trend and every comparison render nearly empty. That is correct
behaviour, not a bug. To verify the charts, seed temporary demo rows spread
across past months, then **delete them afterwards** (the DB is a live field
trial — see the `project-field-trial` memory). Mark seeded rows distinctly (e.g.
`paid_to = 'Demo'`) so cleanup is exact and never touches real entries.

## Open questions

None — the spec is complete and ready to build.
