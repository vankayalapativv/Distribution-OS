import { format, parseISO, startOfMonth, startOfWeek } from "date-fns";

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

/** Friendly label for a visitor's role code (Visited-by badge). */
export function visitorRoleLabel(code: string): string {
  switch (code) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "SALES_EXECUTIVE":
      return "Executive";
    case "MANAGER":
      return "Manager";
    case "ACCOUNTANT":
      return "Accountant";
    case "LOGISTICS":
      return "Logistics";
    default:
      return "—";
  }
}

/** True for a Super-Admin visit (drives the badge colour + the admin chip bucket). */
export const isAdminRole = (code: string): boolean => code === "SUPER_ADMIN";

/** Productivity % (productive ÷ total) for one role's all-time stat, or null when
 *  that role has no visits. */
export function roleProductivityPct(stat: VisitRoleStat | undefined): number | null {
  return stat && stat.total > 0 ? Math.round((stat.productive / stat.total) * 100) : null;
}

/** Epoch ms for ordering a row: prefer its timestamp, else the date at midnight. */
export function tsOf(iso: string | null, date: string | null): number {
  if (iso) return new Date(iso).getTime();
  if (date) return parseISO(date).getTime();
  return 0;
}

export function presetRange(k: PresetKey): { from: string | null; to: string | null } {
  const today = new Date();
  const to = format(today, ISO);
  if (k === "today") return { from: to, to };
  if (k === "week") return { from: format(startOfWeek(today, { weekStartsOn: 1 }), ISO), to };
  if (k === "month") return { from: format(startOfMonth(today), ISO), to };
  return { from: null, to: null };
}

/** Split a visit's timestamp into a bold date + a muted clock time for the cell. */
export function whenParts(iso: string | null, date: string | null): { date: string; time: string } {
  if (iso) {
    const d = new Date(iso);
    return { date: format(d, "EEE, dd MMM yyyy"), time: format(d, "h:mm a") };
  }
  return { date: date ? format(parseISO(date), "EEE, dd MMM yyyy") : "—", time: "" };
}

/** "10:00 AM → 10:24 AM" when checked out, else just the check-in time ("10:00 AM"). */
export function timeRange(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return "";
  const start = format(new Date(checkIn), "h:mm a");
  return checkOut ? `${start} → ${format(new Date(checkOut), "h:mm a")}` : start;
}

/** Human time-spent: "24 min" / "1 h 05 m", or "—" when NULL (auto-closed or still open). */
export function durationLabel(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")} m`;
}

export const pageCountOf = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE));

/** Productivity % (productive ÷ total) for the range, or null with no visits. */
export function productivityPct(data: VisitsData | undefined): number | null {
  return data && data.total > 0 ? Math.round((data.productive / data.total) * 100) : null;
}

/** The missed-beat rows that fall on the current page (by their `newer` count). */
export function missedForPage(missedRows: MissedRow[], pageCount: number, page: number): MissedRow[] {
  return missedRows.filter((m) => Math.min(Math.floor(m.newer / PAGE_SIZE) + 1, pageCount) === page);
}

/** Merge a page's real visits + missed rows into one newest-first feed. */
export function buildFeed(rows: VisitRow[], pageMissed: MissedRow[]): FeedRow[] {
  return [
    ...rows.map((v): FeedRow => ({ kind: "visit", ts: tsOf(v.checkInTime, v.visitDate), visit: v })),
    ...pageMissed.map((m): FeedRow => ({ kind: "missed", ts: tsOf(m.at, m.date), missed: m })),
  ].sort((a, b) => b.ts - a.ts);
}
