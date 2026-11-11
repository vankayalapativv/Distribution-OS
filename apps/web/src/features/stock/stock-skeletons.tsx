"use client";

import { useMemo } from "react";
import { Shimmer } from "@/components/ui/shimmer";

/** A table-cell shimmer spec: bar width, alignment, and an optional second
 *  (meta) line so a skeleton cell mirrors a real name+meta stack. */
export interface SkCell { w: string; align?: "right"; stack?: string }

/** Stable, non-index keys for a fixed-length placeholder list. */
function useKeys(count: number): string[] {
  return useMemo(() => Array.from({ length: count }, () => crypto.randomUUID()), [count]);
}

/** Shimmer `<tr>` rows for a table — dropped into an existing `<tbody>` so the
 *  real `<thead>` stays visible and the sweep mirrors the live columns. */
export function SkRows({ cells, rows }: Readonly<{ cells: SkCell[]; rows: number }>) {
  const rowKeys = useKeys(rows);
  const cellKeys = useKeys(cells.length);
  return (
    <>
      {rowKeys.map((rk) => (
        <tr key={rk} className="border-b border-border/60 last:border-0">
          {cells.map((c, i) => (
            <td key={cellKeys[i]} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
              <div className={`flex flex-col gap-2 ${c.align === "right" ? "items-end" : ""}`}>
                <Shimmer className={`h-5 ${c.w}`} />
                {c.stack && <Shimmer className={`h-3 ${c.stack}`} />}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Compact FEFO "Expiring soon" list shimmer — stripe · days · name/meta · qty. */
export function ExpiringSkeleton({ rows = 5 }: Readonly<{ rows?: number }>) {
  const keys = useKeys(rows);
  return (
    <div>
      {keys.map((k) => (
        <div key={k} className="flex items-stretch gap-3 border-b border-border px-4 py-3 last:border-0">
          <Shimmer className="w-1 rounded-full" />
          <Shimmer className="h-5 w-20 self-center" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 self-center">
            <Shimmer className="h-5 w-44" />
            <Shimmer className="h-3 w-64 max-w-full" />
          </div>
          <Shimmer className="h-5 w-8 self-center" />
        </div>
      ))}
    </div>
  );
}

/** Activity-feed shimmer — kind pill · primary/secondary · date. */
export function ActivitySkeleton({ rows = 6 }: Readonly<{ rows?: number }>) {
  const keys = useKeys(rows);
  return (
    <div>
      {keys.map((k) => (
        <div key={k} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
          <Shimmer className="h-5 w-[70px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Shimmer className="h-5 w-52 max-w-full" />
            <Shimmer className="h-3 w-36" />
          </div>
          <Shimmer className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
