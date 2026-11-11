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

/** Wires the orders list: URL state, section notifications, role flags, dialog
 *  state, the built columns, and the paged-table query. Keeps the list component
 *  a thin layout that just distributes this to the header/controls/table. */
export function useOrdersList(customers: CustomerOption[], role: OrdersRole, actionConfig: ActionConfig) {
  const router = useRouter();
  const state = useOrdersListState(customers);
  const filterFulfillment = state.applied.fulfillment;
  const setFilterFulfillment = (v: string) => state.url.setFilter("fulfillment", v);

  const notif = useSectionNotifications(actionConfig, "orders");
  const canCreate = role === "SUPER_ADMIN" || role === "MANAGER";
  const canInvoice = role === "SUPER_ADMIN" || role === "ACCOUNTANT";

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
