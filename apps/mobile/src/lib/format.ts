const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  neft_rtgs: "NEFT/RTGS",
};

/** Display label for a payment mode code (e.g. "cash" → "Cash", "upi" → "UPI"). */
export function formatPaymentMode(mode: string | null | undefined): string {
  if (!mode) return "";
  return PAYMENT_MODE_LABELS[mode] ?? mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** Pack-size label: sub-litre packs read in mL, else litres (e.g. 0.5 → "500 mL", 7.5 → "7.5 L"). */
export function packLabel(litres: number): string {
  return litres > 0 && litres < 1 ? `${Math.round(litres * 1000)} mL` : `${litres} L`;
}

/** Capitalize a server status for display (e.g. "verified" → "Verified"). */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Compact Indian-rupee amount for narrow columns: ₹12.1L, ₹1.2Cr, ₹8.5k, ₹450.
 * Lakhs/crores keep one decimal; crores drop it past ₹100Cr.
 */
export function compactInr(n: number): string {
  const v = Math.round(Math.max(0, n));
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}k`;
  return `₹${v}`;
}
