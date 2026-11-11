// Progress-tier colours shared by the target bars and the % label.

/** Fill colour for a completion bar by percentage tier. */
export function barColor(pct: number): string {
  if (pct >= 100) return "bg-green-600";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

/** Text colour for a completion percentage by tier. */
export function pctTextColor(pct: number): string {
  if (pct >= 100) return "text-green-600";
  if (pct >= 60) return "text-blue-600";
  if (pct >= 30) return "text-amber-600";
  return "text-red-600";
}
