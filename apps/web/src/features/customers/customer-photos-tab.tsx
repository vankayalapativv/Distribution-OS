"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionConfig } from "@/lib/api-client";
import { AuthImage, DATETIME_FMT } from "@/features/market-intelligence/market-intelligence-media";
import {
  PhotosGrid,
  PhotosSkeletonGrid,
  type CustomerPhoto,
} from "./customer-photos-grid";

export type { CustomerPhoto } from "./customer-photos-grid";

/** The Photos tab: SE profile photos (category 'customer') with a click-to-enlarge preview. */
export function CustomerPhotosTab({
  photos,
  isLoading,
  actionConfig,
}: {
  readonly photos: CustomerPhoto[];
  readonly isLoading: boolean;
  readonly actionConfig: ActionConfig;
}) {
  const [preview, setPreview] = useState<CustomerPhoto | null>(null);

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Profile Photos
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Taken by the Sales Executive while creating or updating this customer.
      </p>

      <div className="mt-4">
        {(() => { if (isLoading) return (
          <PhotosSkeletonGrid />
        ); if (photos.length === 0) return (
          <div className="rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-muted-foreground">
            No profile photos yet — SEs capture them from the customer workspace in the mobile
            app while creating or updating this profile.
          </div>
        ); return (
          <PhotosGrid photos={photos} actionConfig={actionConfig} onOpen={setPreview} />
        ); })()}
      </div>

      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        <DialogContent size="xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>Profile photo</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <AuthImage
                  photoId={preview.id}
                  config={actionConfig}
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                />
                <p className="text-xs text-muted-foreground">
                  Uploaded {DATETIME_FMT.format(new Date(preview.createdAt))} by{" "}
                  {preview.uploaderName ?? "unknown"}
                </p>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
