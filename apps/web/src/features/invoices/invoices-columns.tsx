import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { litres, rupeesExact } from "@/lib/format";
import { InvoiceCustomerCell, InvoiceNumberCell, InvoiceOutstandingCell } from "./invoice-cells";
import { InvoiceRowActionsMenu } from "./invoice-row-actions-menu";
import type { InvoiceRow } from "./invoices-api";

export interface InvoiceColumnsOptions {
  /** Download a row's PDF — offered on every invoice. */
  onDownload?: (row: InvoiceRow) => void;
  /** Open the cancel-invoice dialog for a row (generated, unpaid, not cancelled). */
  onCancel?: (row: InvoiceRow) => void;
}

export function buildInvoiceColumns(opts: InvoiceColumnsOptions = {}): ColumnDef<InvoiceRow>[] {
  return [
  { accessorKey: "invoiceNumber", header: "Invoice", cell: ({ row }) => <InvoiceNumberCell row={row.original} /> },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <InvoiceCustomerCell row={row.original} />,
  },
  {
    accessorKey: "orderCode",
    header: "Order",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.orderId ? (
        <Link
          href={`/orders/${row.original.orderId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs font-medium text-primary hover:underline"
        >
          {row.original.orderCode}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "totalLitres",
    header: "Oil litres",
    cell: ({ row }) => <span className="tabular-nums text-sm">{litres(row.original.totalLitres)}</span>,
  },
  {
    accessorKey: "taxableValue",
    header: "Before GST",
    meta: { className: "text-right" },
    cell: ({ getValue }) => <span className="tabular-nums">{rupeesExact(getValue() as number)}</span>,
  },
  {
    accessorKey: "grandTotal",
    header: "After GST",
    meta: { className: "text-right" },
    cell: ({ getValue }) => <span className="tabular-nums font-medium">{rupeesExact(getValue() as number)}</span>,
  },
  {
    accessorKey: "outstandingAmount",
    header: "Outstanding",
    meta: { className: "text-right" },
    cell: ({ row }) => <InvoiceOutstandingCell row={row.original} rupeesExact={rupeesExact} />,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: { className: "text-right" },
    cell: ({ row }) => {
      const r = row.original;
      // Download is offered on every row. Edit + Cancel only on an editable
      // invoice — generated, not cancelled, no payment yet (the server re-checks).
      const actionable = r.invoiceSource === "generated" && r.docStatus !== "cancelled" && r.paymentStatus === "unpaid";
      return (
        <InvoiceRowActionsMenu
          onDownload={opts.onDownload ? () => opts.onDownload!(r) : undefined}
          editHref={actionable ? `/invoices/${r.id}/edit` : undefined}
          onCancel={actionable && opts.onCancel ? () => opts.onCancel!(r) : undefined}
        />
      );
    },
  },
  ];
}

/** Default columns used where no row-action callbacks are wired (e.g. tests). */
export const invoiceColumns = buildInvoiceColumns();

export const invoiceSkeleton: SkeletonCell[] = [
  () => (
    <div className="space-y-1">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  ),
  () => (
    <div className="space-y-1">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-24" />
    </div>
  ),
  () => <Skeleton className="h-3.5 w-16" />,
  () => <Skeleton className="h-4 w-20" />,
  () => <Skeleton className="ml-auto h-4 w-20" />,
  () => <Skeleton className="ml-auto h-4 w-20" />,
  () => (
    <div className="space-y-1">
      <Skeleton className="ml-auto h-4 w-20" />
      <Skeleton className="ml-auto h-4 w-14 rounded-full" />
    </div>
  ),
  () => (
    <div className="flex justify-end">
      <Skeleton className="size-8 rounded-md" />
    </div>
  ),
];
