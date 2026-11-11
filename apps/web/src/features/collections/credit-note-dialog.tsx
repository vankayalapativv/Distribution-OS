"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { CreditNoteFields } from "./credit-note-fields";
import { useCreditNote } from "./use-credit-note";

/**
 * Issue a credit note to a customer — a verification-required credit tagged
 * "Credit Note" that offsets a chosen outstanding invoice. Runs through the
 * collections pipeline (created pending → verified → reduces the invoice's
 * outstanding + the customer's dues). Launched from the customer's Ledger tab.
 */
export function CreditNoteDialog({
  open, onOpenChange, customerId, customerName, actionConfig, onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly customerId: string;
  readonly customerName: string;
  readonly actionConfig: ActionConfig;
  readonly onCreated?: () => void;
}) {
  const c = useCreditNote({ open, customerId, actionConfig, onCreated, onDone: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) c.reset(); onOpenChange(next); }}>
      <DialogContent size="md">
        <form onSubmit={c.handleCreate} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New credit note — {customerName}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <CreditNoteFields
              form={c.form}
              set={c.set}
              proofFile={c.proofFile}
              setProofFile={c.setProofFile}
              collectors={c.collectors}
              invoices={c.invoices}
              invoicesLoading={c.invoicesLoading}
            />
            {c.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{c.error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={c.busy || !c.canSubmit}>
              {c.busy ? "Creating…" : "Create credit note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
