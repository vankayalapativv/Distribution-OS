---
name: dashboard-customers-map-dynamic-districts
description: "Dashboard Customers Map: district overlay is DATA-DRIVEN across all Telangana districts; opens whole-state centered; teardown console errors fixed. In main + deployed 2026-10-09."
metadata:
  node_type: memory
  type: project
---

The web Dashboard "Customers Map" (SUPER_ADMIN + MANAGER, `apps/web/src/features/dashboard/map/`) was reworked and is **in `main` + deployed + verified on the live app (2026-10-09)**. Commit `36f4d46` *"feat(districts): refactor district handling to support dynamic loading from vardhan-maps"* (fast-forwarded into main; the `feat/dashboard-map-dynamic-districts` branch was merged and deleted local+remote). **Web-only change — no `apps/api` files touched.**

Originally built + verified in the Sree Balaji fork, then ported verbatim here (the two repos' map code was byte-identical; `vardhan-maps@0.19.0` in both).

**What changed (vs the old hardcoded-4-district map):**
- **Dynamic all-Telangana districts.** New `use-telangana-districts.ts` hook loads ALL Telangana districts from `vardhan-maps` — `import { loadDistricts } from "vardhan-maps/data"` → `loadDistricts("Telangana")` (33 districts, GeoJSON, `properties.name`; lazy/code-split, cached once via react-query staleTime/gcTime Infinity). Replaces the static `telangana-districts.ts` 4-district set FOR THE DASHBOARD MAP. Point-in-polygon each pin to its district; draw border + blue heat + count badge **only for districts with ≥1 customer**; **drop pins outside every district**. `districtOf`/`districtAnchors`/`groupByDistrict`/`isClickOutsideDistrict` now take the district features as a parameter (pure; anchors cached via WeakMap).
- **Tracking is UNCHANGED** — `use-tracking-overlays.ts` still passes the static 4-district `TELANGANA_DISTRICTS.features`; that file is KEPT, now used only by tracking.
- **Whole Telangana state centered on load** (not fit-to-pins). New `telanganaBounds()` in `create-region-map.ts` (= `L.geoJSON(TELANGANA_BOUNDARY).getBounds()`); the map opens framed to the whole state. The **Fit** button still frames the pins; **clicking a district** zooms in; **clicking outside** a selected district returns to the whole-state view (not pins-fit).
- **Teardown console errors FIXED** (they fired on StrictMode double-mount / client-side nav back to the dashboard):
  - `Cannot read properties of null (reading 'getZoom')` — `@maplibre/maplibre-gl-leaflet` v0.1.4 `_transitionEnd` schedules a `requestAnimFrame` whose body reads `this._map.getZoom()` NEXT frame; the map is removed in between. `lib/maplibre-leaflet-guard.ts` now REPLACES `_transitionEnd` with a faithful reimplementation that liveness-checks `_map`/`_glMap` INSIDE the rAF (wrapping the method alone was useless).
  - `onReadyRef.current is not a function` — the basemap `idle`→`onReady` callback could fire after unmount; `use-osm-map-init.ts` guards it with a `typeof cb === "function"` check.
  - **Blank basemap on remount** — the whole-state-framing change created the Leaflet map view-less (fitBounds only), leaving the MapLibre GL canvas stale on remount; `create-region-map.ts` now gives it an explicit initial view (`center: bounds.getCenter(), zoom: REGION_MIN_ZOOM`) before `fitBounds`.

**Verified:** tsc 0, eslint 0, 133 map/guard/tracking tests; browser on localhost + on the deployed app (whole-state centered, dynamic district overlays with real names e.g. Bhadradri Kothagudem/Khammam, clean console). Note: an unrelated `401` resource error on the dashboard is pre-existing, untouched.

Related: [[project-reclient-scope]] (the lineage trimmed the web map to 4 Hyderabad districts; this undoes that trim for the dashboard map specifically — tracking still uses the 4).
