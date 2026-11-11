# TODO — Wire SE-day odometer capture (mobile + API write-path)

**Status:** ✅ DONE (2026-10-19). The capture side is now wired end-to-end — the SE
Start-day / End-day flows prompt for the whole-km odometer, the mobile start/end
calls send `startOdometer` / `endOdometer`, and the API tracking-sessions write-path
stores + validates them (end > start, 10–200 km/day band, server source of truth).
Attendance KPIs light up as soon as a real Start→End day runs.

**Created:** 2026-10-16 · **Context:** follow-up to the Beyond attendance port.
**Completed:** 2026-10-19 — ported surgically from Beyond, preserving Sri's GPS
lifecycle, per-user SecureStore scoping, native foreground service and midnight cap.

---

## What's already DONE (shipped in the attendance port)

- **DB:** migration `0096_se_odometer.sql` added nullable `start_odometer` / `end_odometer`
  (integer) to `gps_tracking_sessions`. **Applied** to the DB.
- **API (read side):** `apps/api/src/services/attendance.ts` selects & returns
  `startOdometer` / `endOdometer` for the daily + monthly attendance views.
- **Web:** full Beyond attendance UI (KPIs, stats, daily timeline, distance) reads those
  fields and shows distance = end − start, else "—".

➡️ Because nothing writes the columns, they stay `null` and the UI shows "—".
Verified end-to-end: the read query runs on real sessions and returns the fields (null).

---

## What's MISSING (this TODO)

Populate `gps_tracking_sessions.start_odometer` / `end_odometer` from the SE's
Start-day / End-day flow, so the attendance KPIs light up.

Reference implementation: **Beyond** (`~/Desktop/Beyond-Distribution-Management-System`).
Sri currently has odometer only in the unrelated **LOGISTICS delivery-run** feature.

### 1) Mobile — SE day flow (`apps/mobile`)
- [ ] **NEW** `src/lib/odometer-prompt.ts` (+ `odometer-prompt.test.ts`) — port from Beyond.
      Mandatory whole-km number prompt (no photo); re-asks until valid. Exposes
      `promptOdometer(dialog, opts)` and `MIN_DAY_DISTANCE_KM` / `MAX_DAY_DISTANCE_KM`.
- [ ] `src/lib/start-day-flow.ts` — before `startDayTracking`, prompt
      "Starting odometer"; pass `{ startOdometer }`. Abort start if cancelled.
- [ ] End-day flow (`src/components/home/end-day-button.tsx` / `src/lib/use-day-tracking.ts`
      / `src/lib/gps-stop.ts`) — prompt "Ending odometer" with
      `greaterThan: startOdometer` + the distance band; pass `{ endOdometer }` to the end call.
- [ ] `src/lib/gps-start.ts` / `src/lib/gps-session.ts` — thread `startOdometer` through
      `startDayTracking` and persist locally (offline-safe).
- [ ] `src/lib/sync-tracking-session.ts` — include `startOdometer` / `endOdometer` in the
      start/end payloads sent to the API.
- [ ] `src/components/dialog-types.ts` — ensure `PromptOptions` supports
      `keyboardType: "number-pad"`, `required`, `destructive` (End day styles red).
- [ ] Check `src/lib/local-db-schema-*.ts` — add odometer columns if the session is
      queued locally before sync.
- [ ] **NOTE:** these mobile files have **diverged** from Beyond — reconcile
      **surgically/additively** (don't overwrite wholesale; preserve Sri's GPS lifecycle,
      native foreground service, per-user SecureStore day flags, midnight cap).

### 2) API — tracking-sessions write-path (`apps/api`)
- [ ] `src/routes/tracking-sessions.ts` — accept `startOdometer` on start, `endOdometer`
      on end (`assertOdometer` + `optionalNumber`).
- [ ] `src/services/tracking-sessions.ts`:
  - [ ] `MIN_DAY_DISTANCE_KM = 10`, `MAX_DAY_DISTANCE_KM = 200` (server = source of truth).
  - [ ] Store `start_odometer` on session create; `backfillStartOdometer` on a reused
        session that has none yet.
  - [ ] On end: reject `endOdometer <= start_odometer`; enforce the 10–200 km band;
        `end_odometer = coalesce(end_odometer, …)`.
  - [ ] Return `startOdometer` / `endOdometer` from the session reads.
- [ ] Port/extend `src/routes/tracking-sessions.test.ts` for the new validation paths.

### 3) Verify
- [ ] Mobile unit tests (odometer-prompt + flow) pass.
- [ ] API tests (tracking-sessions guard) pass.
- [ ] `tsc --noEmit` clean in `apps/mobile` + `apps/api`.
- [ ] End-to-end: a real Start→End day writes non-null readings; attendance KPIs show a
      distance instead of "—".

---

## Open questions to settle before starting (I was about to ask these)

1. **Scope:** mobile + API together, or API write-path first and mobile later?
2. **Distance band:** keep Beyond's 10–200 km/day, or different bounds for Sri's territory?
3. **Mobile approach:** confirmed **surgical/additive** (recommended) vs wholesale overwrite
   of the day-flow files.

---

## Pointers (Beyond paths)

- `apps/mobile/src/lib/odometer-prompt.ts` (+ `.test.ts`)
- `apps/mobile/src/lib/start-day-flow.ts` (uses `promptOdometer`)
- `apps/api/src/routes/tracking-sessions.ts` (`assertOdometer`, lines ~46/72)
- `apps/api/src/services/tracking-sessions.ts` (MIN/MAX band, `backfillStartOdometer`,
  end-day guard ~lines 10-11, 208-255, 382-432)
