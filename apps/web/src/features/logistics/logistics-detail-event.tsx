"use client";

import { Download } from "lucide-react";
import type { ActionConfig } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { AuthImage, downloadPhoto, fmtTime } from "./logistics-media";
import type { DeliveryEvent } from "./logistics-api";

/** One delivery event (a stop) in the customer detail modal: header + photo grid. */
export function LogisticsDetailEvent({
  config,
  ev,
  customerName,
  onOpenPhoto,
}: {
  readonly config: ActionConfig;
  readonly ev: DeliveryEvent;
  readonly customerName: string;
  readonly onOpenPhoto: (photoId: string, caption: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="font-semibold">{formatDate(ev.date)} · {fmtTime(ev.createdAt)}</span>
        {ev.driverName && <span className="text-muted-foreground">Driver <span className="font-medium text-foreground">{ev.driverName}</span></span>}
        {ev.vehicleNumber && <span className="text-muted-foreground">Vehicle <span className="font-medium text-foreground">{ev.vehicleNumber}</span></span>}
        {ev.latitude != null && ev.longitude != null && (
          <a href={`https://www.google.com/maps?q=${ev.latitude},${ev.longitude}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">View on map</a>
        )}
      </div>
      {ev.photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
          {ev.photos.map((p, i) => (
            <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
              <AuthImage config={config} photoId={p.id} className="h-full w-full cursor-pointer object-cover"
                onClick={() => onOpenPhoto(p.id, `${customerName} — ${formatDate(ev.date)} · photo ${i + 1}`)} />
              <button onClick={() => void downloadPhoto(config, p.id, `delivery-${ev.date}-${i + 1}.jpg`)}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md bg-white/90 text-primary opacity-0 transition-opacity group-hover:opacity-100" title="Download">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-xs text-muted-foreground">No photos for this delivery.</p>}
    </div>
  );
}
