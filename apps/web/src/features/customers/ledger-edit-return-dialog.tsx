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
import { LedgerEditReturnFields } from "./ledger-edit-return-fields";
import { useLedgerReturnEdit } from "./use-ledger-return-edit";

/**
 * Edit a sales return (Sale_re row) from the ledger — SUPER_ADMIN. Full re-entry
 * of the returned quantities per line. The server reverses the old return and
 * re-applies the new one atomically, netting the invoice's outstanding.
 */
export function LedgerEditReturnDialog({
  returnId,
  onOpenChange,
  onSaved,
  actionConfig,
}: {
  readonly returnId: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
  readonly actionConfig: ActionConfig;
}) {
  const f = useLedgerReturnEdit({ returnId, actionConfig, onSaved, onOpenChange });

  return (
    <Dialog open={f.open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={f.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Edit sales return{f.ret ? ` — ${f.ret.invoiceNumber}` : ""}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {f.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <LedgerEditReturnFields
                date={f.date}
                setDate={f.setDate}
                lines={f.lines}
                qty={f.qty}
                setQty={f.setQty}
                available={f.available}
                total={f.total}
                overCap={f.overCap}
                reason={f.reason}
                setReason={f.setReason}
                proofFile={f.proofFile}
                setProofFile={f.setProofFile}
                error={f.error}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={f.busy || f.isLoading || f.total <= 0 || f.overCap}>
              {f.busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
