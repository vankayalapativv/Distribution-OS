"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { AuthImage, downloadPhoto } from "./logistics-media";
import { LogisticsDetailEvent } from "./logistics-detail-event";
import type { CustomerDeliveryDetail } from "./logistics-api";

/**
 * Row-detail dialog for one customer: delivery events with driver proof photos,
 * plus a full-screen photo lightbox (its own local state — only opened from the
 * photo grid inside this dialog). Date range mirrors the list's applied filter.
 */
export function LogisticsDetailModal({
  actionConfig,
  openId,
  from,
  to,
  onClose,
}: {
  readonly actionConfig: ActionConfig;
  readonly openId: string | null;
  readonly from: string;
  readonly to: string;
  readonly onClose: () => void;
}) {
  const [lightbox, setLightbox] = useState<{ photoId: string; caption: string } | null>(null);

  const detail = useQuery({
    queryKey: ["detail", openId, from, to],
    enabled: openId !== null,
    queryFn: () => {
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      return apiGet<CustomerDeliveryDetail>(actionConfig, `/logistics/customers/${openId}?${sp.toString()}`);
    },
  });

  return (
    <>
      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{detail.data?.customer.customerName ?? (detail.isLoading ? "Loading…" : "Customer")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
          {detail.data && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-mono text-xs">{detail.data.customer.customerCode ?? ""}</span>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {detail.data.customer.address && <span>📍 {detail.data.customer.address}</span>}
                  {detail.data.customer.landmark && <span className="text-muted-foreground/80">({detail.data.customer.landmark})</span>}
                  {detail.data.customer.phone && <span>📞 {detail.data.customer.phone}</span>}
                </div>
              </div>
              {detail.data.events.length === 0 && <p className="text-sm text-muted-foreground">No deliveries in the selected range.</p>}
              {detail.data.events.map((ev) => (
                <LogisticsDetailEvent
                  key={ev.stopId}
                  config={actionConfig}
                  ev={ev}
                  customerName={detail.data?.customer.customerName ?? ""}
                  onOpenPhoto={(photoId, caption) => setLightbox({ photoId, caption })}
                />
              ))}
            </div>
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
            <Button onClick={() => void downloadPhoto(actionConfig, lightbox.photoId, "delivery-photo.jpg")} className="gap-1.5"><Download size={14} /> Download</Button>
            <Button variant="secondary" onClick={() => setLightbox(null)}>Close</Button>
          </div>
        </div>
      )}
    </>
  );
}
