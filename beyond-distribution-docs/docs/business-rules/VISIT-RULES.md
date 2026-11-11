# Visit Rules

Configurable visit rules include:

- GPS required for visit count
- minimum visit duration
- photo proof required
- owner met required for high-quality visit
- productive visit requires one of:
  - order taken
  - collection done
  - competitor/customer info captured
  - product push completed
- unplanned visits allowed but separately tracked
- low visit quality reduces executive score

## Decision (2026-07-09)

A visit checked in against a `beat_plan_stops` row is a **planned** visit; a visit without a beat-plan stop is **unplanned**. Both are allowed and tracked separately. The API's two visit flows — `/visits` (beat-stop-based) and `/executive-day` (assignment-based) — should converge on this single model.
