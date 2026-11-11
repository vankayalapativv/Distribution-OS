import type { ErrorSource, ErrorStatus } from "./errors-api";

export const SOURCE_STYLE: Record<ErrorSource, string> = {
  api: "bg-violet-100 text-violet-700",
  web: "bg-sky-100 text-sky-700",
  mobile: "bg-amber-100 text-amber-700",
};

export const STATUS_STYLE: Record<ErrorStatus, string> = {
  open: "bg-red-100 text-red-700",
  resolved: "bg-emerald-100 text-emerald-700",
  ignored: "bg-slate-100 text-slate-600",
};

/** Compact "3m ago" / "2h ago" / "5d ago" / date for the tables. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 7) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
