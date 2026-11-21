import { format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import {
  ISO, PAGE_SIZE,
  type FeedRow, type MissedRow, type PresetKey, type VisitRoleStat, type VisitRow, type VisitsData,
} from "./customer-visits-types";

export * from "./customer-visits-types";

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
