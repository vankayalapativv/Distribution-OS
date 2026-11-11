"use client";

import type { ActionConfig } from "@/lib/api-client";
import { AuthImage, fmtTime } from "./logistics-media";
import type { RunStop } from "./logistics-run-types";

/** The stop-by-stop timeline for a run: each customer visit with its proof photos. */
export function RunStops({
  config,
  stops,
  onOpenPhoto,
}: {
  readonly config: ActionConfig;
  readonly stops: RunStop[];
  readonly onOpenPhoto: (photoId: string, caption: string) => void;
}) {
  if (stops.length === 0) {
    return <p className="text-sm text-muted-foreground">No delivery stops recorded on this run.</p>;
  }
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {stops.length} delivery stop{stops.length === 1 ? "" : "s"}
      </div>
      <div className="flex flex-col">
        {stops.map((s, i) => (
          <div key={s.stopId} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
              {i < stops.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className="mb-3 flex-1 rounded-md border border-border bg-white p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{s.customerName ?? "—"}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(s.createdAt)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-muted-foreground">
                <span className="font-mono">{s.customerCode ?? ""}</span>
                {s.latitude != null && s.longitude != null && (
                  <a href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    View on map
                  </a>
                )}
              </div>
              {s.photos.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {s.photos.map((p, idx) => (
                    <AuthImage
                      key={p.id}
                      config={config}
                      photoId={p.id}
                      className="h-11 w-14 cursor-pointer rounded border border-border object-cover"
                      onClick={() => onOpenPhoto(p.id, `${s.customerName ?? ""} — photo ${idx + 1}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
