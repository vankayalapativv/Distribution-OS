---
name: mobile-tracking-map-overlays
description: "Mobile admin live-tracking map got web-parity customer + check-in overlays; KEY gotcha — vardhan-maps 0.15.0 (mobile) does NOT paint marker icon divIcons, so check-ins are circles not flags (web runs 0.19.0)"
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-08T20:29:22.692Z
---

Shipped 2026-11-09 (committed `d32d2a2`, pushed to `main`). Brought the web Live Tracking map's extra layers to the Super Admin MOBILE tracking map (`(admin)/tracking.tsx`, MapLibre via `vardhan-maps/react-native`). Scope the user chose: customer markers + check-in markers only (NO device-health, NO district borders).

- **Customer markers**: every customer with geo, coloured by dues ageing bucket (same palette as the dashboard/web: emerald 0-30, yellow 30-45, orange 45-60, rose 61+, slate = no dues). Tap → a NATIVE RN card (`tracking-map-cards.tsx`) with the same detail as the web popup (name, "city · salesperson", "₹ due · bucket" / "No dues", last-order/collection chips); tapping the name opens that customer's screen. Data from `GET /dashboard/map`.
- **Check-in markers**: the SELECTED rep's visits for the date, green (planned) / orange (unplanned); tap → visit card (customer, time, orders in litres, collections in ₹). Data from `GET /tracking/checkins?userId=&date=`. Both `/dashboard/map` and `/tracking/checkins` are SUPER_ADMIN/MANAGER/ACCOUNTANT accessible.
- **Route restyled to web**: receding slate-400 line (`#94a3b8`) + slate-600 ping beads (`#475569`); rep markers green(live)/grey(stale), NO blue "selected" dot. (Was blue line + red dots + blue selected markers.)

⚠️ **KEY GOTCHA — map library version.** The field APK runs `vardhan-maps@0.15.0`; the WEB runs `0.19.0`. 0.15.0's `MapRoute` has no bead-border fields (`pointFillColor`/`pointBorderColor`/`pointBorderWeight` — 0.19.0 only), and **0.15.0 does NOT paint marker `icon` divIcons** — a marker with `icon` silently falls back to the default blue circle. So the web's green/orange **flag glyph** for check-ins can't render on mobile → we use colour-matched **circles** instead (green/orange). Painting real flags (or exact white-ring beads) needs upgrading to 0.19.0, BUT `vardhan-maps/react-native` sits on the NATIVE `@maplibre/maplibre-react-native` peer, so that upgrade is a native change → requires a fresh APK build, NOT OTA-able. User chose to keep circles for now. `IndiaMapNative` tap = `onMarkerClick(marker)`; markers matched back to data by exact coords (`${lat},${lng}`); check-in coords equal the customer's coords, so the tap dispatch checks check-ins FIRST. Related: [[mobile-error-offline-ux]], [[expo-ota-updates]], [[dashboard-customers-map-dynamic-districts]].
