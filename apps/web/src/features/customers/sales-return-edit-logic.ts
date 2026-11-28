export interface ReturnLine {
  orderItemId: string;
  kind: "oil";
  segment: string | null;
  description: string;
  unitPrice: number;
  returnableUnits: number;
}

export interface ReturnForEdit {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  returnDate: string;
  reason: string | null;
  availableOutstanding: number;
  lines: ReturnLine[];
  currentItems: { orderItemId: string; quantityUnits: number }[];
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** The label shown for a line's category (the oil segment). */
export function lineCategory(l: ReturnLine): string {
  return l.segment ?? "Oil";
}

/** A single line's return value for the entered qty (0 when blank/invalid). */
export function lineTotal(l: ReturnLine, qtyStr: string | undefined): number {
  const q = Number(qtyStr ?? "");
  return Number.isFinite(q) && q > 0 ? round2(q * l.unitPrice) : 0;
}

/** Sum of every line's return value. */
export function returnTotal(lines: ReturnLine[], qty: Record<string, string>): number {
  let t = 0;
  for (const l of lines) t += lineTotal(l, qty[l.orderItemId]);
  return round2(t);
}

/** Positive return items from the entered quantities. */
export function returnItems(lines: ReturnLine[], qty: Record<string, string>) {
  return lines
    .map((l) => ({ orderItemId: l.orderItemId, quantityUnits: Number(qty[l.orderItemId] ?? "") }))
    .filter((it) => Number.isFinite(it.quantityUnits) && it.quantityUnits > 0);
}

/** True when the return total exceeds what the invoice still owes. */
export function isOverCap(total: number, available: number): boolean {
  return total > available + 0.005;
}

/** True when any line's entered quantity exceeds that line's returnable units.
 *  The qty input's HTML `max` doesn't stop a typed/pasted over-value, so the
 *  form gate must check it (the server also rejects, this surfaces it inline). */
export function hasOverReturnable(lines: ReturnLine[], qty: Record<string, string>): boolean {
  return lines.some((l) => {
    const q = Number(qty[l.orderItemId] ?? "");
    return Number.isFinite(q) && q > l.returnableUnits;
  });
}

/** Seed the form fields from a loaded return. */
export function seedReturn(ret: ReturnForEdit): { date: string; reason: string; qty: Record<string, string> } {
  const qty: Record<string, string> = {};
  for (const it of ret.currentItems) qty[it.orderItemId] = String(it.quantityUnits);
  return { date: ret.returnDate.slice(0, 10), reason: ret.reason ?? "", qty };
}

/** Validate the return before submit. Returns an error string or null. */
export function validateReturn(itemCount: number, overCap: boolean, overReturnable = false): string | null {
  if (itemCount === 0) return "Enter a return quantity on at least one line.";
  if (overReturnable) return "A line's quantity is more than its returnable units.";
  if (overCap) return "Return total exceeds the invoice's outstanding balance.";
  return null;
}
