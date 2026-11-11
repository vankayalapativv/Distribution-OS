"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import type { OrderInvoiceRef } from "./orders-api";

/**
 * "Invoiced Date" cell — the earliest invoice's date. When an order has several
 * invoices (partial delivery) it adds a "+N more" hint and, on hover, opens a
 * small panel listing every invoice number with its date. "—" when nothing is
 * billed yet. The Popover portals to the body so it isn't clipped by the table's
 * horizontal scroll container.
 */
export function InvoicedDateCell({ invoices }: { readonly invoices: OrderInvoiceRef[] | undefined }) {
  const [open, setOpen] = useState(false);
  const list = (invoices ?? []).filter((iv) => iv.date);
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;

  const earliest = formatDate(list[0].date as string);
  if (list.length === 1) return <span className="text-muted-foreground">{earliest}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-default text-left text-muted-foreground"
      >
        {earliest}
        <span className="ml-1 text-xs text-primary">+{list.length - 1} more</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {list.length} invoices
        </p>
        {list.map((iv) => (
          <div key={iv.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{iv.number}</span>
            <span className="text-foreground">{formatDate(iv.date as string)}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
