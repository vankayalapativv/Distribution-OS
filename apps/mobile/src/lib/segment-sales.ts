/**
 * SA Home "Sales by segment" — pure ranking logic (the fetch lives in the card so
 * this stays RN-free and unit-testable). Each active SE's oil litres split across
 * the 6 segments for the selected period; SEs are ranked by their period TOTAL and
 * zero-sale SEs dropped — same rule as the litres Leaderboard.
 */
import type { LeaderPeriod } from "./leaderboard";

/** The oil segments, in a fixed display order (matches the API's OIL_SEGMENTS). */
export const SEGMENTS = ["Car", "2W", "3W", "Commercial", "Agri", "Gear Oil", "Coolant", "Grease"] as const;
export type Segment = (typeof SEGMENTS)[number];
export type SegmentLitres = Record<Segment, number>;

/** One SE's per-segment litres across the three periods (from GET /leaderboard/segments). */
export interface SegmentSalesRow {
  userId: string;
  name: string;
  today: SegmentLitres;
  week: SegmentLitres;
  month: SegmentLitres;
}

export interface RankedSegmentRow {
  rank: number;
  userId: string;
  name: string;
  total: number;
  bySegment: SegmentLitres;
}

/** Rows for one period: drop zero-total SEs, sort by total desc (ties by name),
 *  number the ranks 1..n. Each row keeps its fixed-order per-segment map. */
export function rankSegmentSales(
  rows: SegmentSalesRow[],
  period: LeaderPeriod,
): RankedSegmentRow[] {
  return rows
    .map((r) => {
      const bySegment = r[period];
      const total = SEGMENTS.reduce((sum, seg) => sum + (bySegment[seg] || 0), 0);
      return { userId: r.userId, name: r.name, total, bySegment };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
