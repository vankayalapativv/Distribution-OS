"use client";

import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { type ActionConfig } from "@/lib/api-client";
import { useOrdersList, type OrdersRole } from "./use-orders-list";
import { OrdersListHeader } from "./orders-list-header";
import { OrdersListControls } from "./orders-list-controls";
import { OrdersListTable } from "./orders-list-table";
import { OrdersCreateEditDialogs } from "./orders-create-edit-dialogs";
import { OrdersActionDialogs } from "./orders-action-dialogs";
import type { Product, SalesExecutive } from "./orders-api";
import type { CustomerOption } from "@/features/customers/customer-search-select";

export type { OrdersRole };

interface OrdersListProps {
  products: Product[];
  customers: CustomerOption[];
  salesExecutives: SalesExecutive[];
  role: OrdersRole;
  actionConfig: ActionConfig;
}

function OrdersInner(props: Readonly<OrdersListProps>) {
  const { customers, salesExecutives, role, actionConfig } = props;
  const v = useOrdersList(customers, role, actionConfig);
  const { state, dialogs, paged } = v;
  const onNewOrder = () => dialogs.setCreateOpen(true);

  return (
    <>
      <DashboardShell role={role} active="orders">
        <OrdersListHeader
          canCreate={v.canCreate}
          onNewOrder={onNewOrder}
          total={paged.total}
          isLoading={paged.isLoading}
          actionConfig={actionConfig}
          filterFulfillment={v.filterFulfillment}
          downloadFilters={{
            search: state.applied.search,
            city: state.applied.city,
            salesExecutiveId: state.applied.salesExecutiveId,
            dateFrom: state.applied.dateFrom,
            dateTo: state.applied.dateTo,
          }}
        />
        <OrdersListControls
          state={state}
          salesExecutives={salesExecutives}
          actionConfig={actionConfig}
          filterFulfillment={v.filterFulfillment}
          setFilterFulfillment={v.setFilterFulfillment}
          errorText={paged.error?.message ?? dialogs.actionError}
          newCount={v.notif.newCount}
          onLoadNew={() => {
            void v.notif.acknowledge();
            dialogs.invalidate();
          }}
        />
        <OrdersListTable
          table={paged.table}
          columnCount={v.columns.length}
          skeleton={v.skeleton}
          showSkeleton={paged.showSkeleton}
          pageSize={paged.pageSize}
          pageCount={paged.pageCount}
          highlightSince={v.notif.highlightSince}
          hasActiveFilters={state.hasActiveFilters}
          canCreate={v.canCreate}
          onNewOrder={onNewOrder}
          onRowClick={(o) => v.router.push(`/orders/${o.id}`)}
        />
      </DashboardShell>

      <OrdersCreateEditDialogs
        dialogs={dialogs}
        canCreate={v.canCreate}
        data={{ products: props.products, customers, salesExecutives, actionConfig }}
      />
      <OrdersActionDialogs
        dialogs={dialogs}
        canCreate={v.canCreate}
      />
    </>
  );
}

export const OrdersList = withQueryClient(OrdersInner);
