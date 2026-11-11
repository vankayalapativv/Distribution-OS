import type { ExpenditureSummary } from "./expenditures-api";

/**
 * Slice colours carry the compulsory/variable distinction: blues for the fixed
 * overheads, slate greys for variable spend — matching the type pills used in
 * the table. Shades are handed out in descending-amount order within each type.
 */
const COMPULSORY_SHADES = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];
const VARIABLE_SHADES = ["#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];
const OTHER_COLOR = "#a1a1aa";

/** Categories charted individually before the rest roll into "Other". */
const TOP_N = 10;

export interface Slice {
  key: string;
  name: string;
  amount: number;
  /** Recharts picks the slice colour straight off the datum. */
  fill: string;
}

/** Top-N categories as individual slices (type-coloured), the rest as "Other". */
export function buildSlices(categories: ExpenditureSummary["categories"]): Slice[] {
  // The API already returns categories sorted by amount desc.
  const top = categories.slice(0, TOP_N);
  const rest = categories.slice(TOP_N);

  let compulsoryUsed = 0;
  let variableUsed = 0;
  const slices: Slice[] = top.map((c) => {
    const palette = c.type === "compulsory" ? COMPULSORY_SHADES : VARIABLE_SHADES;
    const index = c.type === "compulsory" ? compulsoryUsed++ : variableUsed++;
    return { key: c.categoryId, name: c.categoryName, amount: c.amount, fill: palette[index % palette.length] };
  });

  if (rest.length > 0) {
    slices.push({
      key: "__other__",
      name: `Other (${rest.length})`,
      amount: rest.reduce((acc, c) => acc + c.amount, 0),
      fill: OTHER_COLOR,
    });
  }

  return slices;
}
