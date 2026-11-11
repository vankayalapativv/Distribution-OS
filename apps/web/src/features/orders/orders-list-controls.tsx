"use client";

import { X } from "lucide-react";
import { OrdersFilters } from "./orders-filters";
import { OrdersFulfillmentSummary } from "./orders-fulfillment-summary";
import { NewItemsBanner } from "@/features/shell/new-items-banner";
import type { ActionConfig } from "@/lib/api-client";
import type { SalesExecutive } from "./orders-api";
import type { useOrdersListState } from "./use-orders-list-state";

type OrdersListState = ReturnType<typeof useOrdersListState>;

/** The controls stacked above the orders table: the fulfillment summary strip,
 *  the filter bar, the deep-link customer chip, an error banner, and the
 *  "new since you last looked" banner. Presentational — all state comes in. */
export function OrdersListControls({
  state,
  salesExecutives,
  actionConfig,
  filterFulfillment,
  setFilterFulfillment,
  errorText,
  newCount,
  onLoadNew,
}: {
  readonly state: OrdersListState;
  readonly salesExecutives: SalesExecutive[];
  readonly actionConfig: ActionConfig;
  readonly filterFulfillment: string;
  readonly setFilterFulfillment: (v: string) => void;
  readonly errorText: string | null;
  readonly newCount: number;
  readonly onLoadNew: () => void;
}) {
  const { applied } = state;
  return (
    <>
      <OrdersFulfillmentSummary
        actionConfig={actionConfig}
        active={filterFulfillment}
        onSelect={setFilterFulfillment}
      />
      <OrdersFilters
        search={state.search}
        onSearchChange={state.setSearch}
        city={applied.city}
        onCityChange={(v) => state.url.setFilter("city", v)}
        cities={state.cities}
        salesExecutiveId={applied.salesExecutiveId}
        onSalesExecChange={(v) => state.url.setFilter("salesExecutiveId", v)}
        salesExecutives={salesExecutives}
        dateRange={state.dateRange}
        onDateRangeChange={state.setDateRange}
        onClear={state.clearFilters}
        hasActiveFilters={state.hasActiveFilters}
      />
      {applied.customerId && (
        <div className="-mt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Customer: {state.appliedCustomerName}
            <button
              type="button"
              onClick={() => state.url.setFilter("customerId", "")}
              className="rounded-full p-0.5 hover:bg-primary/20"
              aria-label="Clear customer filter"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      )}
      {errorText && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {errorText}
        </div>
      )}
      <NewItemsBanner count={newCount} noun="order" onLoad={onLoadNew} />
    </>
  );
}
