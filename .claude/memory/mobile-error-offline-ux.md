---
name: mobile-error-offline-ux
description: "Mobile severity-aware error handling + offline/stale UX system (ErrorState/FeedbackBanner/toast, global bar wording, notes have no offline queue, credit-gated tiles decoupled)"
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-08T20:29:04.947Z
---

Shipped 2026-11-09 (committed `0ec679e` + `5db4234`, pushed to `main`, NOT yet OTA'd to the field APK — all JS-only/native-safe so OTA-able).

**Severity-aware error handling (whole mobile app).** `humanize-error.ts` now returns a `severity: "error" | "warning"` — 402/404/408/429/offline/network → warning (amber), 401/403/5xx/other → error (red). Shared components:
- `ErrorState` — standard load-error state; offline- + severity-aware (amber "cloud-offline"/"warning" icon vs red). Drop into a query's error branch: `if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />`.
- `FeedbackBanner` (new) — inline banner, `variant` error|warning|success|info; `ErrorBanner` now delegates to it.
- `toast` (new) — transient toast host wired in `_layout`.
Wired into dashboards, login, order, collection, customer-edit, profile, ledger, invoice, notes, order-detail and list screens. On a bad network these render ⚠️ "Connection problem — Try again" (verified live under emulated GPRS).

**Offline/stale UX:**
- Global bar = `"No internet connection"` (was "Offline — changes are saved and will sync", which over-promised). Inline cache strip = `"Showing last synced data"` (was "Offline — showing last synced data"). Dedupes the double-"Offline".
- The inline `fromCache` strip was REMOVED from the customer + ledger screens (it flashed during the normal online stale-while-revalidate window). The order catalogue keeps it, correctly gated `fromCache && !isFetching`.
- **Notes have NO offline queue** (unlike orders/collections/visits which queue via clientUuid + sync engine). So the notes Save button is gated on connectivity (`canSave` requires `online`) with an honest "You're offline. Connect to the internet to add a note." hint — the app-wide "saved & will sync" bar does not apply to notes.
- **Credit-gated action tiles** (customer screen `ActionRow`): Collect/Ledger/Notes now ALWAYS render; only Order is credit tri-state (skeleton while credit genuinely loading, else FAIL-OPEN to enabled — the order screen runs its own credit check and "proceeds without the block check" on failure). Previously the whole 4-tile row was hidden behind a skeleton until the credit query resolved → on a poor network the SE was stuck. See [[local-dev-uses-live-prod]].

Network test (3G/4G/GPRS, emulated): small reads instant even on 3G; catalogue ~7s on 3G with clean skeletons; GPRS → heavy sections time out to the severity-aware error with Try-again (graceful). Related: [[mobile-tracking-map-overlays]].
