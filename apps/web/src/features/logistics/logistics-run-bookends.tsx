"use client";

import type { ActionConfig } from "@/lib/api-client";
import { AuthImage, fmtTime } from "./logistics-media";
import { distanceLabel, isActiveRun, runDuration } from "./logistics-run-format";
import type { OdometerPhoto, RunDetail } from "./logistics-run-types";

function odometerLabel(active: boolean, endOdometer: number | null): string {
  if (active) return "On the road";
  if (endOdometer != null) return `Odometer ${endOdometer.toLocaleString("en-IN")} km`;
  return "No odometer";
}

function OdoPhoto({ config, photo, fallback }: { readonly config: ActionConfig; readonly photo: OdometerPhoto | null; readonly fallback: string }) {
  if (photo) return <AuthImage config={config} photoId={photo.id} className="mt-2.5 h-24 w-full rounded-md border border-border object-cover" />;
  return (
    <div className="mt-2.5 grid h-24 place-items-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
      {fallback}
    </div>
  );
}

/** The Start / End bookend cards (times, odometers, odometer photos) + a
 *  duration/distance bar, for the run-detail drawer. */
export function RunBookends({ config, run }: { readonly config: ActionConfig; readonly run: RunDetail["run"] }) {
  const active = isActiveRun(run.status, run.endedAt);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-white p-3.5">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-green-700">● Start</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums">{fmtTime(run.startedAt)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {run.startOdometer != null ? `Odometer ${run.startOdometer.toLocaleString("en-IN")} km` : "No odometer"}
          </div>
          <OdoPhoto config={config} photo={run.startPhoto} fallback="No start photo" />
        </div>
        <div className="rounded-md border border-border bg-white p-3.5">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700">● End</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums">{active ? "—" : fmtTime(run.endedAt as string)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {odometerLabel(active, run.endOdometer)}
          </div>
          <OdoPhoto config={config} photo={run.endPhoto} fallback={active ? "Pending — run active" : "No end photo"} />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md border border-blue-100 bg-accent px-4 py-2.5 text-accent-foreground">
        <span className="text-sm">{active ? "Elapsed" : "Duration"} <b>{runDuration(run.startedAt, run.endedAt) ?? "—"}</b></span>
        <span className="text-lg font-bold tabular-nums">{distanceLabel(run.distanceKm)}</span>
      </div>
    </>
  );
}
