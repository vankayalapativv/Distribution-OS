# Decision: Live-tracking shows impossible "bowtie" routes (multi-device on one account)

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-08
- **Owner:** (SA)
- **Area:** `apps/api` tracking (`services/tracking.ts`, `tracking-distance.ts`), mobile GPS capture, `gps_points` / `gps_tracking_sessions`

## Problem

LAXMAN's (Logistics) Live-Tracking map for 8 Aug 2026 drew a star/bowtie of long
straight lines between **Suryapet (west)** and **Khammam/Kodad (east), ~60 km apart**.

## Root cause

Tracking is keyed to the **user account**, not the **device/session**, and the map
draws *every* point for that `user_id` (accuracy ≤ 100 m) in time order — with no
device/session or jump filter. LAXMAN's shared account was tracking on **4 devices**
that day, including **two real phones in two towns at once** and an **Android emulator**:

| Device | Heartbeats | Window |
|---|---|---|
| motorola edge 50 neo | 251 | 12:30–16:57 |
| Google `sdk_gphone16k_arm64` (**emulator**) | 206 | 12:51–13:37 |
| samsung SM-A546E | 175 | 18:08–23:13 |
| OnePlus CPH2649 | 25 | 20:52–23:09 |

Proof it's two devices, not GPS drift — consecutive **good-accuracy** fixes (3–28 m):
`20:51 Suryapet → 20:52 Khammam (60 km, 84 s) → 20:54 Suryapet → 21:13 Khammam`.
One person cannot be in both. Contributing noise: GPS accuracy averaged 299 m
(max **3,663 m** — cell-tower/network fixes).

**Note:** the distance number already fights this ("39 accepted · 185 excluded") — the
jump filter exists; the map polyline just doesn't use it.

## Options (by layer — defense in depth)

| # | Option | Layer | Effort | Fixes | Trade-off |
|---|---|---|---|---|---|
| A1 | Draw only `is_accepted_for_distance` points on the route (reuse existing jump filter) | Display | S | Symptom | Cosmetic; bad data remains |
| A2 | Scope route to one session (`gps_points.session_id`) + device picker | Display | S–M | Symptom | Loses a leg if driver swapped phones one-at-a-time |
| B1 | Accept only the primary device's points at ingest; store others flagged | Ingest | M | Data | Needs one-active-session concept |
| B2 | Carry `device_id` on points; never merge devices (also fixes silent drop from `unique(user_id, recorded_at)`) | Ingest | M | Data | Schema + capture change |
| C1 | One active tracking device per account — new "Start day" **takes over** (newer-wins) | Session | M | **Root** | Must reconcile with "don't end an actively-pinging session" guard |
| C2 | Tracking keyed to (user + device); dashboard shows per-device trails | Session | L | **Root** | Bigger change + device-selector UX |
| C3 | Separate viewer login from tracker login (viewing never starts GPS) | Account | M | **Root** | Needs a view-only/device-role concept |
| D1 | Keep dev/emulator out of prod tracking — staging DB/env + debug-build upload gate | Env | M | Hygiene | Process/infra discipline |
| E1 | Reject network-only / very-low-confidence fixes; prefer GPS provider | Capture | S–M | Jitter | Fewer points indoors |

## Recommendation (layered)

1. **Now (safe, small):** **A1 + A2** — reuse the jump filter and scope the line to one
   session. Map becomes truthful without touching capture.
2. **Root cause:** **C1** (one active tracker per account, newer-wins); add **C3** so
   managers viewing an account don't become a second tracker. **C2** only if the business
   genuinely needs multiple tracking devices per login.
3. **Highest long-term value:** **D1** — a staging environment so dev/emulator never
   pollutes prod tracking.
4. **Polish:** **E1** for cleaner trails generally. **B2** also removes the silent
   point-drop from the `(user_id, recorded_at)` uniqueness constraint.

Best effort-to-value: **A1 + A2 + D1**. Real cure: **C1 (+C3)**.

## Decision

> _To be filled in: which options are approved, and in what order._

## Related

- `MEMORY`: shared-account logout bug; live-tracking upload fix; tracking screen-off fixes.
- Same underlying weakness (one login, many devices) as the earlier logout-kills-tracking issue.
