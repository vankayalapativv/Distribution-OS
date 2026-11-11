import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

const ISO = "yyyy-MM-dd";
/** Lower bound for the "All time" preset — comfortably before any real data. */
const ALL_FROM = "2015-01-01";

export type LedgerPreset =
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "this-fy"
  | "all"
  | "custom";

export const PRESETS: { key: Exclude<LedgerPreset, "custom">; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3-months", label: "Last 3 months" },
  { key: "this-fy", label: "This FY" },
  { key: "all", label: "All time" },
];

/** Financial year starts 1 April (India). */
export function fyStart(today: Date): Date {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(y, 3, 1);
}

/** The concrete { from, to } (yyyy-MM-dd) for a preset. */
export function presetRange(p: Exclude<LedgerPreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const to = format(today, ISO);
  switch (p) {
    case "this-month":
      return { from: format(startOfMonth(today), ISO), to };
    case "last-month": {
      const m = subMonths(today, 1);
      return { from: format(startOfMonth(m), ISO), to: format(endOfMonth(m), ISO) };
    }
    case "last-3-months":
      return { from: format(startOfMonth(subMonths(today, 2)), ISO), to };
    case "this-fy":
      return { from: format(fyStart(today), ISO), to };
    case "all":
      return { from: ALL_FROM, to };
  }
}

/** Human label for the trigger button given the applied range + preset. */
export function triggerLabel(from: string, to: string, preset: LedgerPreset): string {
  if (preset === "all") return "All time";
  if (!from || !to) return "Pick a range";
  return `${format(parseISO(from), "dd MMM yyyy")} – ${format(parseISO(to), "dd MMM yyyy")}`;
}
