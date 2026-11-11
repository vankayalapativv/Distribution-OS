---
name: attendance-holiday-feature
description: "Web attendance grid gained a 'holiday' status — per-cell + company-wide bulk (all active SEs, SUPER_ADMIN-only), plus Sunday auto week-off and a present/total DAYS KPI. Two bugs found & fixed: CHECK-constraint migration 0022, audit entityLabel-not-entityId. DEPLOYED prod 2026-11-09"
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-09T04:44:00.493Z
---

Attendance **Holiday** feature + Sunday week-off + present/total KPI. Committed `981c14b`, **DEPLOYED to prod 2026-11-09** (API version `19a8783c`, web version `31095d76` at sriaparajita.vardhansystems.in). Migration `0022` applied to prod first (correct DB-before-deploy order).

**What shipped** (web attendance grid, SUPER_ADMIN/MANAGER/ACCOUNTANT view; writes SUPER_ADMIN-only):
- New status **`holiday`** — a company-wide non-working day, markable per cell OR in bulk for every active SE on a date via `POST /attendance/holiday-all` (SALES_EXECUTIVE only, NOT Logistics; set-based single INSERT … ON CONFLICT; overwrite, no bulk undo).
- Grid derivation **work wins**: a worked holiday/week_off (SE has a tracking session that day) displays **Present**, not holiday.
- Denominator: holiday is excluded from the attendance % the same way `week_off` is.
- **Sunday auto week-off** (untracked Sunday → `week_off`, renders as a subtle "·").
- **present/total DAYS** column (e.g. "2 / 3" = present days ÷ working days; working days exclude week_off + holiday).

**Two bugs found & fixed this work:**
1. **CHECK-constraint (feature-breaking)** — original `attendance_status_check` (from migration `0001`) only allowed present/absent/half_day/leave/week_off, so every holiday write 500'd. Fixed by **migration `0022_attendance_holiday_status.sql`** (drop + re-add constraint with all 6). Same class as the billing 'paused' constraint bug ([[razorpay-pause-resume-feature-gate]]). ⚠️ LESSON: adding an enum-like status value always needs a CHECK-constraint migration.
2. **Audit log silently dropped** — the `holiday-all` route passed `entityId: date` ("2026-11-01") into `audit_logs.entity_id` which is **uuid**; `logAudit` casts `${entityId}::uuid` and swallows its own errors in try/catch, so the attendance rows wrote but no audit row. Fixed: `entityId: date` → **`entityLabel: date`** (entity_label is text). ⚠️ for a non-uuid identifier on an audit event, use `entityLabel`, never `entityId`.

Also fixed 2 **SonarQube S6582** (prefer optional chain) in `routes/attendance.ts` (lines 70 & 92): `note && note.trim()` → `note?.trim()`.

Verified end-to-end against prod DB (local=prod, [[local-dev-uses-live-prod]]): bulk wrote 4 rows for the 4 active SEs, purple "Ho" display, audit row (after fix), per-cell write, work-wins display, denominator unchanged, full revert. Tests: API 1315 passing.

Key files: `apps/api/src/routes/attendance.ts`, `apps/api/src/services/attendance.ts` (`setHolidayForAllSes`, `ATTENDANCE_STATUSES`, grid derivation, `getAttendanceSummary`), `packages/db/migrations/0022_attendance_holiday_status.sql`; web `apps/web/src/features/attendance/*` (attendance-cell-dialog, use-attendance-grid, attendance-grid-row, attendance-stats, attendance-api). Related: [[local-dev-uses-live-prod]], [[se-day-tracking-lifecycle]], [[razorpay-pause-resume-feature-gate]].
