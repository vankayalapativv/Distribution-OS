# Pending: Photo Stamping (address + date/time on every SE/Logistics photo)

**Status:** Specced & approved 2026-07-25, deferred (build later). Do NOT re-ask the
decisions below — they are settled. Build from this doc.

## Goal

Burn **address + date + time** (plus a few extra fields) onto **every photo** captured
by SALES_EXECUTIVE and LOGISTICS users, like the "GPS Map Camera" apps. The stamp must
be baked into the image pixels so it survives sharing (e.g. WhatsApp) and is tamper-evident.

## Current state (what exists today)

All photos are captured with `expo-image-picker` and uploaded to Cloudflare R2 with **no
location or time attached**. The app already uses `expo-location` for day-tracking, so GPS
at capture is available. Three photo surfaces, all in scope:

| Surface | Capture point(s) | Upload fn (`apps/mobile/src/lib/photos.ts`) | API |
|---------|------------------|---------------------------------------------|-----|
| Customer shop/shelf photos (customer + market_intelligence) | `app/customer/new.tsx`, `app/customer/[id].tsx`, `app/customer/edit.tsx` | `uploadCustomerPhoto` | `POST /customers/:id/photos` |
| Collection receipt photos | `app/collection/new.tsx` | `uploadCollectionProof` (persisted via `persistProofPhoto`) | `POST /collections/:id/proof` |
| Delivery + odometer photos (Logistics) | `app/(logistics)/add-delivery.tsx`, `app/(logistics)/delivery.tsx` | `uploadDeliveryPhoto` (persisted via `persistDeliveryPhoto`) | `POST /deliveries/runs/:id/photos` |

Photo capture helpers today: `pickFromCamera()` / `pickFromGallery()` in `photos.ts`
(both return `PickedPhoto[] = {uri,name,type}`, quality 0.7).

## Approved decisions (from the 2026-07-25 discussion)

1. **Stamp style:** BURNED into the image pixels (visible watermark). Not metadata-only.
2. **Offline behavior:** street address when online; if offline/timeout at capture, stamp
   raw **GPS lat/long** instead (never block the SE). App is offline-first.
3. **Which captures:** BOTH camera shots AND gallery-picked images. (Gallery images get the
   *current* time & location at pick time — accepted trade-off; see EXIF refinement below.)
4. **Scope:** ALL THREE surfaces above (customer, receipts, delivery/odometer).
5. **Stamp fields (all selected):** address + date/time (always) PLUS **SE/driver name**,
   **GPS coordinates**, **customer/shop name** (where known), and a **"Sri Aparajita Automobile"** label.
6. **Placement/look:** semi-transparent dark **bottom band**, white multi-line text
   (address wraps, then coords, then date·time·name, then customer).
7. **Geocoding provider:** **Google Geocoding API** (reuse the existing Google Maps key),
   NOT the device's built-in geocoder (unreliable on Android — no Google fallback anymore).

### Stamp layout (bottom band)
```
📍 Sri Aparajita Automobile
12-3-45 Main Rd, Kukatpally, Hyderabad, Telangana 500072   (omit line if offline)
17.42390, 78.47380
25 Jul 2026 · 3:52 PM · Murali
Customer: Ravi Auto Works                                   (customer photos only)
```

## Technical approach (per photo, camera or gallery)

1. Capture via existing `pickFromCamera`/`pickFromGallery`.
2. Get GPS via `expo-location` (already permissioned for tracking).
3. **Resolve address** by calling a NEW authenticated Workers endpoint
   `POST /geocode/reverse` `{lat,lng}` that proxies **Google Geocoding** server-side.
   - **Key stays in Workers secrets** (`GOOGLE_GEOCODING_API_KEY`) — do NOT embed the
     Google key in the APK (it would leak). Device → our API → Google.
   - Short timeout (~3s). Online → `formatted_address`. Offline/timeout/error → null →
     stamp coords only (skip address line).
4. **Burn** the band with **`react-native-view-shot`** (`captureRef` on an off-screen
   composer view = `<Image>` + overlay `<View>`), producing a new JPEG (`result: 'tmpfile'`,
   quality ~0.8, natural size). Well-documented approach for this exact task.
   - If off-screen `view-shot` proves flaky, fall back to **`@shopify/react-native-skia`**
     `makeImageSnapshot` (more robust for pure off-screen compositing, heavier dep).
5. **Upload** the stamped file through the existing persist → offline-sync → R2 pipeline.
   No change to the upload endpoints themselves.

## Implementation surfaces / touch points

- **New native dependency**: `react-native-view-shot` (or Skia). ⇒ **new dev-client + APK
  required** — cannot ship over-the-air. Add its Expo config plugin; rebuild.
- **New shared util** `stampPhoto(photo, ctx)` (new `apps/mobile/src/lib/photo-stamp.tsx`
  — `.tsx` because it renders a composer view). `ctx` carries `{ userName, customerName? }`;
  it fetches GPS + geocode + burns. Wire it into all 3 surfaces right after pick, before persist/upload.
- **New Workers route** `apps/api/src/routes/geocode.ts` → `POST /geocode/reverse`, auth
  `["SALES_EXECUTIVE","LOGISTICS"]` (plus office roles harmless). Register in `src/index.ts`.
  Add `GOOGLE_GEOCODING_API_KEY` via `wrangler secret put` + `apps/api/src/types.ts` binding.
