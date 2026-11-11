"use client";

/**
 * Context-aware shimmer skeletons for the dashboard. Each skeleton mirrors the
 * shape of the real component it stands in for (card grid, table rows, chart
 * bars) so a load reads as "this exact thing is arriving", not a generic blur.
 * The sweep uses the `dash-shimmer` keyframe defined in globals.css.
 */
import { Shimmer } from "@/components/ui/shimmer";
import { TD } from "./analytics-shared";

// Re-exported so existing dashboard imports (`./dashboard-skeletons`) keep working
// off the single shared primitive.
export { Shimmer };

/** Six metric-card placeholders matching the MetricsCards grid + card anatomy. */
export function SkeletonCards() {
  return (
    <section aria-label="Loading metrics" className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-l-4 border-border bg-white p-5">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="mt-3.5 h-8 w-20" />
          <Shimmer className="mt-2.5 h-3 w-32" />
        </div>
      ))}
    </section>
  );
}

export interface SkelCol {
  /** Tailwind width for the cell block, e.g. "w-24". */
  w: string;
  /** Right-align (numeric columns) so the shimmer sits where the number will. */
  right?: boolean;
}

/** Skeleton table body — `rows` rows of shimmer cells mirroring `cols`. Render
 *  inside the real <table> so the live column headers stay visible. */
export function SkeletonRows({ cols, rows = 6 }: { readonly cols: SkelCol[]; readonly rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => `r${r}`).map((rowKey) => (
        <tr key={rowKey} className="border-b border-border/60">
          {cols.map((c, i) => ({ c, key: `${rowKey}-c${i}` })).map(({ c, key }) => (
            <td key={key} className={TD}>
              <Shimmer className={`h-4 ${c.w} ${c.right ? "ml-auto" : ""}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Bar-chart placeholder — staggered bars over a baseline, matching the trend chart. */
export function SkeletonChart() {
  const heights = [45, 70, 55, 90, 65, 80];
  return (
    <div className="flex h-[220px] items-end gap-3 px-6 pb-8 pt-4" aria-label="Loading chart">
      {heights.map((h, i) => (
        <Shimmer key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
