// Pure billing helpers for the owner cockpit. Storage stays GST-INCLUSIVE; the
// owner enters/edits the taxable BASE, so these convert both ways for display and
// derive the free-period payload the API expects.

export const COCKPIT_GST_BP = 1800; // fixed 18% GST

/** GST-inclusive paisa for a taxable base (base × (1 + gst/10000)). */
export function inclusivePaisa(basePaisa: number, gstBp = COCKPIT_GST_BP): number {
  return Math.round(Math.max(0, Math.trunc(basePaisa)) * (1 + gstBp / 10000));
}

/** Back out the taxable base (paisa) from a stored GST-inclusive amount. */
export function basePaisaFromInclusive(inclusivePaisaVal: number | null | undefined, gstBp = COCKPIT_GST_BP): number {
  if (!inclusivePaisaVal || inclusivePaisaVal <= 0) return 0;
  return Math.round(inclusivePaisaVal / (1 + gstBp / 10000));
}

const inr = (p: number) =>
  `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** "₹999 + 18% GST (₹179.82) = ₹1,178.82" for a base price in RUPEES. */
export function gstBreakdown(baseRupees: number, gstBp = COCKPIT_GST_BP): { base: string; gst: string; total: string } {
  const basePaisa = Math.round((Number.isFinite(baseRupees) ? baseRupees : 0) * 100);
  const total = inclusivePaisa(basePaisa, gstBp);
  return { base: inr(basePaisa), gst: inr(total - basePaisa), total: inr(total) };
}

// Free-period modes the cockpit offers, and their {freeMonths, freeForever}
// payloads. `months` is whole free months from the current month: 0 = bill now,
// 1 = rest of this month, N = N months; `forever` = open-ended.
export type FreeMode = "immediate" | "this_month" | "n_months" | "forever";

export function freePayload(mode: FreeMode, nMonths = 2): { freeMonths?: number; freeForever?: boolean } {
  switch (mode) {
    case "forever":
      return { freeForever: true };
    case "this_month":
      return { freeMonths: 1, freeForever: false };
    case "n_months":
      return { freeMonths: Math.max(1, Math.trunc(nMonths) || 1), freeForever: false };
    case "immediate":
    default:
      return { freeMonths: 0, freeForever: false };
  }
}

/** Best-effort read of an enterprise's current free setting into a FreeMode (for
 *  prefilling the editor). We can only distinguish forever vs not from the flags;
 *  a set `freeUntil` reads back as a time-boxed period (shown as "n_months"). */
export function freeModeFromConfig(cfg: { freeForever?: boolean; freeUntil?: string | null } | null | undefined): FreeMode {
  if (cfg?.freeForever) return "forever";
  if (cfg?.freeUntil) return "n_months";
  return "immediate";
}
