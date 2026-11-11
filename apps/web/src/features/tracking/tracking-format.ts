import { formatLastSeen } from "@/lib/format";

/** "just now" / "N min ago" / "Nh Nm ago", falling back to a readable IST
 *  "last seen" (yesterday / dated) for anything older than a day. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return formatLastSeen(iso);
}

// Fixed locale + timezone so server and client render identical text (hydration).
const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/** "hh:mm am/pm" IST for a timestamp, or "—". */
export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return TIME_FMT.format(new Date(iso));
}
