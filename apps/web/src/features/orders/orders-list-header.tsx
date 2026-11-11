"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { OrdersDownload } from "./orders-download";
import type { ActionConfig } from "@/lib/api-client";
import { plural } from "@/lib/format";

/** The Orders page header: crumbs + title + a live order-count subtitle, and the
 *  New-Order button (SA/Manager) alongside the filtered Download menu. */
export function OrdersListHeader({
  canCreate,
  onNewOrder,
  total,
  isLoading,
  actionConfig,
  filterFulfillment,
  downloadFilters,
}: {
  readonly canCreate: boolean;
  readonly onNewOrder: () => void;
  readonly total: number;
  readonly isLoading: boolean;
  readonly actionConfig: ActionConfig;
  readonly filterFulfillment: string;
  readonly downloadFilters: {
    search: string;
    city: string;
    salesExecutiveId: string;
    dateFrom: string;
    dateTo: string;
  };
}) {
  return (
    <PageHeader
      crumbs={[{ label: "Management" }, { label: "Orders" }]}
      title="Orders"
      subtitle={isLoading ? "Loading…" : `${total} order${plural(total)} in your organisation`}
      action={
        <div className="flex items-center gap-2">
          {canCreate && <Button onClick={onNewOrder}>+ New Order</Button>}
          <OrdersDownload
            actionConfig={actionConfig}
            defaultFulfillment={filterFulfillment}
            filters={downloadFilters}
          />
        </div>
      }
    />
  );
}
