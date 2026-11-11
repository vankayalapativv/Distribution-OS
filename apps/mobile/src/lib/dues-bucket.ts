/**
 * Collection-dues ageing buckets (mirror of the API's DuesBucket). Maps a bucket
 * to its label + Tailwind colour classes for the beat-plan due chip, graded
 * emerald → amber → orange → red as the debt ages.
 */
export const DUES_BUCKETS = ["0_30", "30_45", "45_60", "60_plus"] as const;
export type DuesBucket = (typeof DUES_BUCKETS)[number];

export interface DueBucketMeta {
  label: string;
  short: string;
  textClass: string;
  bgClass: string;
}

const META: Record<DuesBucket, DueBucketMeta> = {
  "0_30": { label: "0–30 days", short: "0–30d", textClass: "text-emerald-700", bgClass: "bg-emerald-100" },
  "30_45": { label: "31–45 days", short: "31–45d", textClass: "text-amber-700", bgClass: "bg-amber-100" },
  "45_60": { label: "46–60 days", short: "46–60d", textClass: "text-orange-700", bgClass: "bg-orange-100" },
  "60_plus": { label: "61+ days", short: "61+d", textClass: "text-red-700", bgClass: "bg-red-100" },
};

export function dueBucketMeta(bucket: DuesBucket | null | undefined): DueBucketMeta | null {
  if (!bucket) return null;
  return META[bucket] ?? null;
}
