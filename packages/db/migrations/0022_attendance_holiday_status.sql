-- 0022_attendance_holiday_status.sql
-- Add 'holiday' as an allowed attendance status. A holiday is a company-wide
-- non-working day (markable per cell, or in bulk for all active SEs on a date);
-- it is excluded from the attendance denominator the same way 'week_off' is, and
-- a worked holiday is shown as Present (work wins) in the grid derivation.
-- Without this, any write of status='holiday' is rejected by the CHECK constraint
-- (the original list in 0001 allowed only present/absent/half_day/leave/week_off).
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check
    CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'week_off', 'holiday'));
