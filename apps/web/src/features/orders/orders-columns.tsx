import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/format";
import { InvoicedDateCell } from "./order-invoiced-date-cell";
import { OrderCustomerCell } from "./order-customer-cell";
import type { Order } from "./orders-api";

// Re-exported so existing `./orders-columns` imports keep resolving after the split.
export { STATUS_CLASSES, FULFILLMENT_TONES, FULFILLMENT_LABELS, FulfillmentBadge } from "./order-fulfillment-badge";
export { InvoiceCell, invoiceColumn, invoiceSkeletonCell } from "./order-invoice-cell";
export { InvoicedDateCell } from "./order-invoiced-date-cell";
export { orderSkeleton } from "./orders-columns-skeleton";

// Column order (Invoice inserted after Code by the caller):
//   Ordered Date · Invoiced Date · Code · Invoice · Customer · Total Litres.
// The Customer cell stacks name / city · SE / phone (see OrderCustomerCell).
export const orderColumns: ColumnDef<Order>[] = [
  {
    accessorKey: "orderDate",
    header: "Ordered Date",
    meta: { className: "w-[11%]" },
    cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue() as string)}</span>,
  },
  {
    id: "invoicedDate",
    header: "Invoiced Date",
    enableSorting: false,
    meta: { className: "w-[12%]" },
    cell: ({ row }) => <InvoicedDateCell invoices={row.original.invoices} />,
  },
  {
    accessorKey: "orderCode",
    header: "Code",
    meta: { className: "w-[9%]" },
    // A cancelled order reads as voided: muted + struck through. A backing order
    // (origin='invoice') carries a "From invoice" tag so an order nobody placed in
    // the field is self-explanatory — its invoice is linked in the Invoice column.
    cell: ({ getValue, row }) => (
      <div className="flex flex-col items-start gap-0.5">
        <span
          className={
            row.original.orderStatus === "cancelled"
              ? "font-mono text-xs text-muted-foreground/70 line-through"
              : "font-mono text-xs text-muted-foreground"
          }
        >
          {getValue() as string}
        </span>
        {row.original.origin === "invoice" && (
          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            From invoice
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    meta: { className: "w-[25%]" },
    cell: ({ row }) => <OrderCustomerCell order={row.original} />,
  },
  {
    accessorKey: "totalLitres",
    header: "Total Litres",
    meta: { className: "w-[10%]" },
    // Gross ordered litres, with a "−N L returned" note when units were returned.
    cell: ({ row }) => {
      const o = row.original;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">{o.totalLitres != null ? `${o.totalLitres} L` : "—"}</span>
          {o.returnedLitres > 0 && (
            <span className="whitespace-nowrap text-[11px] text-rose-600" title={`${o.returnedLitres} L returned`}>
              −{o.returnedLitres} L
            </span>
          )}
        </div>
      );
    },
  },
];
