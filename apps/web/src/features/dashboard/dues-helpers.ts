/** Types for the Collection Dues card + its per-bucket drill-down.
 *  Aging is "as of today" (oldest unpaid invoice/opening balance), the same
 *  rule the mobile SE dues view uses — see apps/api/src/services/dues.ts. */

/** A band key — the enterprise's dues-band ordinal as a string (server-driven,
 *  variable count), not the legacy fixed 4. */
export type DuesBucketKey = string;

export interface DuesBucket {
  key: DuesBucketKey;
  label: string;
  customers: number;
  outstanding: number;
  fromDays?: number;
  toDays?: number | null;
}

export interface DuesSummary {
  buckets: DuesBucket[];
  totalCustomers: number;
  totalOutstanding: number;
}

/** One customer in a bucket drill-down. Invoice-level ageing: `bandOutstanding`
 *  is their remaining aged into THIS band (rows sum to the bucket total);
 *  `totalOutstanding` is their whole balance. `bandOldestDate`/`bandAgeDays` are
 *  the oldest unpaid item within this band. */
export interface DuesCustomerRow {
  customerId: string;
  customerName: string;
  city: string;
  executiveName: string;
  bandOldestDate: string;
  bandAgeDays: number;
  bandOutstanding: number;
  totalOutstanding: number;
}

/** Subtle severity accent graded by a band's POSITION (newest = coolest, oldest
 *  = hottest), so it works for any number of server-driven bands — matching the
 *  finance cards' border-l language. */
const ACCENT_STOPS = [
  "border-l-emerald-300",
  "border-l-lime-300",
  "border-l-yellow-300",
  "border-l-amber-300",
  "border-l-orange-300",
  "border-l-rose-300",
] as const;

export function accentForIndex(index: number, total: number): string {
  if (total <= 1) return ACCENT_STOPS[0];
  const pos = Math.round((index / (total - 1)) * (ACCENT_STOPS.length - 1));
  return ACCENT_STOPS[Math.max(0, Math.min(ACCENT_STOPS.length - 1, pos))];
}