- SE/driver name from `useAuth` user; customer name passed at customer-photo call sites.

## Defaults (proposed, confirm at build time if desired)

- **New photos only** — existing photos have no GPS; not retroactive.
- **Date format:** `25 Jul 2026 · 3:52 PM` (IST).
- **Gallery images:** stamp current time+location. Optional refinement: read the image's
  original EXIF `DateTimeOriginal` for a more accurate date on gallery picks (location still
  can't be trusted for gallery → current location).
- **Reverse-geocode timeout ~3s**, coords fallback.

## Trade-offs / risks

- Geocode adds a brief network call at capture (mitigated by timeout + coords fallback).
- Off-screen burning of large images uses memory — capture at natural size, quality ~0.8.
- Gallery-picked images may carry a misleading "current location" (accepted by user).
- Small Google Geocoding cost per online photo (fractions of a cent).

## Sources (research 2026-07-25)

- react-native-view-shot / captureRef — https://docs.expo.dev/versions/latest/sdk/captureRef/
- Date-stamp overlay walkthrough — https://kyleclutter.medium.com/react-native-adding-overlay-date-stamp-to-photo-7c7299327004
- Expo Location (reverseGeocode no longer falls back to Google on Android) — https://docs.expo.dev/versions/latest/sdk/location/
- Expo Skia — https://docs.expo.dev/versions/latest/sdk/skia/

---

## Build-time findings & open questions (added 2026-07-27, pre-execution)

Re-grounded the spec against the current codebase + library docs before building. Nothing
below overrides the 2026-07-25 approved decisions — these are the remaining forks + a
refinement of the offline behavior. **Awaiting answers + an explicit "execute" command.**

### Stack / library findings
- Current stack: **Expo SDK 57, React Native 0.86 (New Architecture ON).** Neither
  `react-native-view-shot` nor Skia is installed today; either way a **new dev-client + APK**
  is required (native dep — no OTA).
- `react-native-view-shot` supports the New Architecture only from **v5.0.1+** (tested to
  RN 0.84; off-screen capture needs the composer view mounted with `collapsable={false}`).
  `@shopify/react-native-skia` draws to a true off-screen surface (no mounted view) — most
  robust, but a heavier native dep (bigger APK).
- **Google key caveat:** the only Google key in the repo is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
  a **browser (referrer-restricted) key** that Google will **reject for server-side Geocoding**
  from Workers. A **dedicated server Geocoding key** (no referrer restriction) is strongly
  recommended, set via `wrangler secret put GOOGLE_GEOCODING_API_KEY`. The API has no Google
  binding yet.

### Offline behavior — refined (layered, not all-or-nothing)
GPS (satellite) works with **no internet**; only the *street address* (reverse-geocode) needs
internet. Photo upload is already offline-first, so **being offline never blocks capture.**

| Situation | Location line stamped |
|-----------|-----------------------|
| Online + GPS fix | full street address **+** coordinates |
| Offline + GPS fix | coordinates only (address omitted) — *settled 2026-07-25* |
| No GPS fix at all (indoors / GPS off / denied / timeout) | **OPEN** — see decision 5 |

### Open decisions (confirm before building)
1. **Stamp engine:** `react-native-view-shot` (lighter APK, spec primary) vs **Skia** (robust
   off-screen, heavier).
2. **Google key:** new dedicated server Geocoding key (recommended) vs reuse existing browser key.
3. **Stamp-failure fallback:** upload the original unstamped photo (never block) vs block & retake.
4. **Gallery-pick date:** current pick-time (baseline) vs read EXIF `DateTimeOriginal`.
5. **No-GPS-at-all case:** (a) omit the location line, (b) stamp "Location unavailable"
   *(recommended — keeps photo flowing + flags the gap for audit)*, or (c) block until a fix.
6. **Address back-fill:** when a coords-only (offline) photo later syncs online, also record the
   resolved street address in a DB field (burned pixels stay coords-only) — yes/no.

### Client-facing question (offline)
> When a field rep takes a photo with **no internet**, we can still stamp GPS coordinates +
> date/time/name (address needs internet, so it's omitted). In the rarer case where **the phone
> can't get a GPS location at all** (indoors / GPS off / weak signal), should the photo
> (a) stamp everything except location, (b) stamp "Location unavailable", or (c) be blocked
> until a location is found? Also: should we record the street address later (once back online)
> in our records, even though the photo itself will show only coordinates?

### Implementation plan (on command)
- **Phase 0:** add stamp lib + Expo config plugin; add `GOOGLE_GEOCODING_API_KEY` binding
  (`apps/api/src/types.ts`) + secret.
- **Phase 1:** `apps/api/src/routes/geocode.ts` → `POST /geocode/reverse {lat,lng}`, SE/LOGISTICS
  auth, ~3s timeout, coords-only fallback; register in `src/index.ts`.
- **Phase 2:** `apps/mobile/src/lib/photo-stamp.tsx` → `stampPhoto(photo, {userName, customerName?})`
  (GPS → geocode → off-screen burn → JPEG), with the layered location fallback.
- **Phase 3:** wire `stampPhoto` into all 3 surfaces (customer new/detail/edit, collection new,
  logistics add-delivery/delivery) after pick, before persist/upload.
- **Phase 4:** typecheck + emulator test (camera & gallery, online & airplane mode); then deploy
  `apps/api` + EAS APK build.
