"use client";

import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ActionConfig } from "@/lib/api-client";
import type { CollectionDetail } from "./collections-types";
import { useCollectionReject } from "./use-collection-reject";

export function CollectionRejectDialog({
  open, onOpenChange, collection, actionConfig, onRejected,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly collection: CollectionDetail;
  readonly actionConfig: ActionConfig;
  readonly onRejected: (updated: CollectionDetail) => void;
}) {
  const c = useCollectionReject({ open, collection, actionConfig, onRejected, onDone: () => onOpenChange(false) });
  const close = () => { c.setRejectError(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Ban className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle>Reject collection</DialogTitle>
              <DialogDescription>
                Rejecting <span className="font-medium text-foreground">{collection.collectionCode}</span>. The sales executive will be notified.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-reason">Reason for rejection <span className="text-destructive">*</span></Label>
            <Textarea
              id="reject-reason"
              value={c.remark}
              onChange={(e) => c.setRemark(e.target.value)}
              placeholder="e.g. Cheque bounced, wrong amount, incorrect reference…"
              rows={4}
              autoFocus
              className="resize-none focus-visible:ring-destructive/40"
            />
            <p className="text-xs text-muted-foreground">This note is sent to the sales executive so they can fix and resubmit.</p>
          </div>

          {c.rejectError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {c.rejectError} <span className="text-destructive/80">Your reason is kept — try again.</span>
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={c.isRejecting}>Cancel</Button>
          <Button variant="destructive" onClick={c.handleReject} disabled={c.isRejecting || !c.remark.trim()}>
            {c.isRejecting ? "Rejecting…" : "Reject collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
