"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SkeletonCell } from "@/components/data-table/data-table";
import { openInvoicePdf } from "@/features/invoices/invoices-api";
import type { Order, OrderInvoiceRef } from "./orders-api";

const invoiceLinkClass = "font-mono text-xs text-primary underline-offset-2 hover:underline";

/**
 * Invoice reference cell. Clicking an invoice number opens that invoice's PDF
 * (auth-scoped, new tab). "—" when nothing is billed yet; a single invoice is a
 * direct link; several (partial delivery) show "first +N more" and open a small
 * pick menu. `stopPropagation` keeps a click from also opening the order detail.
 */
export function InvoiceCell({ invoices }: { readonly invoices: OrderInvoiceRef[] | undefined }) {
  const [open, setOpen] = useState(false);
  const list = invoices ?? [];
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;

  const openPdf = (iv: OrderInvoiceRef) => openInvoicePdf(iv.id, iv.number);

  if (list.length === 1) {
    const only = list[0];
    return (
      <button
        type="button"
        title={`Open ${only.number}`}
        onClick={(e) => {
          e.stopPropagation();
          openPdf(only);
        }}
        className={invoiceLinkClass}
      >
        {only.number}
      </button>
    );
  }

  const first = list[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger onClick={(e) => e.stopPropagation()} title="Open an invoice" className="text-left">
        <span className={invoiceLinkClass}>{first.number}</span>
        <span className="ml-1 text-xs text-muted-foreground">+{list.length - 1} more</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {list.length} invoices
        </p>
        {list.map((iv) => (
          <button
            key={iv.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              openPdf(iv);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-foreground hover:bg-accent"
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            {iv.number}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The Orders-list "Invoice" column. Placed after "Code" by the caller. */
export const invoiceColumn: ColumnDef<Order> = {
  accessorKey: "firstInvoiceNumber",
  header: "Invoice",
  enableSorting: false,
  meta: { className: "w-[15%]" },
  cell: ({ row }) => <InvoiceCell invoices={row.original.invoices} />,
};

/** Skeleton cell for the Invoice column (inserted after Code by the caller). */
export const invoiceSkeletonCell: SkeletonCell = () => <Skeleton className="h-3 w-28" />;
