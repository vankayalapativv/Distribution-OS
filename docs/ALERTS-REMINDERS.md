# Alerts & Reminders (SE mobile app)

Status as of 2026-07-17: **Reminders shipped; Alerts screen scaffolded, feeds deferred.**

## What exists now

- **Reminders tab** (between Customers and Settings): personal, local-only
  reminders — title + exact date/time + **required** linked customer. Backed by
  scheduled OS notifications (`expo-notifications`), so they ring at the exact
  time with the app closed and without internet. Tapping the notification
  opens the linked customer. Data lives in device SQLite (`reminders` table,
  local schema v12) — deliberately NOT synced to the server in v1.
  The create form is a **full-screen pushed route** (`src/app/reminder/new.tsx`,
  KeyboardAwareScrollView so the keyboard never covers it) — changed 2026-07-18
  from the original bottom sheet, which the keyboard covered. The list screen
  (`src/app/(tabs)/reminders.tsx`) just navigates to it. Customer is mandatory.
  **Customer picker (2026-07-18):** inline search on the form (no modal) — the
  matching customers render as the same app contact cards used on the Customers
  tab (rounded border-card, name + CUST code, address), and appear ONLY while
  typing. Data comes from `fetchSeCustomers` in `src/lib/customer-directory.ts`
  (extracted from the Customers tab; network-first `/customers` which the API
  already scopes to the SE's own created_by customers, SQLite fallback) — so the
  picker shows only that SE's customers. **Date/Time = "Option B":** a single
  "When" button (⏰ + "Reminder time" + "Sat, 18 Jul · 1:46 am" + Change) that
  opens the native date picker then chains straight to the time picker.
- **Alerts screen** (bell on Home, top-right — replaced the old "Synced" chip;
  sync status remains in Settings): shows sync-attention banner plus two feed
  sections ("Collections due", "New invoices"), currently empty states.

## Deferred — decided 2026-07-17, to build later

1. **Accountant invoice upload (web)** — accountant uploads the invoice
   PDF/photo (from the billing software) against a customer, with amount +
   due date. Populates the existing `invoices` table + a file in R2.
   Not designed yet; the user will spec it when ready.
2. **"New invoice" alert (mobile)** — when an invoice lands for a customer
   the SE owns (`customers.created_by`), it appears in the Alerts screen.
   **Share**: opens the Android share sheet with the actual invoice PDF/photo
   (decision: file, not text summary — "Recommended" option chosen), so the
   SE can send it via their own WhatsApp/SMS to the customer.
   Implementation sketch: `GET /alerts/invoices` (SE-scoped), file streamed
   via authed endpoint → cached to device → `expo-sharing` share sheet.
3. **Ageing-collection alerts** — customers with old outstanding payments.
   The day thresholds are NOT decided yet ("lets fix these days later") —
   candidates: past invoice due date, or 30/60/90 buckets, possibly reusing
   the `credit_overdue_days` system setting. Revisit with the user.

## Notes / decisions

- Reminders are local-only v1: losing the phone loses reminders (accepted).
- Exact-time behavior: rings like an alarm with app closed; if the phone is
  OFF at ring time, Android shows it on next boot.
- Android 14+ exactness: without the alarm permission, Android downgrades the
  schedule to an inexact window (observed ~5.5 min late on the emulator). The
  manifest therefore carries `USE_EXACT_ALARM` (auto-granted on install;
  fine for our direct-APK distribution — Play would restrict it to
  alarm/calendar apps) plus `SCHEDULE_EXACT_ALARM` as fallback.
- Requires APK rebuild (expo-notifications + datetimepicker are native
  modules) — the dev client must also be rebuilt (`npx expo run:android`).
