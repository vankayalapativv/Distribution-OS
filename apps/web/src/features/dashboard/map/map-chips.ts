/** Small staleness "pills" (label + text/background colour) for the map popups. */
export interface ChipStyle {
  label: string;
  fg: string;
  bg: string;
}

const CHIP_TONE = {
  green: { fg: "#15803d", bg: "#dcfce7" }, // green-700 on green-100
  orange: { fg: "#c2410c", bg: "#ffedd5" }, // orange-700 on orange-100
  red: { fg: "#b91c1c", bg: "#fee2e2" }, // red-700 on red-100
} as const;

function agoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Last-order chip: green ≤21 days, orange 22–30, red 31+; red "No orders yet" if never. */
export function orderChip(days: number | null): ChipStyle {
  if (days == null) return { label: "No orders yet", ...CHIP_TONE.red };
  let tone: (typeof CHIP_TONE)[keyof typeof CHIP_TONE] = CHIP_TONE.red;
  if (days <= 21) tone = CHIP_TONE.green;
  else if (days <= 30) tone = CHIP_TONE.orange;
  return { label: `Last order ${agoLabel(days)}`, ...tone };
}

/** Last-collection chip: green ≤7 days, orange 8–14, red 15+; red "No collections yet" if never. */
export function collectionChip(days: number | null): ChipStyle {
  if (days == null) return { label: "No collections yet", ...CHIP_TONE.red };
  let tone: (typeof CHIP_TONE)[keyof typeof CHIP_TONE] = CHIP_TONE.red;
  if (days <= 7) tone = CHIP_TONE.green;
  else if (days <= 14) tone = CHIP_TONE.orange;
  return { label: `Last collection ${agoLabel(days)}`, ...tone };
}
