# Distribution OS — Mobile App in the SaaS

> **Status: PLANNING ONLY — no code.** How the live Android field app (`apps/mobile`, Expo SDK 57) factors into the multi-enterprise SaaS. Companion to [`SAAS-PLAN.md`](SAAS-PLAN.md) (this is **Phase 5**), [`ONBOARDING-PLAN.md`](ONBOARDING-PLAN.md) and [`ADMIN-DASHBOARD-PLAN.md`](ADMIN-DASHBOARD-PLAN.md). **All findings below are from the actual code (2026-11-11), not memory.** Locked decisions: **neutral branding everywhere** + **fully server-driven dues bands**.

## The core principle: the mobile app has NO onboarding surface

Field staff (`SALES_EXECUTIVE`, `LOGISTICS`) **do not sign up or configure anything** on mobile. The enterprise's SUPER_ADMIN **provisions them on web** (Users page) *after* the enterprise is approved; they just **log in** to the shared app. Everything the app needs — company profile, tracking auto-stop times, dues bands, the overdue gate — is **enterprise config set during web onboarding** and delivered by the API. So the mobile app inherits the SaaS; it adds no signup/wizard of its own.

## What the code shows today (grounded, not assumed)

| Area | Current code | SaaS impact |
|------|-------------|-------------|
| **Login** | `auth-actions.ts` → Neon Managed Better Auth; `identifier` is **email OR phone** (API resolves phone→account); `neonJwtFromSession` mints an EdDSA JWT. | ✅ Already matches the SaaS **email-or-phone, globally-unique** login. No change to the identifier model. |
| **Identity resolve** | `/me` returns `{ role, userId }` only — **no `enterprise_id`**. Role gate allows `SALES_EXECUTIVE`, `LOGISTICS`, `SUPER_ADMIN`. | ⚠️ `/me` (and the JWT) **must start carrying `enterprise_id`**; the app stores it in `AuthUser` and every request is RLS-scoped to it. |
| **Shared-device hygiene** | `wipePreviousUserData()` wipes the prior user's scoped keys + local SQLite + React-Query cache when a **different** `userId` logs in. | ✅ Already correct across enterprises — a phone shared between users of **different** enterprises wipes cleanly on switch. (Scoped keys are `${key}:${userId}` — see memory `shared-field-device-userid-scoping`.) |
| **API base URL** | `api-core.ts` → single build-time `EXPO_PUBLIC_API_URL`. | ✅ One shared API for all enterprises — stays a single base URL. No per-enterprise routing. |
| **Branding** | `login.tsx` hard-`require`s `assets/images/distribution-os-logo.png` + "Distribution OS" label; `app.json` name `Distribution OS`, package `com.vardhansystems.distributionos`, `about.tsx` "Distribution OS Distribution". | ⚠️ **Rebrand to neutral "Distribution OS"** (logo, app name, package id, about text). New package = fresh Play Store listing + new APK. |
| **Dues bands** | Fixed 4-bucket TS union `"0_30" \| "30_45" \| "45_60" \| "60_plus"` in `dues.ts`, `admin-tracking.ts`, `invoice-notifications.ts` + the Home dues card. The band **label already comes from the server** (`DuesBucketSummary.label`), but the **count is hard-fixed at 4**. | ⚠️ Enterprises define a **variable number of bands** → mobile dues must become **fully server-driven** (render N bands from the server; drop the fixed 4-key union). |
| **Overdue / credit gate** | Server-side (`getCustomerCreditStatus`); the app just reads invoice outstanding + `creditBlocked`. | ✅ The **overdue-model change lives server-side** — remove the `credit_overdue_days` grace there and the app follows automatically (it renders whatever the API returns). |
| **Tracking auto-stop** | Native day/run lifecycle; today's cutoff is hard-coded IST end-of-day (`gps-config.ts`). | ⚠️ The **SE + Logistics auto-stop times set in onboarding** must reach the app as enterprise config and replace the hard-coded cutoff. This is likely a **native** change (not OTA-able) — fold into the Phase 5 APK. |

## Locked mobile decisions (2026-11-11)

1. **Neutral branding everywhere.** One "Distribution OS" logo + app name baked into a single APK, identical for every enterprise. The SE **does not** see their employer's logo. → **No logo-upload field is needed in onboarding.** Simplest: one APK, no per-enterprise assets to fetch.
2. **Fully server-driven dues bands.** Mobile renders whatever bands (keys + labels + day ranges) the enterprise configured — the fixed 4-key union is removed across `dues.ts`, `admin-tracking.ts`, `invoice-notifications.ts` and the Home dues card. One consistent dues model on web and mobile. This is **JS → OTA-able** (ship to installed phones without a new APK), subject to the usual fingerprint/runtime caveat (memory `expo-ota-updates`).

## Phase 5 mobile work (summary)

- **Enterprise-aware auth:** `/me` + JWT carry `enterprise_id`; store it in `AuthUser`; every API call scoped by it (server RLS does the enforcing).
- **Rebrand:** neutral logo/name/package + about text; new Play Store listing; fresh APK from `main`.
- **Server-driven dues:** remove the fixed 4-bucket union; render N bands from the API.
- **Tracking cutoff from config:** replace the hard-coded IST end-of-day with the enterprise's SE/Logistics auto-stop times (native → in the APK).
- **Runtime-policy fix:** cut the fresh APK off the fingerprint-policy trap (memory `expo-ota-updates`) while rebuilding.

## Not changing

- The email-or-phone login model, the shared-device wipe, the single API base URL, the offline queue, and the push-notification channel (SE-targeted) all stay as they are — they're already SaaS-compatible.

## Open items (flagged, not blockers)

1. **Tracking auto-stop = native.** Confirm it's delivered as enterprise config the native service reads at day-start; it ships in the Phase 5 APK, not an OTA.
2. **SUPER_ADMIN on mobile.** The admin area exists on mobile; in the SaaS it shows only that admin's own enterprise. No onboarding there — the admin onboarded on web.
3. **Band migration on the field phones.** When server-driven bands ship via OTA, the first load must tolerate a cached old-shape dues payload (defensive render).
