import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import {
  orderColumns,
  orderSkeleton,
  invoiceColumn,
  invoiceSkeletonCell,
  FulfillmentBadge,
} from "./orders-columns";
import { FulfillmentHeaderFilter } from "./order-fulfillment-header-filter";
import { RowActionsMenu } from "./order-row-actions-menu";
import { orderActionFlags } from "./orders-list-helpers";
import type { Order } from "./orders-api";

export interface OrdersColumnsOptions {
  filterFulfillment: string;
  setFilterFulfillment: (v: string) => void;
  canCreate: boolean;
  canInvoice: boolean;
  showActions: boolean;
  onGenerate: (o: Order) => void;
  onEdit: (o: Order) => void;
  onCancel: (o: Order) => void;
}

/** Assemble the orders table columns + matching skeleton. The Invoice column is
 *  inserted after Code, then the Fulfillment (filterable) and optional Actions. */
export function buildOrdersColumns(opts: OrdersColumnsOptions): {
  columns: ColumnDef<Order>[];
  skeleton: SkeletonCell[];
} {
  const fulfillmentColumn: ColumnDef<Order> = {
    id: "fulfillment",
    header: () => (
      <FulfillmentHeaderFilter value={opts.filterFulfillment} onChange={opts.setFilterFulfillment} />
    ),
    enableSorting: false,
    meta: { className: "w-[152px]" },
    cell: ({ row }) => {
      const o = row.original;
      const returned = o.returnedUnits ?? 0;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <FulfillmentBadge status={o.fulfillmentStatus} />
          {returned > 0 && <span className="pl-1 text-[11px] text-rose-600">{returned} returned</span>}
        </div>
      );
    },
  };

  const actionsColumn: ColumnDef<Order> = {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: { className: "w-[56px] text-right" },
    cell: ({ row }) => {
      const o = row.original;
      const f = orderActionFlags(o, {
        canCreate: opts.canCreate,
        canInvoice: opts.canInvoice,
        invoiceGenerationEnabled: true,
      });
      if (f.hidden) return null;
      return (
        <RowActionsMenu
          canGenerate={f.canGenerate}
          canEdit={f.canEdit}
          canManage={f.canCancel}
          cancelled={o.orderStatus === "cancelled"}
          fullyBilled={o.fullyInvoiced && (o.invoices?.length ?? 0) > 0}
          onGenerate={() => opts.onGenerate(o)}
          onEdit={() => opts.onEdit(o)}
          onCancel={() => opts.onCancel(o)}
        />
      );
    },
  };

  const columns: ColumnDef<Order>[] = [
    orderColumns[0], orderColumns[1], orderColumns[2], invoiceColumn,
    ...orderColumns.slice(3), fulfillmentColumn,
    ...(opts.showActions ? [actionsColumn] : []),
  ];
  const skeleton: SkeletonCell[] = [
    orderSkeleton[0], orderSkeleton[1], orderSkeleton[2], invoiceSkeletonCell,
    ...orderSkeleton.slice(3),
    () => <Skeleton className="h-5 w-20 rounded-full" />,
    ...(opts.showActions ? [() => (<div className="flex justify-end"><Skeleton className="h-4 w-16" /></div>)] : []),
  ];
  return { columns, skeleton };
}
