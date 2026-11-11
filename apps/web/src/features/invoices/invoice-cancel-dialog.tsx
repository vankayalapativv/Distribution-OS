"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { cancelInvoice, type InvoiceRow } from "./invoices-api";

/** Confirm + cancel a generated invoice. Cancelling reverses the invoice's stock
 *  back to its godown and reopens the linked order; a reason is required (the
 *  server re-checks the invoice is generated and not already cancelled). */
export function InvoiceCancelDialog({
  target,
  actionConfig,
  onOpenChange,
  onCancelled,
}: Readonly<{
  target: InvoiceRow | null;
  actionConfig: ActionConfig;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}>) {
  const [reason, setReason] = useState("");

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
      title="Cancel this invoice?"
      description="The invoice is marked Cancelled, its stock is returned to the godown, and the order reopens for the un-billed quantity. This can't be undone."
      details={
        target ? (
          <p>
            <span className="font-mono text-xs">{target.invoiceNumber}</span>
            <span className="text-muted-foreground"> · {target.customerName ?? "—"}</span>
          </p>
        ) : null
      }
      extra={
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            Reason for cancelling <span className="text-destructive">*</span>
          </span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Wrong quantity, duplicate invoice, customer returned everything…"
            rows={3}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </label>
      }
      confirmLabel="Cancel invoice"
      dismissLabel="Keep invoice"
      onConfirm={async () => {
        const trimmed = reason.trim();
        if (!trimmed) throw new Error("Please enter a reason for cancelling.");
        try {
          await cancelInvoice(actionConfig, target!.id, trimmed);
        } catch (e) {
          throw new Error(errorMessage(e, "Could not cancel the invoice."));
        }
        setReason("");
        onCancelled();
      }}
    />
  );
}
