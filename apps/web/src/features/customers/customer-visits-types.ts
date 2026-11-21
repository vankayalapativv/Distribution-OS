/** Types + constants for the customer Visits tab. */

export interface VisitRef {
  id: string;
  code: string;
}
export interface VisitRow {
  id: string; visitDate: string | null; checkInTime: string | null;
  checkOutTime: string | null; durationMinutes: number | null; noOutcomeReason: string | null;
  executiveName: string;
  /** Visitor's role code (SUPER_ADMIN, SALES_EXECUTIVE, …) for the "Visited by" badge. */
  executiveRole: string;
  type: string; orders: VisitRef[]; collections: VisitRef[]; marketIntelCount: number;
}
/** All-time visit stats for one visitor role, driving the split chips. */
export interface VisitRoleStat {
  total: number;
  productive: number;
  avgDurationMinutes: number | null;
}
export interface MissedRow {
  date: string | null;
  /** 7 PM IST instant the beat was settled — drives display time + sequence. */
  at: string | null;
  executiveName: string;
  /** Real check-ins (same range) newer than this row, for page placement. */
  newer: number;
}
export interface VisitsData {
  summary: { today: number; week: number; month: number; all: number };
  rows: VisitRow[]; total: number; productive: number; page: number; pageSize: number;
  /** Avg time-spent (min) over the range, excluding auto-closed visits; null if none. */
  avgDurationMinutes?: number | null;
  /** All-time avg-time + productivity split by visitor role (executive vs admin). */
  byRole?: { executive: VisitRoleStat; admin: VisitRoleStat };
  missedRows?: MissedRow[];
}

export type PresetKey = "today" | "week" | "month" | "all" | "custom";
export const ISO = "yyyy-MM-dd";
export const PAGE_SIZE = 8;

/** One rendered row of the visits feed — a real check-in or a missed beat. */
export type FeedRow =
  | { kind: "visit"; ts: number; visit: VisitRow }
  | { kind: "missed"; ts: number; missed: MissedRow };

export const TILES: { key: PresetKey; label: string; pick: keyof VisitsData["summary"] }[] = [
  { key: "today", label: "Today", pick: "today" },
  { key: "week", label: "This week", pick: "week" },
  { key: "month", label: "This month", pick: "month" },
  { key: "all", label: "All-time", pick: "all" },
];

/** Per-column skeleton shapes, mirroring the real Date/Time/Visited-by/Type/Outcome cells. */
export const SKELETON_COLS: { key: string; block: string; sub?: string }[] = [
  { key: "when", block: "h-4 w-36", sub: "h-3 w-16" },
  { key: "duration", block: "h-4 w-24" },
  { key: "visited-by", block: "h-4 w-28", sub: "h-4 w-16 rounded-full" },
  { key: "type", block: "h-5 w-16 rounded-full" },
  { key: "outcome", block: "h-5 w-20 rounded-full" },
];

/** Stable keys for the fixed-length loading skeleton rows (avoids index-as-key). */
export const SKELETON_ROW_KEYS: string[] = Array.from({ length: PAGE_SIZE }, (_, i) => `skeleton-row-${i}`);
