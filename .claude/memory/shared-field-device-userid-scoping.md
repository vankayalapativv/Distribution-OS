---
name: shared-field-device-userid-scoping
description: Field devices are SHARED across users — per-user device flags must be scoped by userId
metadata:
  node_type: memory
  type: project
  originSessionId: 99136f55-afbb-4798-93c6-8484f10b5e00
  modified: 2026-10-04T19:39:00.468Z
---

The mobile app runs on SHARED field devices: one phone, many sales executives log in/out through the day. Any per-user device flag (SecureStore / SecureStore-backed) MUST be namespaced by userId (`${baseKey}.${userId}`) or one user's state leaks to whoever logs in next.

**CRITICAL separator gotcha (bug fixed 2026-10-04, shipped via OTA commit 45fb4bf):** the scoped key separator must be a char SecureStore allows — it validates keys against `/^[\w.-]+$/` and THROWS on anything else. The first version used `:` (`${base}:${userId}`); the colon is INVALID, so every scoped `setItemAsync`/`getItemAsync` threw and was swallowed by the surrounding `.catch`, silently breaking ALL day-tracking persistence (Start day reverted to "Start day", no GPS session/pings, Live Tracking empty — while server-backed state like visits persisted fine). Fixed to `.` (userId is a UUID of hex + `-`, already valid). gps-keys.test.ts now asserts every scoped key matches the SecureStore charset. NEVER use `:` (or space, `/`, etc.) in a SecureStore key.

Done 2026-10-04 for GPS day/session flags via [gps-keys.ts](apps/mobile/src/lib/gps-keys.ts): `dayOnKey()`, `clientSessionKey()`, `serverSessionKey()` read `useAuth.getState().user?.id`. userId is available at every call site (start/stop/session/native/watchdog/sync) because they already read the token the same way; logout stops tracking BEFORE it clears the user, so the delete path still sees the id. Legacy device-global keys are scrubbed on stop/logout (`LEGACY_UNSCOPED_KEYS`).

**Why:** a device-global "day on" / tracking-session key made user B's app think the day was already running and attached B's pings to A's server session.

**How to apply:** any new "device remembers X per user" flag (day-ended, onboarding-seen, draft) → scope by userId; leave genuinely device-level settings (app-lock PIN) global. App-lock is deliberately NOT scoped.

**Wipe-on-different-user (added 2026-10-05):** logout wipes local data, but a crash/kill with no logout left the prior user's device-global SQLite rows + in-memory React Query cache intact for the next login. Now `login` in [auth-actions.ts](apps/mobile/src/lib/auth-actions.ts) persists `LAST_USER_KEY` and, when a DIFFERENT userId signs in, wipes the previous user's scoped GPS keys (`scopedKeysFor(priorId)`), local SQLite (`clearAllLocalData`), scheduled reminders, and the React Query cache BEFORE establishing the new session. A RETURNING user (same id) is NOT wiped — preserves their un-flushed GPS buffer (the 401 soft-expire keeps it to flush after re-login). `queryClient` was extracted to [query-client.ts](apps/mobile/src/lib/query-client.ts) as a module singleton so non-React code can `.clear()` it; also cleared on logout. The app is online-required since v19 (no persistent offline screen caches remain), so there is no cache-staleness to rebuild.

Related: [[expo-ota-updates]].
