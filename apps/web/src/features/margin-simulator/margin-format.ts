/** Margin colour cue: negative = red, thin (<₹5/L) = amber, else green. */
export function marginTone(marginPerLiter: number): string {
  if (marginPerLiter < 0) return "text-red-700";
  if (marginPerLiter < 5) return "text-amber-700";
  return "text-green-700";
}

/** ₹ whole-number (per-pack margins). */
export function inrPack(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** ₹ with 2 decimals (per-litre margins). */
export function inrLitre(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Keep only digits + a single decimal point (prices, pack sizes). */
export function numericInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const i = cleaned.indexOf(".");
  return i === -1 ? cleaned : cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, "");
}
