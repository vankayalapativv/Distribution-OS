"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { LedgerEditCollectionFields } from "./ledger-edit-collection-fields";
import { useLedgerCollectionEdit } from "./use-ledger-collection-edit";

/**
 * Edit a receipt / credit note straight from the ledger (SUPER_ADMIN). Loads the
 * collection's current values, lets the admin correct the mistyped fields, and
 * PATCHes `/collections/:id`. If the receipt is already verified, the server
 * re-reconciles it against the customer's invoices on save.
 */
export function LedgerEditCollectionDialog({
  collectionId,
  onOpenChange,
  onSaved,
  actionConfig,
}: {
  readonly collectionId: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
  readonly actionConfig: ActionConfig;
}) {
  const f = useLedgerCollectionEdit({ collectionId, actionConfig, onSaved, onOpenChange });

  return (
    <Dialog open={f.open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={f.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Edit entry{f.data ? ` — ${f.data.collectionCode}` : ""}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {f.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <LedgerEditCollectionFields
                verified={f.verified}
                amount={f.amount}
                setAmount={f.setAmount}
                date={f.date}
                setDate={f.setDate}
                mode={f.mode}
                setMode={f.setMode}
                reference={f.reference}
                setReference={f.setReference}
                remark={f.remark}
                setRemark={f.setRemark}
                error={f.error}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={f.busy || f.isLoading}>
              {f.busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
