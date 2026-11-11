# Crash Reporting — Options & In-House Design

How to get visibility into app crashes for the Sri Aparajita mobile app, and the
plan for a **simple in-house crash log viewable in the Super Admin
dashboard**. Written 2026-07-13 after a native crash on a Motorola Edge 50
Neo was diagnosed by hand via `adb logcat`.

---

## The two paths

| | **Build our own (in Super Admin)** | **Sentry (external service)** |
|---|---|---|
| Where crashes are viewed | **Inside our web dashboard** | Sentry's own website |
| Catches JS crashes (bad data, null, network, render errors) | ✅ | ✅ |
| Catches **native** crashes (e.g. the permission crash) | ❌ | ✅ |
| New accounts / services | none | Sentry account + SDK |
| Effort | ~1 small feature (same shape as Tasks / Tracking) | medium setup |
| Fits the "Super Admin view" requirement | ✅ exactly | ✅ but a separate site |

**Recommendation: build the in-house one.** It answers the actual
requirement (crashes visible in the Super Admin dashboard), needs no third
party, and catches the *common* field crashes — the "app closed on a weird
record / no signal / unexpected null" kind, which are the bulk of
real-world crashes.

### Important caveat — JS vs native crashes

An in-house JS reporter can only report crashes that happen **in
JavaScript while the app is alive**. It captures:

- React **render errors** (via the app's `ErrorBoundary`)
- **Unhandled JS exceptions & promise rejections** (via the global
  `ErrorUtils` handler — both already wired in `apps/mobile/src/app/_layout.tsx`)

It **cannot** capture a **native crash** (the process dies below the JS
layer before any JS runs). The 2026-07-13 Moto crash was native
(`RECEIVE_BOOT_COMPLETED` missing for background location) — that class of
crash needs `adb logcat -b crash` (manual) or Sentry's native SDK. Native
crashes are rarer, and the big one is now fixed; going forward most
crashes will be JS-level, which the in-house tool **will** catch.

> The two aren't mutually exclusive: the in-house log can ship now, and
> Sentry can be added later if native-crash coverage across the fleet
> becomes important.

---

## In-house design (recommended build)

Same architecture as the existing features (Tasks, Live Tracking, Market
Intelligence). No new mobile dependencies — `expo-constants` and
`expo-device` are already installed, so app version and exact device model
(e.g. "Motorola Edge 50 Neo") come for free.

### 1. Database — migration `00XX_client_errors.sql`

```
client_errors
  id              uuid pk
  organization_id uuid
  message         text            -- error message
  stack           text            -- truncated stack trace
  kind            text            -- 'render' | 'fatal' | 'unhandled'
  screen          text null       -- current route/pathname when it happened
  app_version     text null       -- from expo-constants
  platform        text null       -- 'android' / 'ios'
  os_version      text null       -- Device.osVersion
  device_model    text null       -- Device.modelName  ← Moto vs Samsung etc.
  user_id         uuid null       -- who was logged in
  user_name       text null
  occurred_at     timestamptz     -- device clock
  created_at      timestamptz     -- server receipt
  resolved        boolean default false
  resolved_by     uuid null
  resolved_at     timestamptz null
```

### 2. API — `/client-errors` (new route)

- `POST /client-errors` — **any authenticated user** may report (SEs are
  the ones crashing). Fire-and-forget from the app; failures must never
  crash the reporter itself. Offline crashes queue in local SQLite and
  send on the next sync, reusing the existing sync engine.
- `GET /client-errors` — **SUPER_ADMIN only**. Newest first; filters:
  `?resolved=`, `?userId=`, `?deviceModel=`, date range.
- `PATCH /client-errors/:id/resolve` — SUPER_ADMIN marks handled.

TDD as usual (failing vitest first, then implement).

### 3. Mobile — wire the existing handlers

The crash hooks already exist in `_layout.tsx` (the `ErrorBoundary` export
and the global `[BeyondCrash]` handler). Add a small
`reportClientError(kind, error, screen?)` helper in `src/lib/` that:

- collects `Constants.expoConfig?.version`, `Platform.OS`,
  `Device.osVersion`, `Device.modelName`, the current route, and the
  logged-in user,
- POSTs to `/client-errors` (wrapped in its own try/catch so a reporting
  failure is silent),
- on network failure, enqueues to local SQLite for later sync.

Then the `ErrorBoundary` and global handler call it in addition to the
existing `console.error`.

### 4. Web — "Crash Reports" page

- Route `/dashboard/diagnostics` (or `/dashboard/crash-reports`),
  SUPER_ADMIN only, added to the sidebar (all page components' nav).
- Newest-first table: **message · device model · app version · user ·
  time**, with the stack trace expandable per row, an **Open / Resolved**
  filter, and a **"Mark resolved"** button.

Example row a Super Admin would see:

> `TypeError: cannot read 'legalName' of null` — Motorola Edge 50 Neo —
> v1.0.0 — Test_sales — 2 min ago  ▸ (expand for stack)

### Scope / effort

~1 migration, ~2 API files + tests, ~1 mobile helper + handler wiring,
~1 web page + api file. End-to-end verifiable: force a crash on the
emulator → confirm it appears on the web page and can be marked resolved.

---

## When to reconsider Sentry

Add Sentry (alongside or instead) if any of these become true:

- Native crashes recur and `adb logcat` per-device is too slow.
- The SE fleet grows and you want automatic, zero-touch capture with
  breadcrumbs, release health, and alerting.
- You want crash-free-session metrics per app version.

Until then, the in-house log covers the practical need and keeps
everything inside the dashboard the team already uses.
