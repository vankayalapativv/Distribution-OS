"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { litres, formatDate } from "@/lib/format";
import { formatMonthYear } from "@/components/form/month-year-field";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { fetchInvoiceStockLots, packLabel, type InvoiceStockDetail } from "./stock-api";

export interface InvoiceStockRef { invoiceId: string; kind: "sale" | "reversal" | "return" }

function Body({ d }: Readonly<{ d: InvoiceStockDetail }>) {
  const deducted = d.kind === "sale";
  const backLabel = d.kind === "return" ? "Returned" : "Credited";
  if (d.lines.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No batch-level stock movement recorded for this invoice.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 text-left font-semibold">Product</th>
          <th className="px-3 py-2.5 text-left font-semibold">Batch</th>
          <th className="px-3 py-2.5 text-left font-semibold">Expiry</th>
          <th className="px-4 py-2.5 text-right font-semibold">{deducted ? "Deducted" : backLabel}</th>
        </tr></thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={`${l.productName}-${l.batchNumber ?? ""}-${l.expiryDate ?? ""}-${i}`} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}</div></td>
              <td className="px-3 py-2.5 font-mono text-xs">{l.batchNumber ?? "—"}</td>
              <td className="px-3 py-2.5">{l.expiryDate ? formatMonthYear(l.expiryDate) : "—"}</td>
              <td className={`px-4 py-2.5 text-right font-mono font-semibold ${deducted ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{deducted ? "−" : "+"}{l.qtyUnits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceStockDetailDialog({ actionConfig, refItem, onClose }: Readonly<{ actionConfig: ActionConfig; refItem: InvoiceStockRef; onClose: () => void }>) {
  const q = useQuery({
    queryKey: ["invoice-stock-lots", refItem.invoiceId, refItem.kind],
    queryFn: () => fetchInvoiceStockLots(actionConfig, refItem.invoiceId, refItem.kind),
  });
  const d = q.data;
  const heading = refItem.kind === "sale" ? "Stock deducted" : refItem.kind === "return" ? "Stock returned" : "Stock credited back";
  const fallbackTitle = refItem.kind === "sale" ? "Stock deducted — sale" : refItem.kind === "return" ? "Stock returned — return" : "Stock credited back — reversal";
  let description = "Which batches this invoice moved (FEFO).";
  if (d) {
    const loc = d.locationName ? ` · ${d.locationName}` : "";
    description = `${d.customerName ?? "—"}${loc} · ${formatDate(d.invoiceDate)}`;
  }
  let body: ReactNode = null;
  if (q.isLoading) body = <Skeleton className="h-28 w-full" />;
  else if (q.error) body = <p className="text-sm font-medium text-destructive">{errorMessage(q.error, "Could not load the stock detail.")}</p>;
  else if (d) body = <Body d={d} />;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{d ? `${heading} · ${d.invoiceNumber}` : fallbackTitle}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>{body}</DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
