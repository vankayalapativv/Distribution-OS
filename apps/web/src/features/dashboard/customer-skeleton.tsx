import { Shimmer } from "@/components/ui/shimmer";
import type { MetricKey } from "./metrics-helpers";

const ROW_BASE = "border-b border-border/50 px-3 py-2.5 last:border-b-0";

/** Context-aware loading placeholder — each metric's skeleton mirrors its real
 *  row layout (visits: name+time+pill+chip; litres/collections: name+sub+value). */
export function CustomerSkeleton({ metric }: Readonly<{ metric: MetricKey }>) {
  const rowKeys = Array.from({ length: 6 }, (_, i) => `skeleton-row-${i}`);

  if (metric === "visits" || metric === "productive" || metric === "productivity") {
    return (
      <div aria-hidden="true">
        {rowKeys.map((rowKey) => (
          <div key={rowKey} className={`flex flex-col gap-2 ${ROW_BASE}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3.5 w-44" />
                <Shimmer className="h-3 w-32" />
              </div>
              <Shimmer className="h-5 w-16 rounded-full" />
            </div>
            <Shimmer className="h-6 w-32 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (metric === "executives") {
    return (
      <div aria-hidden="true">
        {rowKeys.map((rowKey) => (
          <div key={rowKey} className={`flex items-center gap-3 ${ROW_BASE}`}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Shimmer className="h-3.5 w-24" />
              <Shimmer className="h-3 w-48" />
            </div>
            <Shimmer className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    );
  }

  // litres / ordered / collections — name + subtitle left, value (+ sub or pill) right
  return (
    <div aria-hidden="true">
      {rowKeys.map((rowKey) => (
        <div key={rowKey} className={`flex items-center gap-3 ${ROW_BASE}`}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-44" />
            <Shimmer className="h-3 w-36" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Shimmer className="h-4 w-16" />
            <Shimmer className={metric === "collections" ? "h-4 w-14 rounded-full" : "h-3 w-12"} />
          </div>
        </div>
      ))}
    </div>
  );
}
