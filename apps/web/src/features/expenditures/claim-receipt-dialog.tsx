"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionConfig } from "@/lib/api-client";
import type { ExpenseClaim } from "./expense-claims-api";
import { useBillBlob } from "./use-bill-blob";

/** View a claim's receipt before deciding. A claim is an `expenditures` row, so
 *  the auth-protected image/PDF streams from the same /expenditures/:id/bill. */
export function ClaimReceiptDialog({
  claim,
  onClose,
  actionConfig,
}: {
  readonly claim: ExpenseClaim | null;
  readonly onClose: () => void;
  readonly actionConfig: ActionConfig;
}) {
  const { src, isPdf, failed } = useBillBlob(actionConfig, claim?.id ?? null);
  if (!claim) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Receipt · {claim.categoryName}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {claim.code} · submitted by {claim.submitterName ?? "—"}
          </p>
        </DialogHeader>
        <DialogBody>
          {failed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load the receipt.</p>
          ) : !src ? (
            <div className="h-64 w-full animate-pulse rounded-md bg-slate-200" />
          ) : isPdf ? (
            <iframe src={src} title="Receipt" className="h-[70vh] w-full rounded-md border border-border" />
          ) : (
            <img src={src} alt="Receipt" className="mx-auto max-h-[70vh] rounded-md" />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
