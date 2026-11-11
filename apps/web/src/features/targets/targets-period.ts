import { format, startOfMonth, startOfWeek } from "date-fns";
import { OIL_SEGMENTS, segLitres, type ExecutiveTargets, type TargetPeriod, type TargetValues } from "./targets-api";

/** Weeks start Monday for this business. */
export const MONDAY = { weekStartsOn: 1 as const };

/** The current period's start Date (this Monday, or the 1st of this month). */
export const currentStartOf = (p: TargetPeriod): Date =>
  p === "week" ? startOfWeek(new Date(), MONDAY) : startOfMonth(new Date());

/** Human label for a period start, e.g. "Week of 06 Jul 2026" or "July 2026". */
export function periodLabel(period: TargetPeriod, date: Date): string {
  return period === "week" ? `Week of ${format(date, "dd MMM yyyy")}` : format(date, "MMMM yyyy");
}

/** Read one executive's shown-period target into a clipboard payload. */
export function targetOf(exec: ExecutiveTargets): TargetValues {
  return {
    oil: Object.fromEntries(OIL_SEGMENTS.map((s) => [s, segLitres(exec.perf.oilTarget, s)])),
  };
}
