# Tracking capture reliability — continuous pings while moving

Status: **SPECCED, not built** (2026-08-15). No code yet.
Owner context: derived from 5 days of live ping + heartbeat telemetry (Aug 10–14) and a read of the native tracking code, cross-checked against the Android "always-on location" reference pack.

## Goal & fixed constraints

**Goal:** eliminate the in-ride **capture-stalls** — the case where a rep is riding between places with the phone locked/pocketed, the app is *healthy*, but no location point is recorded for 6+ minutes, so the route is drawn as a single straight-line jump (e.g. 5–6 km lost).

**Fixed (do NOT change — confirmed with the client):**
- 3-minute ping cadence.
- Always-on window: SE 9 AM–7 PM IST; Logistics for an active delivery run (no cutoff).
- **`BALANCED_POWER_ACCURACY`** — deliberately kept. Continuity > accuracy: GPS-only (`HIGH_ACCURACY`) returns *null* in a pocket/indoors and would create *more* gaps. Network/wifi fixes are coarse but *present*.
- Native-Kotlin-owned engine + RN only controls/observes (already true; the reference pack validates this).

**Non-goals:** higher accuracy; beating Doze while the rep is *stationary* (OS-capped for every app).

## Root cause (data + code)

From the telemetry, during the healthy in-ride gaps the device reported **location ON, background permission GRANTED, online, not low-power, `queued_point_count = 0`** — so it is *not* permission, GPS-off, battery-saver, offline, or an upload backlog. It is an **in-code capture/recording stall** in `apps/mobile/plugins/native-tracking/ForegroundLocationService.kt`:

1. The 3-min wake-alarm's one-shot `getCurrentLocation(BALANCED, …)` (line ~254) returns **null** when the fused provider isn't holding a fresh fix (common in background/movement).
2. It falls back to `lastLocation` (line ~259), which is often **stale**.
3. `recordLocation()`'s dedup — `if (location.time - lastKeptMs < MIN_PING_GAP_MS) return` (line ~314) — then **drops** that stale fix. The interval records **zero** points.
4. The continuous `LocationCallback` can't backfill fast: the `LocationRequest` sets `setMinUpdateIntervalMillis(2.5 min)` and **no `setMaxUpdateDelayMillis`** (no batching), so a missed real-time delivery isn't recovered from the chip buffer. Miss two windows → the 6-min hole seen in the data.

Magnitude (intra-day, working-hours, 5 days, 4 SEs): **34 moving-gaps → ~70% capture-stall (in-code, fixable), ~30% OEM full-kill** (`heartbeats=0`). A large share of the stalls is Sandeep's background-permission case, **already fixed** by the location guard + FCM nag.

## The fix — capture-stall (primary, ~70%)

All localized to `ForegroundLocationService.kt`; mirrors logic the JS path already has (`guardedRecordMs` / `MAX_FIX_AGE_MS` in `gps.ts`).

