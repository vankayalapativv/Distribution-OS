# Bug: tracking notification survives logout (and reboot)

**Status:** Diagnosed 2026-08-01; **fixed** on branch `fix/logout-stops-tracking`
(all three changes below implemented — JS tsc/tests green, native Kotlin compiles).
Needs a new APK to reach devices.
**Reported:** SE installs the latest APK, taps **Start day**, then **logs out** — the
persistent "you're being tracked" notification stays, and comes back even after a
force-close or phone restart.
**Severity:** High — privacy (a logged-out / next user keeps being GPS-tracked),
battery drain, and unauthenticated GPS pings pile up locally. Also alarming UX.

---

## Root cause (SE app — the reported bug)

`logout()` never stops day-tracking. It cancels *expo* notifications, wipes the
SQLite cache, and clears the token/user — but it **never calls
`stopDayTracking()`**, which is the only thing that stops the native Android
foreground service.

- [`src/lib/auth.ts:95`](../apps/mobile/src/lib/auth.ts) — `logout()`:
  `cancelAllScheduledNotificationsAsync` + `dismissAllNotificationsAsync` +
  `clearAllLocalData` + delete token/user. No tracking stop.
- [`src/lib/gps.ts:294`](../apps/mobile/src/lib/gps.ts) — `stopDayTracking()` is
  what sends the native `ACTION_STOP` (`stopNativeForegroundTracking`,
  [gps.ts:302](../apps/mobile/src/lib/gps.ts)), clears `DAY_ON_KEY` + session
  keys, removes the watch, and stops the GPS task. **Never invoked on logout.**

### Why the notification can't be dismissed and why it comes back
1. `Notifications.dismissAllNotificationsAsync()` ([auth.ts:99](../apps/mobile/src/lib/auth.ts))
   is **expo-notifications** and does not own the native foreground-service
   *ongoing* notification; the still-running service re-posts it anyway.
2. The native service persists a SharedPreferences flag `KEY_ACTIVE = true` on
   start ([`ForegroundLocationService.kt:93`](../apps/mobile/android/app/src/main/java/com/anonymous/mobile/tracking/ForegroundLocationService.kt))
   and clears it **only** in the `ACTION_STOP` path
   ([:273](../apps/mobile/android/app/src/main/java/com/anonymous/mobile/tracking/ForegroundLocationService.kt)).
3. The service returns `START_STICKY` ([:60,:80](../apps/mobile/android/app/src/main/java/com/anonymous/mobile/tracking/ForegroundLocationService.kt))
   → Android restarts it if the app is force-killed.
4. `BootCompletedReceiver` restarts it on every **reboot / app update** whenever
   `KEY_ACTIVE` is true ([`BootCompletedReceiver.kt:13`](../apps/mobile/android/app/src/main/java/com/anonymous/mobile/tracking/BootCompletedReceiver.kt)).

Because logout never triggers `ACTION_STOP`, `KEY_ACTIVE` stays `true` forever —
tracking is tied to "did the SE tap Start day," never to "is the SE still logged
in." That is exactly why the notification **stays / comes back after restart**.

### Secondary (same root)
- SecureStore state isn't cleared on logout — `clearAllLocalData()` only wipes
  SQLite ([local-db.ts:370](../apps/mobile/src/lib/local-db.ts)); `DAY_ON_KEY` and
  the session keys survive, so both JS `isDayTracking()` and the native prefs
  still believe the day is on for the next sign-in.

---

## Logistics app — protected in the normal flow, but shares the weakness

Logistics does **not** reproduce the bug through the intended flow, thanks to a
UI guard:

- Logout is hard-blocked while a run is active — [`(logistics)/settings.tsx:60`](../apps/mobile/src/app/(logistics)/settings.tsx)
  ("End your deliveries first"). `hasActiveRun` = `getActiveDeliveryRun(db) !== null`
  (`delivery_runs.status='active'`, [sync-core.ts:433](../apps/mobile/src/lib/sync-core.ts)).
- Tracking lifecycle is tied to the run: start run → `startDayTracking()`
  ([delivery.tsx:181](../apps/mobile/src/app/(logistics)/delivery.tsx)); end run →
  `stopDayTracking()` ([delivery.tsx:224](../apps/mobile/src/app/(logistics)/delivery.tsx)).

So you can't log out until you end the run, and ending the run stops the service.

### Caveats (edge cases)
1. **Swallowed stop failure** — [delivery.tsx:224](../apps/mobile/src/app/(logistics)/delivery.tsx):
   `await stopDayTracking().catch(() => {})`. The run is marked `ended` and the
   "finished" screen shows **regardless of whether tracking actually stopped**. If
   the stop fails, `KEY_ACTIVE` stays `true` (notification persists) while
   `hasActiveRun` becomes `false` → the logout guard now passes → same leak.
2. **Guard, not a correct logout** — protection comes entirely from
   `delivery_runs.status`, not from the real tracking state. The shared `logout()`
   still never stops tracking, so any desync (tracking live with no `active` run
   row) drops straight through to the SE bug.

---

## Recommended fix (not yet implemented)

1. **Make `logout()` stop tracking before clearing the session.**
   In [`src/lib/auth.ts`](../apps/mobile/src/lib/auth.ts) `logout()`, `await
   stopDayTracking()` **while the token still exists** (so it can also close the
   server session cleanly), best-effort (`try/catch`) so it never blocks logout.
   One call sends native `ACTION_STOP` → clears `KEY_ACTIVE` (boot receiver won't
   restart), removes the foreground notification, stops the GPS task/watch, and
   deletes `DAY_ON_KEY` + session keys. **Fixes the SE bug and hardens Logistics.**
2. **Don't treat a failed stop as a clean end** — at
   [delivery.tsx:224](../apps/mobile/src/app/(logistics)/delivery.tsx), surface a
   stop failure instead of swallowing it (or re-attempt), so a run can't be marked
   ended while the service is still alive.
3. **Optional hardening** — have the native service also treat "no auth token" as
   a stop condition, so tracking can never outlive a session even if the JS stop
   path is skipped.

### Verification after fixing
- SE: Start day → confirm notification shows → **Log out** → notification gone,
  GPS task stopped (`hasStartedLocationUpdatesAsync` false), `KEY_ACTIVE` false;
  reboot → notification does **not** return.
- Logistics: end run with a forced stop failure → confirm the run is not silently
  marked ended / notification handled; normal end-run + logout still clean.
