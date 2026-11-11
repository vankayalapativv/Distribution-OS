# Background Tracking — Field Device Test Checklist

Validation plan for the native background-location tracking that ships in **APK versionCode 5** (commit `95becab`, EAS `preview` profile, pointed at production `https://api.vardhansystems.workers.dev/api/v1`).

Static code and unit tests already pass (285/285 API tests). **Everything in this document can only be proven on a real phone** — emulators do not reproduce OEM battery-killing, Doze, or real GPS drift.

## What the system actually does (the numbers to test against)

These are the thresholds baked into the shipped code. Test against *these*, not against assumptions.

| Behaviour | Value | Source |
|---|---|---|
| GPS ping interval | every **3 min** (`PING_INTERVAL_MS = 180_000`) | `ForegroundLocationService.kt:240` |
| Minimum gap between kept pings | **2.5 min** (`MIN_PING_GAP_MS = 150_000`) | `ForegroundLocationService.kt:241` |
| Location priority | `BALANCED_POWER_ACCURACY` (not high-accuracy) | `ForegroundLocationService.kt:123` |
| Dashboard shows **"Fresh/Live"** | last ping **< 12 min** old | web tracking view |
| Server raises **interruption alert** | no heartbeat/point for **> 15 min** | `tracking-maintenance.ts:33` |
| Interruption cron cadence | every **3 min** (`*/3 * * * *`) | `wrangler.jsonc` |
| Server auto-closes the day | at **21:00 IST** (`server_9pm_closure`) | `tracking-maintenance.ts:43` |
| Points dropped from distance | accuracy **> 75 m**, jump **< 20 m**, speed **> 140 km/h** | `tracking-distance.ts` |
| Customer dwell detected | within **100 m**, **≥ 6 min**, **≥ 3 points** | `tracking-dwell.ts` |
| Heartbeat cadence (health) | every ~3 min | `tracking-heartbeat.ts` |

**Known limits — do NOT file these as bugs (they are Android platform limits, by design):**
- Force Stop (Settings → App → Force Stop, or swipe-kill on some OEMs) **stops tracking** and it does **not** restart until the app is reopened.
- Full power-off / reboot stops it; it only resumes after Start Day is reopened (boot receiver only re-arms an already-active session — it does not silently restart tracking without the app).
- Revoking location permission or turning GPS off stops points. The server will (correctly) flag this as "communication interrupted," **not** as "force stop detected."
- Battery percentage is currently **not captured** on the native path (`battery_percentage` inserted as `null`) — the dashboard battery column will be blank for native pings. Not a failure; note it.

---

## Pre-flight (once, before any scenario)

- [ ] Uninstall any older build first (avoids keystore/signature and stale-DB confusion).
- [ ] Install **versionCode 5** APK. Confirm in Settings → Apps → Sri Aparajita → App details that versionCode = 5.
- [ ] Log in as a real **SALES_EXECUTIVE** test account.
- [ ] On first Start Day, grant location **"Allow all the time"** (background), not just "While using". Grant notifications.
- [ ] Have a web dashboard open on `/dashboard/tracking` (SUPER_ADMIN or MANAGER) to watch the same SE live.
- [ ] Note the device model + Android version + OEM skin at the top of each result sheet.

---

## Scenario 1 — Baseline: screen on, app foregrounded (sanity, ~15 min)

Purpose: prove the happy path before stressing it.

1. [ ] Tap **Start Day**. Confirm the persistent notification appears: *"Sri Aparajita day tracking on / Your route is recorded until you end your day."*
2. [ ] Walk/drive so location actually changes.
3. [ ] After ~10 min, confirm on the dashboard: SE shows **Fresh/Live**, point count increasing (~1 every 3 min), map trail drawing.
4. [ ] Confirm points reached Neon (dashboard "last seen" timestamp within 3–4 min of now).

**Pass:** points arrive every ~3 min, dashboard is Live. **Record:** actual interval between points.

---

## Scenario 2 — Screen locked, phone in pocket (THE core test, ≥ 2 hr)

Purpose: this is what a real SE workday looks like. Most OEM tracking failures show up here.

