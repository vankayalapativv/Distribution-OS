/**
 * Client-safe billing price formatting. The amount an enterprise pays comes from
 * its own `enterprise_billing_config` (per-seat OR flat, with its GST rate), set
 * by the platform owner at approval — never a hardcoded ₹708. These helpers turn
 * that config into the labels the billing card, blocked screen and receipt show.
 */

export interface BillingConfigV2 {
  model: "per_seat" | "flat";
  /** Per-seat GST-inclusive amount in paisa (per_seat model), else null. */
  unitAmountPaisa: number | null;
  /** Flat monthly GST-inclusive amount in paisa (flat model), else null. */
  flatAmountPaisa: number | null;
  /** GST rate in basis points (1800 = 18%). */
  gstRateBp: number;
}

const inr = (paisa: number): string => `₹${(paisa / 100).toLocaleString("en-IN")}`;

const gstPct = (bp: number): string =>
  `${(bp / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

/** The bare rate, e.g. "₹708 per active user" or "₹5,000 flat". */
export function rateLabel(config: BillingConfigV2 | null): string {
  if (!config) return "—";
  if (config.model === "flat") return `${inr(config.flatAmountPaisa ?? 0)} flat`;
  return `${inr(config.unitAmountPaisa ?? 0)} per active user`;
}

/** Full subtitle for the current period's charge (seats shown for per-seat). */
export function chargeSubtitle(config: BillingConfigV2 | null, seats: number): string {
  if (!config) return "Billing not set up";
  const gst = `incl. ${gstPct(config.gstRateBp)} GST`;
  if (config.model === "flat") return `${inr(config.flatAmountPaisa ?? 0)} flat · ${gst}`;
  return `${inr(config.unitAmountPaisa ?? 0)} × ${seats} active user${seats === 1 ? "" : "s"} · ${gst}`;
}
