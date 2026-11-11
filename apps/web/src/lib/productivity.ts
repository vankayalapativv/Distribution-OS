/**
 * Productivity % → a colour on a continuous red→amber→green scale (0 = bad,
 * 100 = top): hue slides 0° (red) to 120° (green), so 50% lands on amber. A
 * light tinted background + darker same-hue text, so the pill reads at a glance.
 * Shared by the dashboard drill-downs and the customer Visits tab so the pill
 * looks identical everywhere — and matches the mobile app's pill exactly.
 */
export function productivityColor(pct: number): { bg: string; fg: string } {
  const hue = Math.max(0, Math.min(120, (pct / 100) * 120));
  return { bg: `hsl(${hue}, 68%, 92%)`, fg: `hsl(${hue}, 72%, 30%)` };
}
