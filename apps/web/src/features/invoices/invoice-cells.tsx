import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import type { InvoiceRow } from "./invoices-api";

/** Invoice number over its date. */
export function InvoiceNumberCell({ row }: { readonly row: InvoiceRow }) {
  return (
    <div>
      <div className="font-mono text-xs font-medium">{row.invoiceNumber}</div>
      <div className="tabular-nums text-[11px] text-muted-foreground">{formatDate(row.invoiceDate)}</div>
    </div>
  );
}

/** Customer name over "SE · city". */
export function InvoiceCustomerCell({ row }: { readonly row: InvoiceRow }) {
  return (
    <div>
      <div className="text-sm font-medium">{row.customerName ?? "—"}</div>
      <div className="text-[11px] text-muted-foreground">
        {row.salesExecutiveName ?? "No SE"}
        {row.customerCity ? ` · ${row.customerCity}` : ""}
      </div>
    </div>
  );
}

const PAYMENT_TONES = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-800",
  unpaid: "bg-red-100 text-red-700",
};

/** Outstanding amount with a payment-status badge beneath it. */
export function InvoiceOutstandingCell({ row, rupeesExact }: { readonly row: InvoiceRow; readonly rupeesExact: (n: number) => string }) {
  return (
    <div className="text-right">
      <span className="tabular-nums">{rupeesExact(row.outstandingAmount)}</span>
      <div className="mt-0.5 flex justify-end">
        <StatusBadge status={row.paymentStatus} tones={PAYMENT_TONES} />
      </div>
    </div>
  );
}
