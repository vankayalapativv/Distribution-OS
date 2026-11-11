/**
 * Types for the SE targets feature (GET /targets, PUT /targets/:userId).
 * Oils are a litre target PER SEGMENT.
 */

export const OIL_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

export type OilSegment = (typeof OIL_SEGMENTS)[number];

export interface SegmentLitres {
  segment: string;
  litres: number;
}

export type TargetPeriod = "week" | "month";

export interface PeriodProgress {
  periodStart: string;
  oilActual: SegmentLitres[];
  oilTarget: SegmentLitres[] | null;
}

/** Which period the Targets page is showing, and whether it's editable. */
export interface PeriodMeta {
  periodType: TargetPeriod;
  periodStart: string;
  isCurrent: boolean;
  isFuture: boolean;
  canEdit: boolean;
}

export interface ExecutiveTargets {
  userId: string;
  name: string;
  /** The selected period's target (+ actuals, which are zero for future periods). */
  perf: PeriodProgress;
  /** The SE's current-period target — powers the "Copy from current" button. */
  currentTarget: { oil: SegmentLitres[] } | null;
}

export interface TargetsResponse {
  period: PeriodMeta;
  executives: ExecutiveTargets[];
}

/** Whether a period has any target set (oil segments). */
export function hasTarget(p: PeriodProgress): boolean {
  return p.oilTarget !== null;
}

/** A copied set of target values — held in an in-app clipboard so it can be
 *  pasted into any other executive and/or the other period (week↔month), or
 *  applied to all executives at once. Oil keyed by segment. */
export interface TargetValues {
  oil: Record<string, number>;
}

/** Sum litres across the segment array (the overall oil figure). */
export function sumLitres(segments: SegmentLitres[]): number {
  return segments.reduce((acc, s) => acc + s.litres, 0);
}

/** Look up one segment's litres from an array, default 0. */
export function segLitres(segments: SegmentLitres[] | null, segment: string): number {
  return segments?.find((s) => s.segment === segment)?.litres ?? 0;
}
