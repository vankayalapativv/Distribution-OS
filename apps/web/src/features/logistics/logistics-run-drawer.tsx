"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { AuthImage, downloadPhoto } from "./logistics-media";
import { LogisticsStatusPill } from "./logistics-status-pill";
import { RunBookends } from "./logistics-run-bookends";
import { RunStops } from "./logistics-run-stops";
import type { RunDetail } from "./logistics-run-types";

/** Run-detail dialog: start/end bookends + the stop timeline, with a photo lightbox. */
export function LogisticsRunDrawer({
  actionConfig,
  openId,
  onClose,
}: {
  readonly actionConfig: ActionConfig;
  readonly openId: string | null;
  readonly onClose: () => void;
}) {
  const [lightbox, setLightbox] = useState<{ photoId: string; caption: string } | null>(null);

  const detail = useQuery({
    queryKey: ["run", openId],
    enabled: openId !== null,
    queryFn: () => apiGet<RunDetail>(actionConfig, `/logistics/runs/${openId}`),
  });
  const run = detail.data?.run;

  return (
    <>
      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {run?.driverName ?? (detail.isLoading ? "Loading…" : "Delivery run")}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {run && (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{run.vehicleNumber ?? ""}</span>
                  <span>{formatDate(run.date)}</span>
                  <LogisticsStatusPill status={run.status} endedAt={run.endedAt} />
                </div>
                <RunBookends config={actionConfig} run={run} />
                <RunStops
                  config={actionConfig}
                  stops={detail.data?.stops ?? []}
                  onOpenPhoto={(photoId, caption) => setLightbox({ photoId, caption })}
                />
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/85 p-6" onClick={() => setLightbox(null)}
          role="button" tabIndex={0} aria-label="Close"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") setLightbox(null); }}>
          <AuthImage config={actionConfig} photoId={lightbox.photoId} className="max-h-[75vh] max-w-[90vw] rounded-lg object-contain" />
          <div className="text-sm text-slate-200">{lightbox.caption}</div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Button onClick={() => void downloadPhoto(actionConfig, lightbox.photoId, "delivery-photo.jpg")} className="gap-1.5">
              <Download size={14} /> Download
            </Button>
            <Button variant="secondary" onClick={() => setLightbox(null)}>Close</Button>
          </div>
        </div>
      )}
    </>
  );
}
