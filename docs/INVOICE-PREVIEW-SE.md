# SE Invoice Preview (view before share)

**Status:** ✅ Code-complete + typecheck clean. ⏳ **Needs a new EAS APK build + on-device test** (adds a native library — cannot ship as a JS-only update).
**Date:** 2026-07-30
**Scope:** Mobile SE app only. **No backend change.**

## Goal

On the mobile **Alerts tab → "New invoices"** section, tapping an invoice used to jump **straight to the WhatsApp share sheet** — the SE couldn't check it first. Now: tap → **open a full in-app PDF preview** → SE verifies it's the right invoice → **"Share to WhatsApp"** button forwards that same file. Purpose: stop SEs sending the wrong invoice.

## Locked decisions (from the user)

- **View method:** custom in-app preview screen using **react-native-pdf** (full PDF, not just fields).
- **Sharing:** kept — a **"Share to WhatsApp"** button on the preview screen (view first, share second).
- **Offline:** none — the PDF is **fetched fresh each time** (no cache).
- **Auth:** unchanged/strict — the app downloads the PDF with the normal **Bearer header** to a local file and renders that file. **Nothing in a URL** (the "tokenized URL" idea was rejected as unnecessary once react-native-pdf was chosen).
- **Where:** only the Alerts → New invoices list. **SE only** (not Logistics).
- **No** "already viewed/shared" state tracking.

## What was implemented

1. **`apps/mobile/src/lib/invoice-notifications.ts`** — split the old `shareInvoicePdf` into:
   - `downloadInvoicePdf(invoiceId, fileLabel): Promise<string | null>` — Bearer-auth download to a local file, returns the `file://` URI (or null on failure).
   - `shareInvoiceFile(fileUri, fileLabel): Promise<boolean>` — opens the system share sheet for an already-downloaded file.
   - `shareInvoicePdf(...)` kept as a thin wrapper (download + share) for any legacy caller.

2. **`apps/mobile/src/app/invoice/[id].tsx`** — NEW preview screen (expo-router route `/invoice/[id]`, params `id` + `title`):
   - Downloads the PDF fresh on mount (loading / error / retry states).
   - Renders the full PDF with `<Pdf source={{ uri, cache: false }} />` (react-native-pdf).
   - Bottom **"Share to WhatsApp"** button → `shareInvoiceFile`.
   - Own header + back button (root Stack has `headerShown: false`).

3. **`apps/mobile/src/app/(tabs)/alerts.tsx`** — invoice tap now navigates to the preview screen instead of sharing directly:
   - `onOpen` → marks the notification read + `router.push({ pathname: "/invoice/[id]", params: { id, title } })`.
   - Removed the busy/spinner + direct-share logic; card trailing icon changed from `share-social-outline` → `chevron-forward-outline` (it's now a "view" affordance).
   - Empty-state copy updated to "ready to view and share".

## Dependencies added (`apps/mobile/package.json`)

- `react-native-pdf@^7.0.4` — v7 is a **Fabric / New-Architecture** native component (has `codegenConfig` with a `./fabric` dir), so it's the right choice for **Expo SDK 57 / RN 0.86** (new arch on by default).
- `react-native-blob-util@^0.24.10` — required peer of react-native-pdf.

No Expo **config plugin** needed (neither ships an `app.plugin.js`); they autolink via Expo prebuild + EAS. `app.json` plugins were **not** changed.

## What remains — to finish/verify

1. **Build a new EAS APK** (this is the only way to get the native libs into the app). Existing build config (ABI filter to arm64-v8a, FCM, etc.) is unchanged.
2. **On-device test:**
   - Alerts → New invoices → tap an invoice → the **full PDF renders in-app** (scroll/zoom).
   - **Share to WhatsApp** button forwards the PDF (existing share behavior).
   - Back returns to Alerts; the tapped invoice is marked read (no "new" dot).
   - Error path: airplane mode → tap → "Couldn't load" + Retry.
3. **Risk to watch:** react-native-pdf on RN 0.86 new arch. v7 supports Fabric, but if the build fails or the viewer misbehaves, the **fallback** is the no-native-build **in-app browser-tab** route (`expo-web-browser`, already installed) — but that needs a short-lived **tokenized invoice URL** (a small API change) and the Share button would move back onto the notification card.

## Notes

- Route types (`.expo/types/router.d.ts`) regenerate automatically on `expo start` / build — the `/invoice/[id]` entry is picked up from the file tree.
- Web + API untouched; nothing to deploy on the server side.
