"use client";

import { useRouter } from "next/navigation";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useSectionNotifications } from "@/features/shell/use-section-notifications";
import type { ActionConfig } from "@/lib/api-client";
import { buildOrdersColumns } from "./orders-list-columns";
import { ORDER_SORT, useOrdersListState } from "./use-orders-list-state";
import { useOrdersDialogs } from "./use-orders-dialogs";
import type { Order } from "./orders-api";
import type { CustomerOption } from "@/features/customers/customer-search-select";

export type OrdersRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

/** Action capabilities for the orders list, resolved server-side from the
 *  caller's effective permissions (not their role). */
export interface OrdersCaps {
  canCreate: boolean;
  canInvoice: boolean;
}

/** Wires the orders list: URL state, section notifications, capability flags,
 *  dialog state, the built columns, and the paged-table query. Keeps the list
 *  component a thin layout that distributes this to the header/controls/table. */
export function useOrdersList(customers: CustomerOption[], caps: OrdersCaps, actionConfig: ActionConfig) {
  const router = useRouter();
  const state = useOrdersListState(customers);
  const filterFulfillment = state.applied.fulfillment;
  const setFilterFulfillment = (v: string) => state.url.setFilter("fulfillment", v);

  const notif = useSectionNotifications(actionConfig, "orders");
  const { canCreate, canInvoice } = caps;

  const dialogs = useOrdersDialogs(actionConfig);
  const { columns, skeleton } = buildOrdersColumns({
    filterFulfillment,
    setFilterFulfillment,
    canCreate,
    canInvoice,
    showActions: canCreate || canInvoice,
    onGenerate: (o) => router.push(`/invoices/new?orderId=${o.id}`),
    onEdit: (o) => void dialogs.openEdit(o),
    onCancel: dialogs.setCanceling,
  });

  const paged = usePagedTable<Order>({
    actionConfig,
    queryKey: "orders",
    path: "/orders/paged",
    rowsKey: "orders",
    columns,
    initialSort: ORDER_SORT,
    filters: state.applied,
    sorting: state.url.sorting,
    onSortingChange: state.url.setSorting,
    pagination: state.url.pagination,
    onPaginationChange: state.url.setPagination,
  });

  return { router, state, filterFulfillment, setFilterFulfillment, notif, canCreate, canInvoice, dialogs, columns, skeleton, paged };
}