1. **Hardware batching — add `setMaxUpdateDelayMillis`** (ref #1 Fused/LocationRequest). Let the GPS/GNSS chip collect fixes at the interval even while the AP is briefly asleep/busy and deliver them in a burst. `onLocationResult` already iterates a batch (`result.locations.sortedBy{…}.forEach`, line ~191), so this is a natural, low-power fit. Suggested delay ≈ one interval (so points still land ≤ ~3–6 min late, never dropped).
2. **Overdue-fix recovery** (ref #1: "the requested interval is not an OS-guaranteed callback interval"). On the wake-alarm, if the window is overdue and `getCurrentLocation` returns null, issue a fresh, *bounded-timeout* one-shot rather than accepting-then-dropping a stale `lastLocation`.
3. **Don't let dedup starve a window.** Dedup must prevent *duplicates*, not prevent the *only* point of an interval. When overdue (> ~4 min since last kept), accept a recent-enough fix by re-stamping it to wall-clock time — mirroring the JS `guardedRecordMs` behavior the native side lacks. Better a slightly-recent point than a gap.
4. *(Optional)* **Tighter request interval** (e.g. 60 s) so the OS gets more delivery chances; the 2.5-min dedup still caps *stored* cadence at ~3 min. More attempts → less chance of a whole window with zero fixes.

## The fix — OEM process-kill (secondary, ~30%)

`heartbeats=0` gaps = the whole process (incl. the native FGS) killed by an aggressive OEM battery manager (moto/realme/vivo/xiaomi). This is the notorious `dontkillmyapp.com` problem — mitigable, never bulletproof.
- Already in place: `START_STICKY`, the wake-alarm `getForegroundService` PendingIntent (re-launches the FGS on each fire), a boot receiver, a 15-min WorkManager watchdog (Android's floor for periodic work), battery-optimization exemption + one-time autostart prompt.
- **Add:** make the OEM **autostart + "no battery restriction"** guidance *non-skippable* per aggressive vendor (today it's prompted once and skippable). Accept a residual tail on the worst devices.

## Prove it worked (before → after)

- Re-run the exact intra-day moving-gap analysis (gap > 6 min AND jump > 500 m, within working hours) 1–2 weeks post-ship. Target: **capture-stall gaps down ≥ 60%**, km-lost down.
- Track per-OEM gap rate and the alarm-vs-callback capture mix; confirm `queued_point_count` still ~0 (no new upload backlog introduced).

## Scope / risk / testing

- **Small, native-localized** changes (one Kotlin file) + reuse existing JS re-stamp logic. TDD the pure bits where possible; the capture path needs device testing.
- **Needs an APK + a real-device ride** to validate — the emulator can't reproduce Doze/movement or GNSS batching.
- **Battery:** roughly neutral — batching *reduces* power; a tighter interval adds a little; `BALANCED` is cheap either way.

## Explicitly NOT changing
Cadence, always-on window, `BALANCED` accuracy, and the overall native-service architecture — the reference pack validates the architecture; this is a targeted capture-reliability refinement, not a rewrite.

## Reference deep-dive — verified against official Android docs (2026-08-17)

Read all 8 items of the client's "Always-On Location" reference pack + the 3 sub-pages they defer to. Every requirement checks out against our code; findings that change the plan:

- **Architecture = the reference architecture, 1:1.** RN UI → `NativeTrackingModule` (@ReactMethod) → `ForegroundLocationService` (`foregroundServiceType=location`) → `FusedLocationProviderClient` (`LocationCallback`) → SQLite `gps_pings` → native self-upload → Hono → Neon. We already honor "don't treat RN JS as source of truth." **No rewrite warranted.**
- **Interval-not-guaranteed is official.** request-updates + change-location-settings both state updates "may be somewhat faster or slower… or there may be no updates at all." Our capture-stalls are exactly this documented behavior → batching + overdue recovery is the doc-sanctioned mitigation, not a workaround.
- **`location` FGS has NO OS timeout** on Android 14/15 (only `dataSync`/`mediaProcessing`, 6h/24h). Our always-on service is never OS-timed-out. ✅
- **Background-restart-after-kill is LEGAL — point #3 resolved (was an open risk).** The FGS background-start exemptions cover us three ways: (5) *exact alarm to complete a user-requested action* = our `setExactAndAllowWhileIdle` poll; (13) *user turned off battery optimizations* = enforced at Start Day (also covers the **inexact-alarm fallback** at `ForegroundLocationService.kt:224`); (8) `ACTION_BOOT_COMPLETED`. A non-exempt attempt would throw `ForegroundServiceStartNotAllowedException`, which we won't hit. ⟹ the ~30% full-kill gaps are **pure OEM force-stop/alarm-cancellation** (dontkillmyapp), NOT an Android-rules bug — confirming the secondary fix is autostart/whitelist guidance only, with a residual tail.
- **Lead fix is now `setMaxUpdateDelayMillis` (batching).** `onLocationResult` already iterates a batch (`:191`); adding a max-update-delay lets the GNSS chip buffer fixes across an AP-sleep window and burst-deliver them — recovering the exact fixes the current window loses — at *lower* power. Elevated to the #1 change.

Confirmed current gaps in code (unchanged from above): `LocationRequest` at `:185` sets priority + `setMinUpdateIntervalMillis` + `setWaitForAccurateLocation(false)` but **no `setMaxUpdateDelayMillis`**; the stale-`lastLocation` (`:259`) → dedup-drop (`:314`) chain still starves a window; native side lacks the JS `guardedRecordMs` wall-clock re-stamp.
