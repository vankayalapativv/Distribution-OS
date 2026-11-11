---
name: mobile-session-device-labels
description: "How the web \"Manage sessions\" screen names a user's mobile device, and the registerPushToken notification-permission fix"
metadata:
  node_type: memory
  type: project
  originSessionId: 08350f47-afcb-4601-a27d-914d40a5a0b0
  modified: 2026-11-03T19:24:40.081Z
---

The web **Users → Manage sessions** dialog (SUPER_ADMIN) names each active session's device. Built 2026-11-03/04.

**Primary path (per-session accurate):** the mobile app sends a device string `SriAparajita/<appVersion> (Android <os>; <manufacturer>; <model>)` (from `expo-device`) in the **`/auth/login` body** (`apps/mobile/src/lib/neon-auth.ts` `deviceUserAgent()`). The API (`routes/auth.ts` reads body `device` ?? request UA → `services/mobile-auth.ts` `neonSignIn(…, userAgent)`) forwards it as the **user-agent header** to Neon's `/sign-in/email`, so Better Auth stores it on the session row. Web `describeDevice` (`apps/web/src/features/super-admin/super-admin-user-sessions.tsx`) parses it → "Samsung SM-G991B". This mirrors the web login BFF, which forwards the browser UA (→ "Chrome on macOS"). The label is set **at sign-in** — existing sessions keep their old label until re-login.

**Fallback path:** `push_tokens.manufacturer/model` (migration `0010_push_token_device.sql`) via `getUserLatestDevice` (super-admin.ts) → `GET /super-admin/users/:id/device`; falls back further to `tracking_device_heartbeats`. Note this can read "motorola motorola edge 50 neo" (manufacturer + model joined; model already carries the brand) — a cosmetic dup `getUserLatestDevice` doesn't de-dupe (describeDevice DOES).

**Root-cause fix that mattered:** `registerPushToken()` (`apps/mobile/src/lib/invoice-notifications.ts`) used to early-return unless notification permission was already granted — so **admins (who never hit SE "Start day" / Logistics "Start run", the only places permission was requested) were never prompted, registered no push token, and got no pushes**. Now it REQUESTS permission on login (`getPermissionsAsync` → `requestPermissionsAsync` if `canAskAgain`). Push SENDING still targets SALES_EXECUTIVE only. All shipped via OTA — see [[expo-ota-updates]].
