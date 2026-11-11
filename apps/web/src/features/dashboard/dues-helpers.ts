/** Types for the Collection Dues card + its per-bucket drill-down.
 *  Aging is "as of today" (oldest unpaid invoice/opening balance), the same
 *  rule the mobile SE dues view uses — see apps/api/src/services/dues.ts. */

export type DuesBucketKey = "0_30" | "30_45" | "45_60" | "60_plus";

export interface DuesBucket {
  key: DuesBucketKey;
  label: string;
  customers: number;
  outstanding: number;
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

/** Subtle severity accent per bucket (older = hotter), matching the finance
 *  cards' border-l language. */
export const DUES_ACCENT: Record<DuesBucketKey, string> = {
  "0_30": "border-l-emerald-300",
  "30_45": "border-l-yellow-300",
  "45_60": "border-l-orange-300",
  "60_plus": "border-l-rose-300",
};
