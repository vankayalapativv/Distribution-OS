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
import { SalesReturnFields } from "./sales-return-fields";
import { useSalesReturn } from "./use-sales-return";

/**
 * Record a Sales Return against one of the customer's outstanding invoices.
 * Pick the invoice → set the returned quantity per billed line → the amount is
 * removed from the invoice's outstanding and posted to the ledger as a "Sale_re"
 * credit. Launched from the Ledger tab (SUPER_ADMIN + ACCOUNTANT).
 */
export function SalesReturnDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  actionConfig,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly customerId: string;
  readonly customerName: string;
  readonly actionConfig: ActionConfig;
  readonly onCreated?: () => void;
}) {
  const f = useSalesReturn({ open, customerId, actionConfig, onCreated, onOpenChange });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) f.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <form onSubmit={f.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New sales return — {customerName}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <SalesReturnFields
              invoiceId={f.invoiceId}
              pickInvoice={f.pickInvoice}
              invoicesQ={f.invoicesQ}
              date={f.date}
              setDate={f.setDate}
              returnableQ={f.returnableQ}
              lines={f.lines}
              qty={f.qty}
              setQty={f.setQty}
              outstanding={f.outstanding}
              total={f.total}
              overCap={f.overCap}
              reason={f.reason}
              setReason={f.setReason}
              proofFile={f.proofFile}
              setProofFile={f.setProofFile}
              error={f.error}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={f.busy || !f.invoiceId || f.total <= 0 || f.overCap}>
              {f.busy ? "Recording…" : "Record return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
