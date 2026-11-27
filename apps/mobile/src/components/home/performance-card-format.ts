/** Pure label/percent helpers for the performance card (kept UI-free so they
 *  test in the fast node project, and shared by the card body + its parts). */

export function litresLabel(v: number): string {
  return `${v.toLocaleString("en-IN")} L`;
}

export function rupeesLabel(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** Percent → fill colour (green on track, blue neutral, amber/red behind). */
export function barColor(pct: number): string {
  if (pct >= 100) return "bg-green-600";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

export function pctOf(actual: number, target: number | null): number | null {
  return target && target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
}
