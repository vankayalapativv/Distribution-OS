---
name: razorpay-pause-resume-feature-gate
description: "Razorpay subscription Pause/Resume WORKS on this account; the earlier pause failures were a missing DB CHECK-constraint migration for the 'paused' status, fixed in 0088"
metadata:
  node_type: memory
  type: reference
  originSessionId: 40c06ed0-aa9f-4d4f-85b7-707c59c2b768
  modified: 2026-09-30T09:30:00.667Z
---

Reversible billing pause/resume (added 2026-09-30) uses Razorpay
`POST /subscriptions/{id}/pause` `{"pause_at":"now"}`, `/resume`
`{"resume_at":"now"}`, and `POST /subscriptions/{id}` `{quantity,
schedule_change_at:"cycle_end"}` on resume (no proration charge).

**Root cause of the initial failures (corrected):** NOT a Razorpay account
feature gate. Pause/Resume works on this account (dashboard shows subscriptions
as Paused; Razorpay `states.md`: "Only Subscriptions in the `active` state can
be paused"). The real bug: migration `0085` created a `subscriptions_status_check`
CHECK constraint that never listed `'paused'`, so every `UPDATE ... SET
status='paused'` threw a constraint violation. Razorpay paused fine but the local
row could never be marked paused → pause API returned "unexpected error", the
`subscription.paused` webhook was recorded but didn't update the row, and the
sync self-heal silently failed. Migration `0088_subscription_paused_status.sql`
adds `'paused'` to the constraint + the one-live-subscription index.

**Verified live on prod 2026-09-30:** pause→resume round-trip keeps the same
subscription active, renews 30 Oct, `paid_count` stayed 1 (no new invoice/charge).
The original problem this solves: cancel is terminal in Razorpay ("Once
cancelled, a Subscription cannot be restarted"), so cancel+re-create double-
charged; pause/resume is the reversible fix. Debugging lesson: when adding a new
value to a status/enum column, also migrate any CHECK constraint. See
[[local-dev-uses-live-prod]].
