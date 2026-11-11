/**
 * Types for the Incentives feature (GET /incentives, PUT /incentives/:userId).
 * Incentives are classified into Collections and Targets:
 *  - Collections: monthly verified collections × a per-SE % → payout.
 *  - Targets "per month": hit a monthly litre target → a flat reward.
 *  - Targets "per litre": monthly oil litres × a per-SE ₹/litre rate → payout.
 * All monthly. The %/rates/targets are entered by SA / Manager / Accountant.
 */

export interface IncentiveRow {
  userId: string;
  name: string;
  /** Verified collections that month (collector-attributed, by approved month). */
  collectionsTotal: number;
  /** Oil litres sold that month (orders, net of returns). */
  litresTotal: number;
  // Manually-entered knobs (null when unset):
  collectionPct: number | null;
  perLitreRate: number | null;
  targetLitres: number | null;
  targetReward: number | null;
  // Computed payouts:
  collectionsIncentive: number;
  perLitreIncentive: number;
  targetMet: boolean;
  targetIncentive: number;
  totalIncentive: number;
}

export interface IncentivesResponse {
  period: { month: string; label: string; isCurrent: boolean };
  executives: IncentiveRow[];
}

export interface IncentiveUpsertBody {
  month: string;
  collectionPct: number | null;
  perLitreRate: number | null;
  targetLitres: number | null;
  targetReward: number | null;
}