1. [ ] Start Day, then **lock the screen** and pocket the phone. Do NOT swipe the app away.
2. [ ] Move around normally for at least 2 hours.
3. [ ] Without force-stopping, periodically wake the screen (don't reopen the app) and confirm the tracking notification is **still present**.
4. [ ] On the dashboard throughout: SE stays **Fresh**, no gaps > 12 min, no interruption alert raised.

**Pass:** continuous points for the full 2 hr, dashboard never flips to Delayed/Offline, no false interruption alert. **Record:** any gap > 6 min and what the phone was doing then.

---

## Scenario 3 — Removed from recents / swipe-away (survival)

1. [ ] Start Day. Open the recents/app-switcher and **swipe the Sri Aparajita card away**.
2. [ ] Confirm the notification **persists** and points **keep flowing** (this is what `START_STICKY` + foreground service should give us on stock Android).

**Pass:** tracking survives swipe-away. **Note:** on some aggressive OEMs swipe-away == force-stop; if it dies here, record the OEM — that becomes a battery-exemption UX requirement, not a code bug.

---

## Scenario 4 — Aggressive OEM + Battery Saver (the make-or-break)

Run on at least one **Xiaomi/MIUI, Oppo/ColorOS, Vivo/FuntouchOS, or Samsung** device.

1. [ ] Before Start Day: set the app to **Battery → Unrestricted / No restrictions**, and enable **Autostart** (MIUI/ColorOS have an explicit Autostart toggle).
2. [ ] Turn **Battery Saver ON**.
3. [ ] Run Scenario 2 (locked, pocketed) for ≥ 2 hr.
4. [ ] Repeat once **without** the battery exemption to see the failure mode the field will hit if they skip that setup step.

**Pass:** with exemption granted, tracking survives ≥ 2 hr. **Record:** exactly which per-OEM toggles were required — these become the SE onboarding instructions.

---

## Scenario 5 — Offline / no network, then reconnect (8-hour recovery)

Purpose: proves the offline queue AND surfaces the backlog-sync performance risk flagged in review (per-point insert + full distance/dwell recalc runs in-request).

1. [ ] Start Day with a good connection (server session created).
2. [ ] Enable **Airplane mode** (or drive into no-coverage). Keep GPS on if possible; otherwise accept that GPS-off = no points (known limit).
3. [ ] Move around for as long as feasible — target **8 hours** to mimic a full offline workday (~160 queued pings).
4. [ ] Re-enable network.
5. [ ] Confirm: the queued pings flush to the server, the dashboard back-fills the trail, and the **flush completes without the request timing out**.

**Pass:** all queued points arrive, no permanent loss, no duplicate double-count, flush finishes. **Watch for:** a slow/failing flush on the big batch → that confirms we need to batch inserts / move recalc to the cron. **Record:** number of pings queued and time-to-drain.

---

## Scenario 6 — Reboot mid-day

1. [ ] Start Day, confirm tracking active.
2. [ ] Power the phone **off and on** (full reboot).
3. [ ] After boot, **before** reopening the app, check the dashboard: expect a gap (known — boot receiver alone does not resume tracking).
4. [ ] Reopen the app / Start Day and confirm tracking resumes and the same server session is reused (no duplicate day, no double distance).

**Pass:** clean resume with one continuous session, no duplicate session row. **Expected gap:** the reboot window — that's acceptable and documented.

---

## Scenario 7 — Interruption alert fires correctly

Purpose: verify the server-side safety net without pretending it's Force-Stop detection.

1. [ ] Start Day, confirm Live.
2. [ ] Force-stop the app (or turn GPS off) and leave it for **> 15 min**.
3. [ ] Confirm the manager dashboard/alerts shows a **TRACKING_COMMUNICATION_INTERRUPTED** alert for that SE (severity high), with wording about power/network/GPS/permissions — **not** a claim of force-stop detection.
4. [ ] Confirm only **one** alert is raised (dedup by `alert_code`), not one every 3 min.

**Pass:** exactly one interruption alert after ~15 min, correct wording, no spam.

---

## Scenario 8 — End of day (both paths)

1. [ ] **Manual:** tap **End Day** → notification clears, session marked ended, distance + dwell finalised, dashboard shows "Day ended".
2. [ ] **Automatic:** leave a session active past **21:00 IST** and confirm the server closes it (`ended_reason = server_9pm_closure`) within a few minutes of 9 PM, with distance/dwell recalculated.
3. [ ] End Day twice / double-tap → confirm idempotent (no error, no second session).

**Pass:** both closure paths finalise cleanly and are idempotent.

---

## Scenario 9 — Distance & dwell accuracy on a real route

Purpose: calibrate the filters against ground truth before managers trust the numbers.

1. [ ] Drive a **known route** (use a car odometer or Google Maps distance as ground truth).
2. [ ] Visit 2–3 customers, staying **≥ 6 min** at each (dwell threshold).
3. [ ] Compare dashboard **filtered distance** vs odometer — expect within a sensible margin; large under/over-count means the 20 m / 75 m / 140 km/h thresholds need tuning.
4. [ ] Confirm each ≥ 6 min stop registers as a **dwell event** near the right customer (100 m geofence).

**Pass:** distance within tolerance of odometer, real stops detected as dwells, no phantom dwells while moving. **Record:** odometer km vs dashboard km, and any missed/phantom dwell.

---

## Results template (copy per device)

```
Device: __________  Android __  OEM skin: __________  APK versionCode: 5
Scenario 1 baseline:        PASS / FAIL — notes:
Scenario 2 locked 2hr:      PASS / FAIL — max gap: __ min
Scenario 3 swipe-away:      PASS / FAIL —
Scenario 4 OEM+saver:       PASS / FAIL — toggles needed: __________
Scenario 5 offline 8hr:     PASS / FAIL — pings queued: __ drain time: __
Scenario 6 reboot:          PASS / FAIL — gap: __
Scenario 7 interruption:    PASS / FAIL — alerts raised: __
Scenario 8 end of day:      PASS / FAIL —
Scenario 9 distance/dwell:  odometer __ km vs dashboard __ km; dwells __/__
```

## Go / no-go for wider rollout

Ship to the full field team only when, on **at least one stock Android and one aggressive OEM**:
- Scenario 2 (locked, 2 hr) passes with no gap > 12 min, and
- Scenario 5 (offline recovery) drains without loss or timeout, and
- Scenario 4's required per-OEM battery toggles are written into SE onboarding.
