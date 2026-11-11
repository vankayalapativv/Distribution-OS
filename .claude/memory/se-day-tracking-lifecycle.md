---
name: se-day-tracking-lifecycle
description: SE GPS day lifecycle — manual End-day button + midnight cap replaced the fixed-hour auto-stop (2026-10-04)
metadata:
  node_type: memory
  type: project
  originSessionId: 0b4435cc-5363-4ff4-b2d0-7af21abc73b5
  modified: 2026-10-04T13:52:28.537Z
---

Reworked 2026-10-04, reversing the 2026-07-23 "no End-day button / fixed-hour auto-stop" decision. SE-only; Logistics tracking untouched (no cap, ends only on "End run").

- **Manual End day**: in-app button beside the Home greeting (shown only while the day is on) → `stopDayTracking()` (stops native GPS + `POST /tracking-sessions/:id/end`, tagged `ended_reason='manual'`) + a date-stamped per-user SecureStore flag (`dayEndedKey()` in [gps-keys.ts](apps/mobile/src/lib/gps-keys.ts), via [[shared-field-device-userid-scoping]]). After ending, Home shows a "Day ended — start again tomorrow" card instead of Start.
- **Re-start blocked for the rest of the day**: locally by the dayEnded flag; on the server, `startTrackingSession` rejects with `DAY_ENDED` (422) when a `ended_reason='manual'` session exists for the SE today. A midnight-cap close does NOT block (not manual).
- **Cutoff = end of IST day** (`trackingCutoffHour('SALES_EXECUTIVE')` returns **24**, was 20). Points on the start IST day are all accepted; points that spill into the next IST date are dropped (`isAfterAllowedEndTime`). No fixed-hour auto-stop anymore (`isPastDayEnd`/`DAY_END_HOUR_IST` removed from mobile gps-config).
- **Midnight safety cap**: `capExpiredSeSessions(sql)` in `apps/api/src/services/tracking-maintenance.ts` closes still-active SE sessions whose IST day has rolled over, `ended_reason='server_midnight_cap'`, `ended_at` = next IST-midnight boundary. Called every cron tick in `index.ts` **before** the `inMaintenanceWindow()` gate (IST midnight is outside the office-hours window). Mirrored natively: the foreground service + `TrackingWatchdogWorker` cap on a date (`KEY_CAP_DATE_IST`, the start IST date passed from JS), and the JS watchdog stops a stale day. **Native change ⇒ needs a full APK build, not OTA** ([[expo-ota-updates]]).
- **Attendance** (`apps/api/src/services/attendance.ts` + web `features/attendance`): daily/monthly/grid return `endTime = max(ended_at) filter (ended_reason='manual')`; UI shows "Started 3:06 am · Ended —" (dash when no manual end). So auto-/midnight-closed days show no end time.
