"use client";

import type { TrackedExecutive } from "./tracking-api";
import { batterySummary, distanceSummary, fmtTime, healthReasons, timeAgo } from "./tracking-helpers";

/** The selected executive's detail footer: last-seen, battery, health, distance, day span. */
export function TrackingExecutiveDetail({
  selected, routePointCount,
}: {
  readonly selected: TrackedExecutive;
  readonly routePointCount: number;
}) {
  const battery = batterySummary(selected);
  const reasons = healthReasons(selected);
  const distance = distanceSummary(selected);

  return (
    <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border bg-slate-50/60 px-4 py-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{selected.name}</p>
      <p className="mt-1">
        <span>{selected.locationLabel ?? "Latest known location"}</span>: {timeAgo(selected.lastRecordedAt)}
      </p>
      {battery && <p className="mt-1" suppressHydrationWarning>{battery}</p>}
      {reasons.length > 0 && <p className="mt-1 text-red-700">{reasons.join(" · ")}</p>}
      {distance && (
        <>
          <p className="mt-1 font-medium text-foreground">{distance.total}</p>
          <p className="mt-0.5">{distance.quality}</p>
        </>
      )}
      <p className="mt-1">
        Day started {fmtTime(selected.startedAt)}
        {selected.endedAt ? ` · ended ${fmtTime(selected.endedAt)}` : " · still on"}
      </p>
      <p className="mt-0.5">Route shown: {routePointCount} point{routePointCount === 1 ? "" : "s"}</p>
    </div>
  );
}
