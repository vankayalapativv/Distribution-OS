"use client";

import type { TrackedExecutive } from "./tracking-api";
import { statusDot, statusLabel, statusTone, timeAgo } from "./tracking-helpers";

/** One executive row in the Live-Tracking list: name, point count, last-seen, status pill. */
export function TrackingExecutiveRow({
  ex, selected, onSelect,
}: {
  readonly ex: TrackedExecutive;
  readonly selected: boolean;
  readonly onSelect: (userId: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(ex.userId)}
      className={`flex w-full items-start justify-between gap-2 border-b border-border px-4 py-3 text-left last:border-0 ${
        selected ? "bg-blue-50/70" : "hover:bg-accent/40"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{ex.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
          {ex.pointCount} points · {ex.locationLabel ?? "Latest known location"} {timeAgo(ex.lastRecordedAt)}
        </p>
      </div>
      <span
        suppressHydrationWarning
        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(ex)}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(ex)}`} />
        {statusLabel(ex)}
      </span>
    </button>
  );
}
