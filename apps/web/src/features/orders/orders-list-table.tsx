"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable, type SkeletonCell } from "@/components/data-table/data-table";
import { FULFILLMENT_ROW_BG } from "./order-fulfillment-options";
import type { Order } from "./orders-api";

/** The orders results table: per-status row wash (with the "new since you last
 *  looked" highlight taking precedence) and a role-aware empty state. */
export function OrdersListTable({
  table,
  columnCount,
  skeleton,
  showSkeleton,
  pageSize,
  pageCount,
  highlightSince,
  hasActiveFilters,
  canCreate,
  onNewOrder,
  onRowClick,
}: {
  readonly table: Table<Order>;
  readonly columnCount: number;
  readonly skeleton: SkeletonCell[];
  readonly showSkeleton: boolean;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly highlightSince: string | null;
  readonly hasActiveFilters: boolean;
  readonly canCreate: boolean;
  readonly onNewOrder: () => void;
  readonly onRowClick: (o: Order) => void;
}) {
  return (
    <DataTable
      table={table}
      columnCount={columnCount}
      isLoading={showSkeleton}
      skeleton={skeleton}
      pageSize={pageSize}
      pageCount={pageCount}
      tableClassName="table-fixed [&_td]:truncate [&_th]:whitespace-normal"
      rowClassName={(o) =>
        highlightSince && o.createdAt > highlightSince
          ? "bg-blue-50/60"
          : FULFILLMENT_ROW_BG[o.fulfillmentStatus ?? "ordered"]
      }
      empty={
        hasActiveFilters ? (
          "No orders match your filters."
        ) : (
          <>
            No orders yet.
            {canCreate && (
              <span className="mt-4 block">
                <Button variant="outline" onClick={onNewOrder}>
                  Create your first order
                </Button>
              </span>
            )}
          </>
        )
      }
      onRowClick={onRowClick}
    />
  );
}
