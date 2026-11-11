"use client";

import { useState } from "react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActionConfig } from "@/lib/api-client";
import type { CollectionProof } from "./collections-types";
import { formatUploadedAt } from "./collection-receipt-format";
import { useProofBlob } from "./use-proof-blob";
import { CollectionReceiptThumb } from "./collection-receipt-thumb";

/**
 * The SE-uploaded payment receipt: a thumbnail on the detail page that opens a
 * large preview dialog. The image is auth-gated, fetched as a blob via the hook.
 */
export function CollectionReceipt({
  collectionId, proof, actionConfig,
}: {
  readonly collectionId: string;
  readonly proof: CollectionProof;
  readonly actionConfig: ActionConfig;
}) {
  const { src, failed } = useProofBlob(collectionId, actionConfig);
  const [open, setOpen] = useState(false);
  const isPdf = proof.contentType === "application/pdf";
  const uploadedAt = formatUploadedAt(proof.createdAt);

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Payment receipt</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Uploaded by the sales executive · {uploadedAt}</p>

      <div className="mt-3">
        <CollectionReceiptThumb src={src} failed={failed} isPdf={isPdf} onEnlarge={() => setOpen(true)} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
            <DialogDescription>Uploaded {uploadedAt}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {src ? (
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Payment receipt" className="h-auto w-auto max-w-full rounded-md" />
              </div>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  );
}
