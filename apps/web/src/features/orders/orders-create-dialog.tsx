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
import type { ActionConfig } from "@/lib/api-client";
import type { Product, SalesExecutive } from "./orders-api";
import type { CustomerOption } from "@/features/customers/customer-search-select";
import { OrderHeaderFields } from "./order-header-fields";
import { OrderLockedLinesEditor } from "./order-locked-lines-editor";
import { OrderLineItemsTabs } from "./order-line-items-tabs";
import { useOrderDraft, type EditableOrder } from "./use-order-draft";

interface OrdersCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  customers: CustomerOption[];
  salesExecutives: SalesExecutive[];
  actionConfig: ActionConfig;
  /** When provided, the dialog edits this order instead of creating a new one. */
  order?: EditableOrder | null;
  /** Pre-select this customer when creating (e.g. from a customer's page). */
  initialCustomerId?: string;
  /** Lock the customer field to a fixed customer (shown read-only). */
  lockCustomer?: boolean;
  /** Name shown in the locked customer field. */
  lockedCustomerLabel?: string;
  /** Called after a successful create (e.g. to refresh a customer's order list). */
  onCreated?: () => void;
}

export function OrdersCreateDialog(props: Readonly<OrdersCreateDialogProps>) {
  const { open, onOpenChange, products, customers, salesExecutives, actionConfig, order } = props;
  const draft = useOrderDraft({
    open, onOpenChange, products, actionConfig, order,
    initialCustomerId: props.initialCustomerId,
    onCreated: props.onCreated,
  });

  const idleLabel = draft.isEdit ? "Save changes" : "Create order";
  const busyLabel = draft.isEdit ? "Saving…" : "Creating…";
  const submitLabel = draft.isCreating ? busyLabel : idleLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={draft.handleCreate} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{draft.isEdit ? "Edit order" : "New order"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <OrderHeaderFields
              actionConfig={actionConfig}
              customers={customers}
              selectedCustomerLabel={order?.customerName ?? props.lockedCustomerLabel}
              lockCustomer={props.lockCustomer}
              salesExecutives={salesExecutives}
              selectedCustomerId={draft.selectedCustomerId}
              onCustomerChange={draft.setSelectedCustomerId}
              selectedSalesExecId={draft.selectedSalesExecId}
              onSalesExecChange={draft.setSelectedSalesExecId}
              orderDate={draft.orderDate}
              onOrderDateChange={draft.setOrderDate}
              orderDateOpen={draft.orderDateOpen}
              onOrderDateOpenChange={draft.setOrderDateOpen}
            />
            {draft.isPartial && (
              <OrderLockedLinesEditor lockedLines={draft.lockedLines} onSetQty={draft.setLockedQty} />
            )}
            <OrderLineItemsTabs draft={draft} products={products} />
            {draft.createError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {draft.createError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={draft.closeCreate}>
              Cancel
            </Button>
            <Button type="submit" disabled={draft.isCreating || !draft.selectedCustomerId}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
