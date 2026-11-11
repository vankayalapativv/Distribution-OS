"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AttendanceGridRow as Row } from "./attendance-api";
import type { EditTarget } from "./attendance-cell-dialog";
import { AttendanceGridRow } from "./attendance-grid-row";

export interface DayMeta {
  d: string;
  day: number;
  initial: string;
  sunday: boolean;
}

const TOTAL_HEADS = ["Hrs", "Km", "Days"];

/** The scrollable matrix: weekday+date header, one row per SE, per-SE totals, skeleton + empty. */
export function AttendanceGridTable({
  dayMeta,
  rows,
  today,
  isLoading,
  canEdit,
  onEdit,
}: Readonly<{
  dayMeta: DayMeta[];
  rows: Row[];
  today: string;
  isLoading: boolean;
  canEdit: boolean;
  onEdit: (t: EditTarget) => void;
}>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 border-b border-r border-border bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sales Executive
            </th>
            {dayMeta.map((dm) => (
              <th
                key={dm.d}
                className={cn(
                  "border-b border-l border-border py-1.5 text-center align-middle",
                  dm.sunday ? "bg-muted/60" : "bg-card",
                  dm.d === today && "bg-primary/10",
                )}
                style={{ minWidth: 32 }}
              >
                <div className={cn("text-[9px] font-medium tracking-wide", dm.d === today ? "text-primary" : "text-muted-foreground/70")}>
                  {dm.initial}
                </div>
                <div className={cn("font-mono text-[11px] font-semibold tabular-nums", dm.d === today && "text-primary")}>
                  {dm.day}
                </div>
              </th>
            ))}
            {TOTAL_HEADS.map((h) => (
              <th
                key={h}
                className="border-b border-l border-border bg-card px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, r) => (
                <tr key={r}>
                  <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  {dayMeta.map((dm) => (
                    <td key={dm.d} className="border-b border-l border-border p-1.5 text-center">
                      <Skeleton className="mx-auto h-7 w-full" />
                    </td>
                  ))}
                  {[0, 1, 2].map((i) => (
                    <td key={i} className="border-b border-l border-border px-3 py-2.5">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <AttendanceGridRow key={row.userId} row={row} today={today} canEdit={canEdit} onEdit={onEdit} />
              ))}
          {!isLoading && rows.length === 0 ? (
            <tr>
              <td colSpan={(dayMeta.length || 1) + 4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                No active sales executives.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
