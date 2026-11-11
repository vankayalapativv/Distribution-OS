import { rupeesExact } from "@/lib/format";
import { Shimmer } from "@/components/ui/shimmer";
import { DUES_ACCENT, type DuesBucket, type DuesBucketKey } from "./dues-helpers";

/** Grid placement so the four buckets sit on the four sides of the centre. */
export const POS: Record<DuesBucketKey, string> = {
  "0_30": "col-start-2 row-start-1", // top
  "30_45": "col-start-3 row-start-2", // right
  "45_60": "col-start-2 row-start-3", // bottom
  "60_plus": "col-start-1 row-start-2", // left
};

export const BUCKET_KEYS: DuesBucketKey[] = ["0_30", "30_45", "45_60", "60_plus"];

/** The bucket labels are FIXED (ageing bands) — they never change with the
 *  executive/city filter, so they must stay put (never shimmer). Match the API. */
export const BUCKET_LABEL: Record<DuesBucketKey, string> = {
  "0_30": "0–30 days",
  "30_45": "31–45 days",
  "45_60": "46–60 days",
  "60_plus": "61+ days",
};

/** Constant-label buckets to render before any data has loaded — only the
 *  numbers shimmer; the labels are already in place. */
export const PLACEHOLDER_BUCKETS: DuesBucket[] = BUCKET_KEYS.map((key) => ({
  key,
  label: BUCKET_LABEL[key],
  outstanding: 0,
  customers: 0,
}));

export function BucketTile({
  bucket,
  onOpen,
  loading,
}: Readonly<{
  bucket: DuesBucket;
  onOpen: (b: DuesBucket) => void;
  loading?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={() => onOpen(bucket)}
      disabled={loading}
      className={`rounded-lg border border-l-4 border-border bg-white p-3 text-left shadow-sm transition-colors hover:border-primary disabled:hover:border-border ${DUES_ACCENT[bucket.key]} ${POS[bucket.key]}`}
    >
      {/* Label stays constant; only the amount + customer count shimmer. */}
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
      {loading ? (
        <>
          <Shimmer className="mt-1.5 h-5 w-24" />
          <Shimmer className="mt-1.5 h-3 w-20" />
        </>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{rupeesExact(bucket.outstanding)}</p>
          <p className="text-xs text-muted-foreground">
            {bucket.customers} customer{bucket.customers === 1 ? "" : "s"}
          </p>
        </>
      )}
    </button>
  );
}

/** The rose centre tile — total outstanding + how many customers owe. */
export function DuesTotalTile({
  outstanding,
  customers,
  loading,
}: Readonly<{
  outstanding: number;
  customers: number;
  loading?: boolean;
}>) {
  return (
    <div className="col-start-2 row-start-2 flex flex-col items-center justify-center rounded-lg bg-rose-50 p-3 text-center ring-1 ring-rose-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-rose-700/70">Total dues</p>
      {loading ? (
        <>
          <Shimmer className="mt-1.5 h-6 w-28" />
          <Shimmer className="mt-1.5 h-3 w-16" />
        </>
      ) : (
        <>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-rose-600">{rupeesExact(outstanding)}</p>
          <p className="text-xs font-semibold text-rose-500">{customers} owe</p>
        </>
      )}
    </div>
  );
}
