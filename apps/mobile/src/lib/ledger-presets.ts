/**
 * Date-range presets for the customer ledger (mirror the web ledger). The full
 * all-time statement is fetched once, then sliced to one of these ranges
 * on-device — switching a preset is instant (no refetch). FY starts 1 April.
 */
export type PresetKey = "this-month" | "last-month" | "last-3-months" | "this-fy" | "all";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3-months", label: "Last 3 months" },
  { key: "this-fy", label: "This FY" },
  { key: "all", label: "All time" },
];

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Concrete { from, to } for a preset. FY starts 1 April (India). */
export function presetRange(p: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "this-month":
      return { from: ymd(new Date(y, m, 1)), to: today };
    case "last-month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "last-3-months":
      return { from: ymd(new Date(y, m - 2, 1)), to: today };
    case "this-fy": {
      const fyStartYear = m >= 3 ? y : y - 1; // April = month index 3
      return { from: `${fyStartYear}-04-01`, to: today };
    }
    case "all":
      return { from: "2000-01-01", to: today };
  }
}
