import { rupeesExact } from "@/lib/format";
import { Shimmer } from "@/components/ui/shimmer";
import { type DuesBucket } from "./dues-helpers";

/** Grid placement so the FOUR bands sit on the four sides of the centre, by
 *  position: newest at top, then right, bottom, oldest at left. The dues model
 *  is fixed at exactly 4 bands (ranges + labels are per-enterprise). */
export const POS = [
  "col-start-2 row-start-1", // 0 — top (newest)
  "col-start-3 row-start-2", // 1 — right
  "col-start-2 row-start-3", // 2 — bottom
  "col-start-1 row-start-2", // 3 — left (oldest)
] as const;

/** Label-less shimmer tiles shown before any data (band labels are server-driven,
 *  so they aren't known until the summary loads). Always 4 — the fixed model. */
export const PLACEHOLDER_BUCKETS: DuesBucket[] = Array.from({ length: 4 }, (_, i) => ({
  key: `__ph${i}`,
  label: "",
  outstanding: 0,
  customers: 0,
}));

export function BucketTile({
  bucket,
  accent,
  posClass,
  onOpen,
  loading,
}: Readonly<{
  bucket: DuesBucket;
  accent: string;
  posClass: string;
  onOpen: (b: DuesBucket) => void;
  loading?: boolean;
}>) {
  const isPlaceholder = !bucket.label;
  return (
    <button
      type="button"
      onClick={() => onOpen(bucket)}
      disabled={loading || isPlaceholder}
      className={`rounded-lg border border-l-4 border-border bg-white p-3 text-left shadow-sm transition-colors hover:border-primary disabled:hover:border-border ${accent} ${posClass}`}
    >
      {isPlaceholder ? (
        <Shimmer className="h-3 w-20" />
      ) : (
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
      )}
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
