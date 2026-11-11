"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { rupeesExact } from "@/lib/format";
import { SearchSelect } from "@/features/orders/search-select";
import type { OutstandingInvoice } from "./sales-return-create-logic";

/** Invoice combobox + return-date input for the new-sales-return form. */
function invoicePlaceholder(loading: boolean, hasInvoices: boolean): string {
  if (loading) return "Loading invoices…";
  return hasInvoices ? "Select an invoice" : "No outstanding invoices";
}

export function SalesReturnInvoicePicker({
  invoiceId,
  pickInvoice,
  invoicesQ,
  date,
  setDate,
}: {
  readonly invoiceId: string;
  readonly pickInvoice: (id: string) => void;
  readonly invoicesQ: UseQueryResult<{ invoices: OutstandingInvoice[] }>;
  readonly date: string;
  readonly setDate: (v: string) => void;
}) {
  const invoices = invoicesQ.data?.invoices ?? [];
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Against Invoice <span className="text-destructive">*</span>
        </span>
        <SearchSelect
          items={invoices}
          valueKey={invoiceId}
          getKey={(i) => i.id}
          getLabel={(i) => `${i.invoiceNumber} · ${rupeesExact(i.outstandingAmount)} due`}
          onSelect={pickInvoice}
          placeholder={invoicePlaceholder(invoicesQ.isLoading, invoices.length > 0)}
          searchPlaceholder="Search invoice no…"
          emptyText="No outstanding invoices"
          contentClassName="w-[340px] p-0"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Return Date <span className="text-destructive">*</span>
        </span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
    </div>
  );
}
