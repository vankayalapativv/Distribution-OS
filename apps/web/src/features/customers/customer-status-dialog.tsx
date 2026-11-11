"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import type { Customer } from "./customers-api";
import { StatusForm } from "./customer-status-form";

export function CustomerStatusDialog({
  open,
  onOpenChange,
  customer,
  actionConfig,
  onUpdated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly customer: Customer;
  readonly actionConfig: ActionConfig;
  readonly onUpdated: (customer: Customer) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <StatusForm
          customer={customer}
          actionConfig={actionConfig}
          onDone={(c) => {
            onUpdated(c);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
