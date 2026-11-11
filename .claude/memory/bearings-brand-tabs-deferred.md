---
name: bearings-brand-tabs-deferred
description: Client is purely oils; app-wide bearing removal + mobile order brand tabs are planned but DEFERRED
metadata:
  node_type: memory
  type: project
  originSessionId: 0b4435cc-5363-4ff4-b2d0-7af21abc73b5
  modified: 2026-10-04T18:28:34.189Z
---

This client (Sri Aparajita) sells **purely oils** — no bearings, no filters. Two related features were scoped on 2026-10-04 and **deferred by the user** (started then reverted; tree kept clean). Full plan: [docs/BEARING-REMOVAL-PLAN.md](docs/BEARING-REMOVAL-PLAN.md).

1. **App-wide bearing removal** (mobile + web). Recommended depth = **UI-only, keep schema** (depth NOT yet confirmed by user). Landmines: `se_targets.target_bearing_value` (migration 0041) was silently repurposed to mean "value of ALL non-oil products" (labeled *"Other products"* on mobile home), so don't just "delete the bearing target"; invoice parsing keys bearings off **HSN 8482** (keep tolerant); historical orders reference `order_items.bearing_id` + `bearings` table — leave read paths intact.

2. **Mobile Orders brand switch — DONE 2026-10-09** (not as tab-replacement). Instead of replacing the Oils/Bearings tabs, a **Fuchs/Savsol brand segmented control** was added inside the oils tab (segment pills kept as a sub-filter within the selected brand). `/orders/products` now sends `brand`. Full details in [[savsol-dual-brand-and-segments]]. (The larger "dynamic tabs replacing Oils/Bearings" idea is moot now that there's a brand switch.)

**Why:** both are large multi-surface changes the user wants done deliberately, one at a time, with sign-off — not inferred.

**How to apply:** when picked up, confirm removal depth first, then follow the file-by-file map in the doc. Keep the deferred-plan doc in sync.
