"use client";

import { OrdersCreateDialog } from "./orders-create-dialog";
import type { OrdersDialogs } from "./use-orders-dialogs";
import type { ActionConfig } from "@/lib/api-client";
import type { Product, SalesExecutive } from "./orders-api";
import type { CustomerOption } from "@/features/customers/customer-search-select";

export interface OrdersDialogData {
  products: Product[];
  customers: CustomerOption[];
  salesExecutives: SalesExecutive[];
  actionConfig: ActionConfig;
}

/** The New-Order create dialog + the (order-keyed) edit dialog. Both are gated to
 *  SA/Manager (`canCreate`); the edit form seeds fresh per order via its key. */
export function OrdersCreateEditDialogs({
  dialogs,
  canCreate,
  data,
}: Readonly<{
  dialogs: OrdersDialogs;
  canCreate: boolean;
  data: OrdersDialogData;
}>) {
  if (!canCreate) return null;
  return (
    <>
      <OrdersCreateDialog
        open={dialogs.createOpen}
        onOpenChange={dialogs.setCreateOpen}
        {...data}
      />
      {dialogs.editingOrder && (
        <OrdersCreateDialog
          key={dialogs.editingOrder.id}
          order={dialogs.editingOrder}
          open={dialogs.editOpen}
          onOpenChange={(o) => {
            dialogs.setEditOpen(o);
            if (!o) dialogs.setEditingOrder(null);
          }}
          {...data}
        />
      )}
    </>
  );
}
